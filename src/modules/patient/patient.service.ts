import {
  AppointmentStatus,
  ConsentType,
  DiscountStatus,
  PatientGender,
  PointsTransactionType,
  Prisma,
  ReferralEventType,
  Role,
} from '@prisma/client';
import { prisma } from '../../prisma/client.js';
import type { PrismaExecutor } from '../../prisma/client.js';
import { ApiError } from '../../utils/ApiError.js';
import { decimalToNumber, toDecimalInput } from '../../utils/geo.js';
import { normalizePhoneNumber } from '../../utils/phone.js';
import { resolvePermissions } from '../../utils/permissions.js';
import type { PatientRegistrationInput } from './patient.types.js';
import { applyPointsTransaction } from '../points/points.service.js';

const patientSummaryInclude = {
  user: true,
  referredByDoctor: {
    include: {
      user: true,
      location: true,
    },
  },
  primaryDoctor: {
    include: {
      user: true,
      location: true,
    },
  },
  consents: {
    where: {
      revokedAt: null,
    },
    orderBy: {
      grantedAt: 'desc',
    },
  },
} satisfies Prisma.PatientProfileInclude;

const parseDateOnly = (value?: string) =>
  value ? new Date(`${value}T00:00:00.000Z`) : undefined;

const formatDateOnly = (value?: Date | null) =>
  value ? value.toISOString().slice(0, 10) : null;

const serializeConsent = (
  consent: Prisma.PatientConsentGetPayload<Record<string, never>>
) => ({
  id: consent.id,
  type: consent.type,
  version: consent.version,
  grantedAt: consent.grantedAt,
  revokedAt: consent.revokedAt,
  source: consent.source,
});

const syncPatientConsents = async (
  tx: PrismaExecutor,
  patientProfileId: string,
  consents?: Array<{
    type: ConsentType;
    granted: boolean;
    version?: string;
    source?: string;
  }>
) => {
  if (!consents?.length) {
    return;
  }

  for (const consent of consents) {
    const existing = await tx.patientConsent.findFirst({
      where: {
        patientProfileId,
        type: consent.type,
        revokedAt: null,
      },
      orderBy: {
        grantedAt: 'desc',
      },
    });

    if (consent.granted) {
      if (existing) {
        await tx.patientConsent.update({
          where: { id: existing.id },
          data: {
            version: consent.version ?? existing.version,
            source: consent.source ?? existing.source,
          },
        });
      } else {
        await tx.patientConsent.create({
          data: {
            patientProfileId,
            type: consent.type,
            version: consent.version,
            source: consent.source ?? 'PATIENT_PROFILE',
          },
        });
      }

      continue;
    }

    if (existing) {
      await tx.patientConsent.update({
        where: { id: existing.id },
        data: {
          revokedAt: new Date(),
          source: consent.source ?? existing.source,
        },
      });
    }
  }
};

const buildPatientProfileUpdate = (input: {
  city?: string;
  homeAddress?: string;
  latitude?: number;
  longitude?: number;
  dateOfBirth?: string;
  gender?: PatientGender;
  emergencyContactName?: string;
  emergencyContactPhone?: string;
  allergies?: string;
  chronicConditions?: string;
  currentMedications?: string;
  mobilityNotes?: string;
  communicationPreferences?: string;
  notes?: string;
}) => ({
  city: input.city,
  homeAddress: input.homeAddress,
  latitude: input.latitude === undefined ? undefined : toDecimalInput(input.latitude),
  longitude: input.longitude === undefined ? undefined : toDecimalInput(input.longitude),
  dateOfBirth: input.dateOfBirth === undefined ? undefined : parseDateOnly(input.dateOfBirth),
  gender: input.gender,
  emergencyContactName: input.emergencyContactName,
  emergencyContactPhone:
    input.emergencyContactPhone === undefined
      ? undefined
      : input.emergencyContactPhone
        ? normalizePhoneNumber(input.emergencyContactPhone)
        : null,
  allergies: input.allergies,
  chronicConditions: input.chronicConditions,
  currentMedications: input.currentMedications,
  mobilityNotes: input.mobilityNotes,
  communicationPreferences: input.communicationPreferences,
  notes: input.notes,
});

