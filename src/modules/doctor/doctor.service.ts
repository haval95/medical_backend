import {
  AppointmentStatus,
  Prisma,
  Role,
  ScheduleSlotStatus,
  ServiceRequestStatus,
  UserStatus,
} from '@prisma/client';
import { prisma } from '../../prisma/client.js';
import { ApiError } from '../../utils/ApiError.js';
import { buildScheduleSlots } from '../../utils/schedule.js';
import { calculateDistanceKm, decimalToNumber, isWithinRadiusKm, toDecimalInput } from '../../utils/geo.js';
import { deleteFileFromSpaces, getManagedUploadKeyFromUrl } from '../../utils/upload.js';

const doctorInclude = {
  user: true,
  location: true,
  credentials: {
    orderBy: [{ displayOrder: 'asc' }, { createdAt: 'asc' }],
  },
} satisfies Prisma.DoctorProfileInclude;

const visibleReviewInclude = {
  patientProfile: {
    include: {
      user: true,
    },
  },
} satisfies Prisma.ReviewInclude;

const serializeCredential = (
  credential: Prisma.DoctorCredentialGetPayload<Record<string, never>>
) => ({
  id: credential.id,
  type: credential.type,
  title: credential.title,
  issuer: credential.issuer,
  awardedAt: credential.awardedAt,
  documentUrl: credential.documentUrl,
  notes: credential.notes,
});

const mapDoctorCard = (
  doctor: Prisma.DoctorProfileGetPayload<{ include: typeof doctorInclude }>,
  patientLocation?: { latitude?: number | null; longitude?: number | null }
) => {
  const doctorLatitude = decimalToNumber(doctor.location?.latitude);
  const doctorLongitude = decimalToNumber(doctor.location?.longitude);
  const distanceKm = calculateDistanceKm(
    {
      latitude: doctorLatitude,
      longitude: doctorLongitude,
    },
    patientLocation ?? {}
  );

  return {
    id: doctor.id,
    fullName: doctor.user.fullName,
    phoneNumber: doctor.user.phoneNumber,
    photoUrl: doctor.user.photoUrl,
    specialty: doctor.specialty,
    referralCode: doctor.referralCode,
    bio: doctor.bio,
    languages: doctor.languages,
    yearsExperience: doctor.yearsExperience,
    isAvailable: doctor.isAvailable,
    serviceRadiusKm: doctor.serviceRadiusKm,
    defaultSlotMinutes: doctor.defaultSlotMinutes,
    defaultBufferMinutes: doctor.defaultBufferMinutes,
    averageRating: decimalToNumber(doctor.averageRating) ?? 0,
    reviewCount: doctor.reviewCount,
    completedVisitCount: doctor.completedVisitCount,
    workplaceName: doctor.workplaceName,
    workplaceAddress: doctor.workplaceAddress,
    city: doctor.location?.city ?? null,
    addressLine: doctor.location?.addressLine ?? null,
    latitude: doctorLatitude,
    longitude: doctorLongitude,
    distanceKm,
    isWithinRange: isWithinRadiusKm(distanceKm, doctor.serviceRadiusKm),
    credentials: doctor.credentials.map(serializeCredential),
  };
};

const mapVisibleReview = (
  review: Prisma.ReviewGetPayload<{ include: typeof visibleReviewInclude }>
) => ({
  id: review.id,
  rating: review.rating,
  comment: review.comment,
  doctorReply: review.doctorReply,
  doctorReplyAt: review.doctorReplyAt,
  patientName: review.patientProfile.user.fullName,
  createdAt: review.createdAt,
});

const getPatientLocationContext = async (userId?: string) => {
  if (!userId) {
    return null;
  }

  const patientProfile = await prisma.patientProfile.findUnique({
    where: { userId },
    select: {
      latitude: true,
      longitude: true,
    },
  });

  if (!patientProfile) {
    return null;
  }

  return {
    latitude: decimalToNumber(patientProfile.latitude),
    longitude: decimalToNumber(patientProfile.longitude),
  };
};

