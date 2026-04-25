import { NotificationType, Prisma, Role } from '@prisma/client';
import { prisma } from '../../prisma/client.js';
import { ApiError } from '../../utils/ApiError.js';
import { createNotifications } from '../../utils/notifications.js';

export const reviewInclude = {
  appointment: true,
  doctor: {
    include: {
      user: true,
    },
  },
  patientProfile: {
    include: {
      user: true,
    },
  },
} satisfies Prisma.ReviewInclude;

export const mapReview = (review: Prisma.ReviewGetPayload<{ include: typeof reviewInclude }>) => ({
  id: review.id,
  appointmentId: review.appointmentId,
  rating: review.rating,
  comment: review.comment,
  doctorReply: review.doctorReply,
  doctorReplyAt: review.doctorReplyAt,
  isHidden: review.isHidden,
  hiddenReason: review.hiddenReason,
  createdAt: review.createdAt,
  doctor: {
    id: review.doctor.id,
    name: review.doctor.user.fullName,
  },
  patient: {
    id: review.patientProfile.id,
    name: review.patientProfile.user.fullName,
  },
});

const syncDoctorRating = async (doctorId: string) => {
  const aggregation = await prisma.review.aggregate({
    where: {
      doctorId,
      isHidden: false,
    },
    _avg: {
      rating: true,
    },
    _count: {
      _all: true,
    },
  });

  await prisma.doctorProfile.update({
    where: { id: doctorId },
    data: {
      averageRating: aggregation._avg.rating ?? 0,
      reviewCount: aggregation._count._all,
    },
  });
};

export const createReview = async (
  userId: string,
  input: {
    appointmentId: string;
    rating: number;
    comment?: string;
  }
) => {
  const patientProfile = await prisma.patientProfile.findUnique({
    where: { userId },
  });

  if (!patientProfile) {
    throw new ApiError(404, 'Patient profile not found');
  }

  const appointment = await prisma.appointment.findUnique({
    where: { id: input.appointmentId },
  });

  if (!appointment || appointment.patientProfileId !== patientProfile.id) {
    throw new ApiError(404, 'Appointment not found');
  }

  if (appointment.status !== 'COMPLETED') {
    throw new ApiError(400, 'Reviews can only be added after a completed appointment');
  }

  const existing = await prisma.review.findUnique({
    where: { appointmentId: input.appointmentId },
  });

  if (existing) {
    throw new ApiError(400, 'A review already exists for this appointment');
  }

  const review = await prisma.review.create({
    data: {
      appointmentId: input.appointmentId,
      doctorId: appointment.doctorId,
      patientProfileId: patientProfile.id,
      rating: input.rating,
      comment: input.comment,
    },
    include: reviewInclude,
  });

  await syncDoctorRating(review.doctorId);
  await createNotifications([
    {
      userId: review.doctor.userId,
      type: NotificationType.REVIEW_CREATED,
      title: 'New patient review',
      body: `${review.patientProfile.user.fullName} left a ${review.rating}-star review.`,
      data: { reviewId: review.id, appointmentId: review.appointmentId },
    },
  ]);

  return mapReview(review);
};

export const replyToReview = async (
  userId: string,
  reviewId: string,
  doctorReply: string
) => {
  const doctor = await prisma.doctorProfile.findUnique({
    where: { userId },
  });

  if (!doctor) {
    throw new ApiError(404, 'Doctor profile not found');
  }

  const review = await prisma.review.findUnique({
    where: { id: reviewId },
    include: reviewInclude,
  });

  if (!review || review.doctorId !== doctor.id) {
    throw new ApiError(404, 'Review not found');
  }

  const updated = await prisma.review.update({
    where: { id: reviewId },
    data: {
      doctorReply,
      doctorReplyAt: new Date(),
    },
    include: reviewInclude,
  });

  return mapReview(updated);
};

export const moderateReview = async (
  reviewId: string,
  input: {
    isHidden: boolean;
    hiddenReason?: string;
  }
) => {
  const review = await prisma.review.findUnique({
    where: { id: reviewId },
    include: reviewInclude,
  });

  if (!review) {
    throw new ApiError(404, 'Review not found');
  }

  const updated = await prisma.review.update({
    where: { id: reviewId },
    data: {
      isHidden: input.isHidden,
      hiddenReason: input.isHidden ? input.hiddenReason : null,
    },
    include: reviewInclude,
  });

  await syncDoctorRating(updated.doctorId);

  return mapReview(updated);
};

export const listReviews = async (actor: { userId: string; role: Role }) => {
  if (actor.role === Role.DOCTOR) {
    const doctor = await prisma.doctorProfile.findUnique({
      where: { userId: actor.userId },
    });

    if (!doctor) {
      throw new ApiError(404, 'Doctor profile not found');
    }

    const reviews = await prisma.review.findMany({
      where: { doctorId: doctor.id },
      include: reviewInclude,
      orderBy: { createdAt: 'desc' },
    });

    return reviews.map(mapReview);
  }

  if (actor.role === Role.PATIENT) {
    const patient = await prisma.patientProfile.findUnique({
      where: { userId: actor.userId },
    });

    if (!patient) {
      throw new ApiError(404, 'Patient profile not found');
    }

    const reviews = await prisma.review.findMany({
      where: { patientProfileId: patient.id },
      include: reviewInclude,
      orderBy: { createdAt: 'desc' },
    });

    return reviews.map(mapReview);
  }

  const reviews = await prisma.review.findMany({
    include: reviewInclude,
    orderBy: { createdAt: 'desc' },
  });

  return reviews.map(mapReview);
};
