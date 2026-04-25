import { Role } from '@prisma/client';
import { prisma } from '../../prisma/client.js';
import { ApiError } from '../../utils/ApiError.js';
import { getMyPatientReferralSummary } from '../patient/patient.service.js';
import { getDoctorProfileByUserId } from '../doctor/doctor.service.js';

export const validateReferralCode = async (code: string) => {
  const referralCode = code.trim().toUpperCase();
  const doctor = await prisma.doctorProfile.findUnique({
    where: { referralCode },
    include: {
      user: true,
      location: true,
    },
  });

  if (!doctor) {
    throw new ApiError(404, 'Referral code is invalid');
  }

  return {
    doctorId: doctor.id,
    doctorName: doctor.user.fullName,
    referralCode: doctor.referralCode,
    specialty: doctor.specialty,
    city: doctor.location?.city ?? null,
    addressLine: doctor.location?.addressLine ?? null,
  };
};

export const getMyReferralSummary = async (userId: string, role: Role) => {
  if (role === Role.PATIENT) {
    return getMyPatientReferralSummary(userId);
  }

  if (role !== Role.DOCTOR) {
    throw new ApiError(403, 'Referral summary is only available for doctors or patients');
  }

  const doctor = await getDoctorProfileByUserId(userId);
  const events = await prisma.referralEvent.findMany({
    where: { doctorId: doctor.id },
    orderBy: { createdAt: 'desc' },
    include: {
      patientProfile: {
        include: {
          user: true,
        },
      },
      discount: true,
    },
  });

  return {
    referralCode: doctor.referralCode,
    doctorName: doctor.user.fullName,
    referralCount: events.length,
    totalPointsAwarded: events.reduce((sum, event) => sum + event.pointsAwarded, 0),
    events: events.map((event) => ({
      id: event.id,
      type: event.type,
      patientName: event.patientProfile.user.fullName,
      referralCode: event.referralCode,
      pointsAwarded: event.pointsAwarded,
      discount: event.discount
        ? {
            code: event.discount.code,
            title: event.discount.title,
          }
        : null,
      createdAt: event.createdAt,
    })),
  };
};