const getDoctorProfileById = async (doctorId: string) => {
  const doctor = await prisma.doctorProfile.findUnique({
    where: { id: doctorId },
    include: doctorInclude,
  });

  if (!doctor) {
    throw new ApiError(404, 'Doctor profile not found');
  }

  return doctor;
};

const ACTIVE_APPOINTMENT_STATUSES = [
  AppointmentStatus.PENDING,
  AppointmentStatus.CONFIRMED,
  AppointmentStatus.IN_PROGRESS,
  AppointmentStatus.CANCELLATION_REQUESTED,
] as const;

const rangesOverlap = (
  first: { startsAt: Date; endsAt: Date },
  second: { startsAt: Date; endsAt: Date }
) => first.startsAt < second.endsAt && first.endsAt > second.startsAt;

const startOfScheduleDate = (value: string) => new Date(`${value}T00:00:00`);

const endOfScheduleDate = (value: string) => {
  const result = startOfScheduleDate(value);
  result.setDate(result.getDate() + 1);
  return result;
};

export const getDoctorProfileByUserId = async (userId: string) => {
  const doctor = await prisma.doctorProfile.findUnique({
    where: { userId },
    include: doctorInclude,
  });

  if (!doctor) {
    throw new ApiError(404, 'Doctor profile not found');
  }

  return doctor;
};

export const listDoctors = async (viewerUserId?: string) => {
  const patientLocation = await getPatientLocationContext(viewerUserId);
  const doctors = await prisma.doctorProfile.findMany({
    where: {
      user: {
        status: UserStatus.ACTIVE,
      },
    },
    include: doctorInclude,
    orderBy: [
      { isAvailable: 'desc' },
      { averageRating: 'desc' },
      { user: { fullName: 'asc' } },
    ],
  });

  return doctors.map((doctor) => mapDoctorCard(doctor, patientLocation ?? undefined));
};

export const getDoctorDetails = async (doctorId: string, viewerUserId?: string) => {
  const patientLocation = await getPatientLocationContext(viewerUserId);
  const doctor = await getDoctorProfileById(doctorId);

  const [reviews, availableSlots] = await Promise.all([
    prisma.review.findMany({
      where: {
        doctorId,
        isHidden: false,
      },
      include: visibleReviewInclude,
      orderBy: { createdAt: 'desc' },
      take: 12,
    }),
    prisma.doctorScheduleSlot.findMany({
      where: {
        doctorId,
        startsAt: {
          gte: new Date(),
        },
        status: ScheduleSlotStatus.AVAILABLE,
      },
      orderBy: { startsAt: 'asc' },
      take: 30,
    }),
  ]);

  return {
    ...mapDoctorCard(doctor, patientLocation ?? undefined),
    reviews: reviews.map(mapVisibleReview),
    nextAvailableSlots: availableSlots.map((slot) => ({
      id: slot.id,
      startsAt: slot.startsAt,
      endsAt: slot.endsAt,
      status: slot.status,
      isBuffer: slot.isBuffer,
    })),
  };
};