const formatPatientSummary = (
  profile: Prisma.PatientProfileGetPayload<{ include: typeof patientSummaryInclude }>
) => ({
  id: profile.id,
  fullName: profile.user.fullName,
  phoneNumber: profile.user.phoneNumber,
  availablePoints: profile.availablePoints,
  lifetimePoints: profile.lifetimePoints,
  city: profile.city,
  homeAddress: profile.homeAddress,
  latitude: decimalToNumber(profile.latitude),
  longitude: decimalToNumber(profile.longitude),
  dateOfBirth: formatDateOnly(profile.dateOfBirth),
  gender: profile.gender,
  emergencyContactName: profile.emergencyContactName,
  emergencyContactPhone: profile.emergencyContactPhone,
  allergies: profile.allergies,
  chronicConditions: profile.chronicConditions,
  currentMedications: profile.currentMedications,
  mobilityNotes: profile.mobilityNotes,
  communicationPreferences: profile.communicationPreferences,
  notes: profile.notes,
  referralCodeUsed: profile.referralCodeUsed,
  referredDoctor: profile.referredByDoctor
    ? {
        id: profile.referredByDoctor.id,
        name: profile.referredByDoctor.user.fullName,
        referralCode: profile.referredByDoctor.referralCode,
        city: profile.referredByDoctor.location?.city ?? null,
      }
    : null,
  primaryDoctor: profile.primaryDoctor
    ? {
        id: profile.primaryDoctor.id,
        name: profile.primaryDoctor.user.fullName,
        city: profile.primaryDoctor.location?.city ?? null,
      }
    : null,
  consents: profile.consents.map(serializeConsent),
});

export const createPatientFromRegistration = async (input: PatientRegistrationInput) => {
  const referralCode = input.referralCode?.toUpperCase();

  return prisma.$transaction(async (tx) => {
    let referredDoctor:
      | Prisma.DoctorProfileGetPayload<{
          include: { user: true };
        }>
      | null = null;

    if (referralCode) {
      referredDoctor = await tx.doctorProfile.findUnique({
        where: { referralCode },
        include: { user: true },
      });

      if (!referredDoctor) {
        throw new ApiError(404, 'Referral code is invalid');
      }
    }

    const user = await tx.user.create({
      data: {
        phoneNumber: input.phoneNumber,
        fullName: input.fullName,
        role: Role.PATIENT,
        permissions: resolvePermissions(Role.PATIENT),
        status: 'ACTIVE',
      },
    });

    const patientProfile = await tx.patientProfile.create({
      data: {
        userId: user.id,
        referralCodeUsed: referralCode,
        referredByDoctorId: referredDoctor?.id,
        primaryDoctorId: referredDoctor?.id,
        ...buildPatientProfileUpdate(input),
      },
    });

    await syncPatientConsents(tx, patientProfile.id, input.consents);

    if (referredDoctor) {
      const referralEvent = await tx.referralEvent.create({
        data: {
          doctorId: referredDoctor.id,
          patientProfileId: patientProfile.id,
          type: ReferralEventType.PATIENT_REGISTRATION,
          referralCode: referralCode!,
          pointsAwarded: referredDoctor.onboardingPoints,
          notes: `Patient joined through doctor referral code ${referralCode}`,
        },
      });

      if (referredDoctor.onboardingPoints > 0) {
        await applyPointsTransaction(tx, patientProfile.id, {
          type: PointsTransactionType.REFERRAL_BONUS,
          points: referredDoctor.onboardingPoints,
          notes: `Referral welcome points from Dr. ${referredDoctor.user.fullName}`,
          referralEventId: referralEvent.id,
        });
      }

      const referralDiscount = await tx.discount.findFirst({
        where: {
          isReferralReward: true,
          status: DiscountStatus.ACTIVE,
        },
        orderBy: {
          createdAt: 'asc',
        },
      });

      if (referralDiscount) {
        await tx.patientDiscount.create({
          data: {
            patientProfileId: patientProfile.id,
            discountId: referralDiscount.id,
            expiresAt: new Date(Date.now() + 1000 * 60 * 60 * 24 * 45),
          },
        });

        await tx.referralEvent.update({
          where: { id: referralEvent.id },
          data: { discountId: referralDiscount.id },
        });
      }
    }

    const createdProfile = await tx.patientProfile.findUnique({
      where: { id: patientProfile.id },
      include: patientSummaryInclude,
    });

    if (!createdProfile) {
      throw new ApiError(500, 'Patient profile could not be created');
    }

    return {
      user,
      patientProfile: formatPatientSummary(createdProfile),
    };
  });
};

export const getPatientProfileByUserId = async (userId: string) => {
  const profile = await prisma.patientProfile.findUnique({
    where: { userId },
    include: patientSummaryInclude,
  });

  if (!profile) {
    throw new ApiError(404, 'Patient profile not found');
  }

  return profile;
};

