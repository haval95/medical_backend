import { OtpPurpose, Prisma } from '@prisma/client';
import { env } from '../../config/env.js';
import { prisma } from '../../prisma/client.js';
import { ApiError } from '../../utils/ApiError.js';
import { decimalToNumber } from '../../utils/geo.js';
import { normalizePhoneNumber } from '../../utils/phone.js';
import { buildAuthPayload, generateAccessToken } from '../../utils/token.js';
import { createPatientFromRegistration } from '../patient/patient.service.js';
import type { StartPhoneAuthInput, VerifyPhoneAuthInput } from './auth.types.js';

const authUserInclude = {
  doctorProfile: {
    include: {
      location: true,
    },
  },
  patientProfile: {
    include: {
      referredByDoctor: {
        include: {
          user: true,
        },
      },
      primaryDoctor: {
        include: {
          user: true,
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
    },
  },
} satisfies Prisma.UserInclude;

const mapAuthUser = (
  user: Prisma.UserGetPayload<{ include: typeof authUserInclude }>
) => ({
  id: user.id,
  fullName: user.fullName,
  phoneNumber: user.phoneNumber,
  role: user.role,
  permissions: user.permissions,
  status: user.status,
  photoUrl: user.photoUrl,
  doctorProfile: user.doctorProfile
    ? {
        id: user.doctorProfile.id,
        referralCode: user.doctorProfile.referralCode,
        specialty: user.doctorProfile.specialty,
        bio: user.doctorProfile.bio,
        languages: user.doctorProfile.languages,
        yearsExperience: user.doctorProfile.yearsExperience,
        serviceRadiusKm: user.doctorProfile.serviceRadiusKm,
        isAvailable: user.doctorProfile.isAvailable,
        workplaceName: user.doctorProfile.workplaceName,
        workplaceAddress: user.doctorProfile.workplaceAddress,
        location: user.doctorProfile.location
          ? {
              city: user.doctorProfile.location.city,
              addressLine: user.doctorProfile.location.addressLine,
              latitude: decimalToNumber(user.doctorProfile.location.latitude),
              longitude: decimalToNumber(user.doctorProfile.location.longitude),
            }
          : null,
      }
    : null,
  patientProfile: user.patientProfile
    ? {
        id: user.patientProfile.id,
        availablePoints: user.patientProfile.availablePoints,
        lifetimePoints: user.patientProfile.lifetimePoints,
        referralCodeUsed: user.patientProfile.referralCodeUsed,
        city: user.patientProfile.city,
        homeAddress: user.patientProfile.homeAddress,
        latitude: decimalToNumber(user.patientProfile.latitude),
        longitude: decimalToNumber(user.patientProfile.longitude),
        dateOfBirth: user.patientProfile.dateOfBirth
          ? user.patientProfile.dateOfBirth.toISOString().slice(0, 10)
          : null,
        gender: user.patientProfile.gender,
        emergencyContactName: user.patientProfile.emergencyContactName,
        emergencyContactPhone: user.patientProfile.emergencyContactPhone,
        allergies: user.patientProfile.allergies,
        chronicConditions: user.patientProfile.chronicConditions,
        currentMedications: user.patientProfile.currentMedications,
        mobilityNotes: user.patientProfile.mobilityNotes,
        communicationPreferences: user.patientProfile.communicationPreferences,
        notes: user.patientProfile.notes,
        referredDoctorName: user.patientProfile.referredByDoctor?.user.fullName ?? null,
        primaryDoctorName: user.patientProfile.primaryDoctor?.user.fullName ?? null,
        consents: user.patientProfile.consents.map((consent) => ({
          id: consent.id,
          type: consent.type,
          version: consent.version,
          grantedAt: consent.grantedAt,
          revokedAt: consent.revokedAt,
          source: consent.source,
        })),
      }
    : null,
});

export const startPhoneAuth = async (input: StartPhoneAuthInput) => {
  const phoneNumber = normalizePhoneNumber(input.phoneNumber);
  const existingUser = await prisma.user.findUnique({
    where: { phoneNumber },
  });

  if (existingUser && existingUser.status !== 'ACTIVE') {
    throw new ApiError(403, 'This account is disabled');
  }

  await prisma.authChallenge.updateMany({
    where: {
      phoneNumber,
      consumedAt: null,
    },
    data: {
      consumedAt: new Date(),
    },
  });

  const purpose = input.intent ?? (existingUser ? OtpPurpose.LOGIN : OtpPurpose.REGISTER);
  const challenge = await prisma.authChallenge.create({
    data: {
      phoneNumber,
      purpose,
      otpCode: env.OTP_DEFAULT_CODE,
      expiresAt: new Date(Date.now() + 1000 * 60 * 5),
      userId: existingUser?.id,
      metadata: {
        isMockOtp: true,
      },
    },
  });

  return {
    challengeId: challenge.id,
    phoneNumber,
    isExistingUser: Boolean(existingUser),
    nextStep: existingUser ? 'VERIFY_OTP' : 'COMPLETE_REGISTRATION',
    otpCodePreview: env.NODE_ENV === 'production' ? undefined : env.OTP_DEFAULT_CODE,
  };
};

export const verifyPhoneAuth = async (input: VerifyPhoneAuthInput) => {
  const challenge = await prisma.authChallenge.findUnique({
    where: { id: input.challengeId },
  });

  if (!challenge || challenge.consumedAt) {
    throw new ApiError(404, 'Authentication challenge is no longer active');
  }

  if (challenge.expiresAt < new Date()) {
    throw new ApiError(400, 'Authentication code has expired');
  }

  if (challenge.otpCode !== input.otpCode) {
    throw new ApiError(400, 'Authentication code is incorrect');
  }

  let user = challenge.userId
    ? await prisma.user.findUnique({
        where: { id: challenge.userId },
        include: authUserInclude,
      })
    : await prisma.user.findUnique({
        where: { phoneNumber: challenge.phoneNumber },
        include: authUserInclude,
      });

  if (!user) {
    if (!input.registration) {
      throw new ApiError(400, 'Registration details are required for a new patient');
    }

    const created = await createPatientFromRegistration({
      phoneNumber: challenge.phoneNumber,
      ...input.registration,
    });

    user = await prisma.user.findUnique({
      where: { id: created.user.id },
      include: authUserInclude,
    });
  }

  if (!user) {
    throw new ApiError(500, 'Unable to complete phone authentication');
  }

  if (user.status !== 'ACTIVE') {
    throw new ApiError(403, 'This account is disabled');
  }

  await prisma.authChallenge.update({
    where: { id: challenge.id },
    data: {
      consumedAt: new Date(),
      userId: user.id,
    },
  });

  await prisma.user.update({
    where: { id: user.id },
    data: {
      lastLoginAt: new Date(),
    },
  });

  return {
    token: generateAccessToken(
      buildAuthPayload(
        user.id,
        user.phoneNumber,
        user.role,
        user.permissions,
        user.status
      )
    ),
    user: mapAuthUser(user),
  };
};

export const getMe = async (userId: string) => {
  const user = await prisma.user.findUnique({
    where: { id: userId },
    include: authUserInclude,
  });

  if (!user) {
    throw new ApiError(404, 'User not found');
  }

  return mapAuthUser(user);
};