export const getMyDoctorSummary = async (userId: string) => {
  const doctor = await getDoctorProfileByUserId(userId);
  const [activePatients, pendingRequests, recentRequests, referralStats, upcomingAppointments, slotCounts] =
    await Promise.all([
      prisma.patientProfile.count({
        where: {
          OR: [{ primaryDoctorId: doctor.id }, { referredByDoctorId: doctor.id }],
        },
      }),
      prisma.serviceRequest.count({
        where: {
          OR: [{ assignedDoctorId: doctor.id }, { requestedDoctorId: doctor.id }],
          status: {
            in: [
              ServiceRequestStatus.PENDING,
              ServiceRequestStatus.MATCHING,
              ServiceRequestStatus.ASSIGNED,
              ServiceRequestStatus.ACCEPTED,
              ServiceRequestStatus.IN_PROGRESS,
            ],
          },
        },
      }),
      prisma.serviceRequest.findMany({
        where: {
          OR: [{ assignedDoctorId: doctor.id }, { requestedDoctorId: doctor.id }],
        },
        orderBy: { createdAt: 'desc' },
        take: 6,
        include: {
          patientProfile: {
            include: {
              user: true,
            },
          },
        },
      }),
      prisma.referralEvent.aggregate({
        where: { doctorId: doctor.id },
        _count: { _all: true },
        _sum: { pointsAwarded: true },
      }),
      prisma.appointment.findMany({
        where: {
          doctorId: doctor.id,
          startsAt: {
            gte: new Date(),
          },
          status: {
            in: [
              AppointmentStatus.CONFIRMED,
              AppointmentStatus.PENDING,
              AppointmentStatus.CANCELLATION_REQUESTED,
            ],
          },
        },
        orderBy: { startsAt: 'asc' },
        take: 8,
        include: {
          patientProfile: {
            include: {
              user: true,
            },
          },
        },
      }),
      prisma.doctorScheduleSlot.groupBy({
        by: ['status'],
        where: {
          doctorId: doctor.id,
          startsAt: {
            gte: new Date(),
          },
        },
        _count: {
          _all: true,
        },
      }),
    ]);

  return {
    doctor: mapDoctorCard(doctor),
    activePatients,
    pendingRequests,
    referralEvents: referralStats._count._all,
    referralPointsAwarded: referralStats._sum.pointsAwarded ?? 0,
    upcomingAppointments: upcomingAppointments.map((appointment) => ({
      id: appointment.id,
      status: appointment.status,
      startsAt: appointment.startsAt,
      endsAt: appointment.endsAt,
      patientName: appointment.patientProfile.user.fullName,
      patientAddress: appointment.patientAddress,
      city: appointment.city,
    })),
    scheduleCounts: slotCounts.reduce<Record<string, number>>((accumulator, item) => {
      accumulator[item.status] = item._count._all;
      return accumulator;
    }, {}),
    recentRequests: recentRequests.map((request) => ({
      id: request.id,
      status: request.status,
      type: request.type,
      city: request.city,
      serviceAddress: request.serviceAddress,
      patientName: request.patientProfile.user.fullName,
      scheduledFor: request.scheduledFor,
      createdAt: request.createdAt,
    })),
  };
};

export const updateDoctorLocationById = async (
  doctorId: string,
  input: {
    city: string;
    addressLine: string;
    latitude?: number;
    longitude?: number;
    notes?: string;
  }
) =>
  prisma.doctorLocation.upsert({
    where: { doctorId },
    update: {
      city: input.city,
      addressLine: input.addressLine,
      latitude: toDecimalInput(input.latitude),
      longitude: toDecimalInput(input.longitude),
      notes: input.notes,
    },
    create: {
      doctorId,
      city: input.city,
      addressLine: input.addressLine,
      latitude: toDecimalInput(input.latitude),
      longitude: toDecimalInput(input.longitude),
      notes: input.notes,
    },
  });

export const updateMyDoctorLocation = async (
  userId: string,
  input: {
    city: string;
    addressLine: string;
    latitude?: number;
    longitude?: number;
    notes?: string;
  }
) => {
  const doctor = await getDoctorProfileByUserId(userId);
  return updateDoctorLocationById(doctor.id, input);
};