export const getMyPatientSummary = async (userId: string) => {
  const profile = await getPatientProfileByUserId(userId);
  const [activeRequests, upcomingAppointments, recentRequests] = await Promise.all([
    prisma.serviceRequest.count({
      where: {
        patientProfileId: profile.id,
        status: {
          in: ['PENDING', 'MATCHING', 'ASSIGNED', 'ACCEPTED', 'IN_PROGRESS'],
        },
      },
    }),
    prisma.appointment.count({
      where: {
        patientProfileId: profile.id,
        status: {
          in: [
            AppointmentStatus.CONFIRMED,
            AppointmentStatus.PENDING,
            AppointmentStatus.CANCELLATION_REQUESTED,
          ],
        },
        startsAt: {
          gte: new Date(),
        },
      },
    }),
    prisma.serviceRequest.findMany({
      where: { patientProfileId: profile.id },
      orderBy: { createdAt: 'desc' },
      take: 5,
      include: {
        requestedDoctor: { include: { user: true } },
        assignedDoctor: { include: { user: true } },
      },
    }),
  ]);

  return {
    patient: formatPatientSummary(profile),
    activeRequests,
    upcomingAppointments,
    recentRequests: recentRequests.map((request) => ({
      id: request.id,
      type: request.type,
      status: request.status,
      city: request.city,
      serviceAddress: request.serviceAddress,
      scheduledFor: request.scheduledFor,
      requestedDoctorName: request.requestedDoctor?.user.fullName ?? null,
      assignedDoctorName: request.assignedDoctor?.user.fullName ?? null,
      createdAt: request.createdAt,
    })),
  };
};

export const getMyPatientReferralSummary = async (userId: string) => {
  const profile = await prisma.patientProfile.findUnique({
    where: { userId },
    include: {
      referredByDoctor: {
        include: {
          user: true,
          location: true,
        },
      },
      referralEvents: {
        orderBy: { createdAt: 'desc' },
        include: {
          discount: true,
        },
      },
    },
  });

  if (!profile) {
    throw new ApiError(404, 'Patient profile not found');
  }

  return {
    referralCodeUsed: profile.referralCodeUsed,
    referredDoctor: profile.referredByDoctor
      ? {
          id: profile.referredByDoctor.id,
          name: profile.referredByDoctor.user.fullName,
          referralCode: profile.referredByDoctor.referralCode,
          city: profile.referredByDoctor.location?.city ?? null,
          addressLine: profile.referredByDoctor.location?.addressLine ?? null,
        }
      : null,
    events: profile.referralEvents.map((event) => ({
      id: event.id,
      type: event.type,
      pointsAwarded: event.pointsAwarded,
      notes: event.notes,
      discount: event.discount
        ? {
            id: event.discount.id,
            code: event.discount.code,
            title: event.discount.title,
          }
        : null,
      createdAt: event.createdAt,
    })),
  };
};

export const getMyPatientDiscountSummary = async (userId: string) => {
  const profile = await prisma.patientProfile.findUnique({
    where: { userId },
    include: {
      patientDiscounts: {
        orderBy: { createdAt: 'desc' },
        include: {
          discount: true,
        },
      },
    },
  });

  if (!profile) {
    throw new ApiError(404, 'Patient profile not found');
  }

  return profile.patientDiscounts.map((item) => ({
    id: item.id,
    status: item.status,
    usedAt: item.usedAt,
    expiresAt: item.expiresAt,
    discount: {
      id: item.discount.id,
      code: item.discount.code,
      title: item.discount.title,
      description: item.discount.description,
      value: item.discount.value,
      type: item.discount.type,
      pointsCost: item.discount.pointsCost,
    },
  }));
};

export const updateMyPatientProfile = async (
  userId: string,
  input: {
    fullName?: string;
    city?: string;
    homeAddress?: string;
    latitude?: number;
    longitude?: number;
    dateOfBirth?: string;
    gender?: PatientGender;
    emergencyContactName?: string;
    emergencyContactPhone?: string;
    allergies?: string;
    chronicConditions?: string;
    currentMedications?: string;
    mobilityNotes?: string;
    communicationPreferences?: string;
    notes?: string;
    consents?: Array<{
      type: ConsentType;
      granted: boolean;
      version?: string;
      source?: string;
    }>;
  }
) => {
  const profile = await getPatientProfileByUserId(userId);

  await prisma.$transaction(async (tx) => {
    if (input.fullName) {
      await tx.user.update({
        where: { id: profile.userId },
        data: {
          fullName: input.fullName,
        },
      });
    }

    await tx.patientProfile.update({
      where: { id: profile.id },
      data: buildPatientProfileUpdate(input),
    });

    await syncPatientConsents(tx, profile.id, input.consents);
  });

  const refreshed = await getPatientProfileByUserId(userId);
  return formatPatientSummary(refreshed);
};