export const updateDoctorProfileById = async (
  doctorId: string,
  input: {
    fullName?: string;
    photoUrl?: string | null;
    specialty?: string | null;
    bio?: string | null;
    yearsExperience?: number;
    languages?: string[];
    serviceRadiusKm?: number;
    defaultSlotMinutes?: number;
    defaultBufferMinutes?: number;
    isAvailable?: boolean;
    workplaceName?: string | null;
    workplaceAddress?: string | null;
    workplaceLatitude?: number | null;
    workplaceLongitude?: number | null;
    credentials?: Array<{
      type: 'DEGREE' | 'CERTIFICATE' | 'LICENSE' | 'OTHER';
      title: string;
      issuer?: string;
      awardedAt?: string;
      documentUrl?: string;
      notes?: string;
    }>;
  }
) => {
  const doctor = await getDoctorProfileById(doctorId);
  const previousPhotoUrl = doctor.user.photoUrl;

  const updatedDoctor = await prisma.$transaction(async (tx) => {
    if (input.fullName !== undefined || input.photoUrl !== undefined) {
      await tx.user.update({
        where: { id: doctor.userId },
        data: {
          fullName: input.fullName,
          photoUrl: input.photoUrl === null ? null : input.photoUrl,
        },
      });
    }

    if (input.credentials) {
      await tx.doctorCredential.deleteMany({
        where: { doctorId },
      });

      if (input.credentials.length) {
        await tx.doctorCredential.createMany({
          data: input.credentials.map((credential, index) => ({
            doctorId,
            type: credential.type,
            title: credential.title,
            issuer: credential.issuer,
            awardedAt: credential.awardedAt ? new Date(credential.awardedAt) : undefined,
            documentUrl: credential.documentUrl,
            notes: credential.notes,
            displayOrder: index,
          })),
        });
      }
    }

    await tx.doctorProfile.update({
      where: { id: doctorId },
      data: {
        specialty: input.specialty === undefined ? undefined : input.specialty,
        bio: input.bio === undefined ? undefined : input.bio,
        yearsExperience: input.yearsExperience,
        languages: input.languages,
        serviceRadiusKm: input.serviceRadiusKm,
        defaultSlotMinutes: input.defaultSlotMinutes,
        defaultBufferMinutes: input.defaultBufferMinutes,
        isAvailable: input.isAvailable,
        workplaceName: input.workplaceName === undefined ? undefined : input.workplaceName,
        workplaceAddress:
          input.workplaceAddress === undefined ? undefined : input.workplaceAddress,
        workplaceLatitude:
          input.workplaceLatitude === undefined
            ? undefined
            : toDecimalInput(input.workplaceLatitude),
        workplaceLongitude:
          input.workplaceLongitude === undefined
            ? undefined
            : toDecimalInput(input.workplaceLongitude),
      },
    });

    return tx.doctorProfile.findUnique({
      where: { id: doctorId },
      include: doctorInclude,
    });
  });

  if (
    input.photoUrl !== undefined &&
    previousPhotoUrl &&
    previousPhotoUrl !== input.photoUrl
  ) {
    const previousKey = getManagedUploadKeyFromUrl(previousPhotoUrl);

    if (previousKey) {
      await deleteFileFromSpaces(previousKey).catch((error: unknown) => {
        console.error('Failed to delete previous doctor profile photo from Spaces', error);
      });
    }
  }

  if (!updatedDoctor) {
    throw new ApiError(500, 'Doctor profile could not be updated');
  }

  return mapDoctorCard(updatedDoctor);
};

export const updateMyDoctorProfile = async (
  userId: string,
  input: Parameters<typeof updateDoctorProfileById>[1]
) => {
  const doctor = await getDoctorProfileByUserId(userId);
  return updateDoctorProfileById(doctor.id, input);
};

export const updateMyDoctorAvailability = async (
  userId: string,
  input: { isAvailable: boolean }
) => {
  const doctor = await getDoctorProfileByUserId(userId);
  await prisma.doctorProfile.update({
    where: { id: doctor.id },
    data: {
      isAvailable: input.isAvailable,
    },
  });

  return {
    id: doctor.id,
    isAvailable: input.isAvailable,
  };
};

export const listDoctorSlots = async (doctorId: string, from?: string, to?: string) =>
  prisma.doctorScheduleSlot.findMany({
    where: {
      doctorId,
      startsAt: from ? { gte: new Date(from) } : undefined,
      endsAt: to ? { lte: new Date(to) } : undefined,
    },
    orderBy: { startsAt: 'asc' },
    include: {
      appointment: {
        include: {
          patientProfile: {
            include: {
              user: true,
            },
          },
        },
      },
    },
  });

export const createScheduleTemplateForDoctor = async (
  doctorId: string,
  input: {
    fromDate: string;
    toDate: string;
    dayStartTime: string;
    dayEndTime: string;
    slotMinutes?: number;
    excludedWeekdays?: number[];
    excludedDates?: string[];
    breakWindows?: Array<{ startTime: string; endTime: string }>;
    sourceLabel?: string;
  }
) => {
  const doctor = await getDoctorProfileById(doctorId);
  const resolvedSlotMinutes = input.slotMinutes ?? doctor.defaultSlotMinutes;
  const allGeneratedSlots = buildScheduleSlots({
    ...input,
    slotMinutes: resolvedSlotMinutes,
  });
  const now = new Date();
  const scheduleRangeStart = startOfScheduleDate(input.fromDate);
  const scheduleRangeEnd = endOfScheduleDate(input.toDate);
  const mutableRangeStart =
    scheduleRangeStart.getTime() > now.getTime() ? scheduleRangeStart : now;

  if (mutableRangeStart >= scheduleRangeEnd) {
    return {
      doctorId: doctor.id,
      slotMinutes: resolvedSlotMinutes,
      createdCount: 0,
    };
  }

  const [activeAppointmentSlots, unavailabilityWindows] = await Promise.all([
    prisma.doctorScheduleSlot.findMany({
      where: {
        doctorId,
        startsAt: {
          lt: scheduleRangeEnd,
        },
        endsAt: {
          gt: mutableRangeStart,
        },
        appointment: {
          is: {
            status: {
              in: [...ACTIVE_APPOINTMENT_STATUSES],
            },
          },
        },
      },
      include: {
        appointment: {
          select: {
            id: true,
            startsAt: true,
            endsAt: true,
            bufferMinutes: true,
          },
        },
      },
    }),
    prisma.doctorUnavailability.findMany({
      where: {
        doctorId,
        startsAt: {
          lt: scheduleRangeEnd,
        },
        endsAt: {
          gt: mutableRangeStart,
        },
      },
      select: {
        startsAt: true,
        endsAt: true,
        reason: true,
      },
    }),
  ]);

  const activeAppointmentRanges = activeAppointmentSlots.map((slot) => ({
    startsAt: slot.startsAt,
    endsAt: slot.endsAt,
  }));
  const bufferWindows = activeAppointmentSlots
    .filter(
      (
        slot
      ): slot is typeof slot & {
        appointment: { id: string; startsAt: Date; endsAt: Date; bufferMinutes: number };
      } => Boolean(slot.appointment && slot.appointment.bufferMinutes > 0)
    )
    .map((slot) => ({
      startsAt: new Date(slot.appointment.startsAt.getTime() - slot.appointment.bufferMinutes * 60 * 1000),
      endsAt: new Date(slot.appointment.endsAt.getTime() + slot.appointment.bufferMinutes * 60 * 1000),
      appointmentId: slot.appointment.id,
      beforeReason: 'Travel buffer before appointment',
      afterReason: 'Travel buffer after appointment',
      appointmentStartsAt: slot.appointment.startsAt,
      appointmentEndsAt: slot.appointment.endsAt,
    }));

  const slots = allGeneratedSlots
    .filter((slot) => slot.endsAt > mutableRangeStart)
    .filter(
      (slot) =>
        !activeAppointmentRanges.some((appointmentRange) => rangesOverlap(slot, appointmentRange))
    )
    .map((slot) => {
      const overlappingUnavailability = unavailabilityWindows.find((window) =>
        rangesOverlap(slot, window)
      );
      if (overlappingUnavailability) {
        return {
          doctorId,
          startsAt: slot.startsAt,
          endsAt: slot.endsAt,
          status: ScheduleSlotStatus.UNAVAILABLE,
          isBuffer: false,
          sourceLabel: input.sourceLabel ?? 'BULK_TEMPLATE',
          blockedReason: overlappingUnavailability.reason ?? 'Doctor marked unavailable',
          bufferForAppointmentId: null,
        };
      }

      const overlappingBuffer = bufferWindows.find((window) => rangesOverlap(slot, window));
      if (overlappingBuffer) {
        return {
          doctorId,
          startsAt: slot.startsAt,
          endsAt: slot.endsAt,
          status: ScheduleSlotStatus.BLOCKED,
          isBuffer: true,
          sourceLabel: input.sourceLabel ?? 'BULK_TEMPLATE',
          blockedReason:
            slot.endsAt <= overlappingBuffer.appointmentStartsAt
              ? overlappingBuffer.beforeReason
              : overlappingBuffer.afterReason,
          bufferForAppointmentId: overlappingBuffer.appointmentId,
        };
      }

      return {
        doctorId,
        startsAt: slot.startsAt,
        endsAt: slot.endsAt,
        status: ScheduleSlotStatus.AVAILABLE,
        isBuffer: false,
        sourceLabel: input.sourceLabel ?? 'BULK_TEMPLATE',
        blockedReason: null,
        bufferForAppointmentId: null,
      };
    });

  await prisma.$transaction(async (tx) => {
    await tx.doctorScheduleSlot.deleteMany({
      where: {
        doctorId,
        startsAt: {
          lt: scheduleRangeEnd,
        },
        endsAt: {
          gt: mutableRangeStart,
        },
        OR: [
          {
            appointment: {
              is: null,
            },
          },
          {
            appointment: {
              is: {
                status: {
                  in: [AppointmentStatus.CANCELLED, AppointmentStatus.REJECTED],
                },
              },
            },
          },
        ],
      },
    });

    if (slots.length) {
      await tx.doctorScheduleSlot.createMany({
        data: slots,
      });
    }
  });

  return {
    doctorId: doctor.id,
    slotMinutes: resolvedSlotMinutes,
    createdCount: slots.length,
  };
};

export const createMyScheduleTemplate = async (
  userId: string,
  input: Parameters<typeof createScheduleTemplateForDoctor>[1]
) => {
  const doctor = await getDoctorProfileByUserId(userId);
  return createScheduleTemplateForDoctor(doctor.id, input);
};

export const createDoctorUnavailability = async (
  doctorId: string,
  input: {
    startsAt: string;
    endsAt: string;
    reason?: string;
  }
) => {
  const startsAt = new Date(input.startsAt);
  const endsAt = new Date(input.endsAt);

  if (startsAt >= endsAt) {
    throw new ApiError(400, 'Unavailability end time must be after the start time');
  }

  const bookedAppointments = await prisma.appointment.count({
    where: {
      doctorId,
      status: {
        in: [
          AppointmentStatus.CONFIRMED,
          AppointmentStatus.PENDING,
          AppointmentStatus.IN_PROGRESS,
          AppointmentStatus.CANCELLATION_REQUESTED,
        ],
      },
      startsAt: {
        lt: endsAt,
      },
      endsAt: {
        gt: startsAt,
      },
    },
  });

  if (bookedAppointments > 0) {
    throw new ApiError(
      400,
      'This unavailability range overlaps with booked appointments. Resolve those appointments first.'
    );
  }

  return prisma.$transaction(async (tx) => {
    const record = await tx.doctorUnavailability.create({
      data: {
        doctorId,
        startsAt,
        endsAt,
        reason: input.reason,
      },
    });

    await tx.doctorScheduleSlot.updateMany({
      where: {
        doctorId,
        startsAt: {
          lt: endsAt,
        },
        endsAt: {
          gt: startsAt,
        },
        status: {
          in: [ScheduleSlotStatus.AVAILABLE, ScheduleSlotStatus.BLOCKED],
        },
      },
      data: {
        status: ScheduleSlotStatus.UNAVAILABLE,
        blockedReason: input.reason ?? 'Doctor marked unavailable',
      },
    });

    return record;
  });
};

export const createMyDoctorUnavailability = async (
  userId: string,
  input: Parameters<typeof createDoctorUnavailability>[1]
) => {
  const doctor = await getDoctorProfileByUserId(userId);
  return createDoctorUnavailability(doctor.id, input);
};
