import {
  AppointmentStatus,
  NotificationType,
  PointsTransactionType,
  Prisma,
  Role,
  ScheduleSlotStatus,
  ServiceRequestStatus,
  ServiceRequestType,
  UserStatus,
} from '@prisma/client';
import { prisma } from '../../prisma/client.js';
import type { PrismaExecutor } from '../../prisma/client.js';
import { ApiError } from '../../utils/ApiError.js';
import { createNotifications } from '../../utils/notifications.js';
import { toDecimalInput } from '../../utils/geo.js';
import { applyPointsTransaction } from '../points/points.service.js';

export const appointmentInclude = {
  patientProfile: {
    include: {
      user: true,
    },
  },
  doctor: {
    include: {
      user: true,
      location: true,
    },
  },
  serviceRequest: true,
  slot: true,
  review: true,
  visitDetail: true,
} satisfies Prisma.AppointmentInclude;

const normalizeText = (value?: string | null) => value?.trim() || null;

const hasVisitDetailsPayload = (
  input?: {
    chiefComplaint?: string;
    symptoms?: string;
    clinicalNotes?: string;
    diagnosis?: string;
    treatmentProvided?: string;
    followUpInstructions?: string;
    followUpRecommendedAt?: string;
    bloodPressureSystolic?: number;
    bloodPressureDiastolic?: number;
    heartRate?: number;
    temperatureC?: number;
    oxygenSaturation?: number;
    weightKg?: number;
    heightCm?: number;
  }
) =>
  Boolean(
    input &&
      Object.values(input).some((value) => value !== undefined && value !== null && value !== '')
  );

const buildVisitDetailWriteInput = (input?: {
  chiefComplaint?: string;
  symptoms?: string;
  clinicalNotes?: string;
  diagnosis?: string;
  treatmentProvided?: string;
  followUpInstructions?: string;
  followUpRecommendedAt?: string;
  bloodPressureSystolic?: number;
  bloodPressureDiastolic?: number;
  heartRate?: number;
  temperatureC?: number;
  oxygenSaturation?: number;
  weightKg?: number;
  heightCm?: number;
}): Omit<Prisma.VisitDetailUncheckedCreateInput, 'appointmentId'> | undefined => {
  if (!hasVisitDetailsPayload(input)) {
    return undefined;
  }

  return {
    chiefComplaint: normalizeText(input?.chiefComplaint),
    symptoms: normalizeText(input?.symptoms),
    clinicalNotes: normalizeText(input?.clinicalNotes),
    diagnosis: normalizeText(input?.diagnosis),
    treatmentProvided: normalizeText(input?.treatmentProvided),
    followUpInstructions: normalizeText(input?.followUpInstructions),
    followUpRecommendedAt: input?.followUpRecommendedAt
      ? new Date(input.followUpRecommendedAt)
      : null,
    bloodPressureSystolic: input?.bloodPressureSystolic ?? null,
    bloodPressureDiastolic: input?.bloodPressureDiastolic ?? null,
    heartRate: input?.heartRate ?? null,
    temperatureC:
      input?.temperatureC === undefined ? null : toDecimalInput(input.temperatureC),
    oxygenSaturation: input?.oxygenSaturation ?? null,
    weightKg: input?.weightKg === undefined ? null : toDecimalInput(input.weightKg),
    heightCm: input?.heightCm === undefined ? null : toDecimalInput(input.heightCm),
  };
};

const buildVisitSummary = (
  visitSummary?: string,
  visitDetails?: {
    chiefComplaint?: string;
    diagnosis?: string;
    treatmentProvided?: string;
    followUpInstructions?: string;
  }
) => {
  if (visitSummary?.trim()) {
    return visitSummary.trim();
  }

  const generated = [
    visitDetails?.chiefComplaint,
    visitDetails?.diagnosis,
    visitDetails?.treatmentProvided,
    visitDetails?.followUpInstructions,
  ]
    .map((value) => value?.trim())
    .filter(Boolean)
    .join(' | ');

  return generated || 'Visit completed.';
};

const mapVisitDetail = (
  detail: Prisma.VisitDetailGetPayload<Record<string, never>> | null | undefined
) =>
  detail
    ? {
        id: detail.id,
        chiefComplaint: detail.chiefComplaint,
        symptoms: detail.symptoms,
        clinicalNotes: detail.clinicalNotes,
        diagnosis: detail.diagnosis,
        treatmentProvided: detail.treatmentProvided,
        followUpInstructions: detail.followUpInstructions,
        followUpRecommendedAt: detail.followUpRecommendedAt,
        bloodPressureSystolic: detail.bloodPressureSystolic,
        bloodPressureDiastolic: detail.bloodPressureDiastolic,
        heartRate: detail.heartRate,
        temperatureC: detail.temperatureC ? detail.temperatureC.toNumber() : null,
        oxygenSaturation: detail.oxygenSaturation,
        weightKg: detail.weightKg ? detail.weightKg.toNumber() : null,
        heightCm: detail.heightCm ? detail.heightCm.toNumber() : null,
      }
    : null;

export const mapAppointment = (
  appointment: Prisma.AppointmentGetPayload<{ include: typeof appointmentInclude }>
) => ({
  id: appointment.id,
  status: appointment.status,
  startsAt: appointment.startsAt,
  endsAt: appointment.endsAt,
  patientAddress: appointment.patientAddress,
  city: appointment.city,
  latitude: appointment.latitude ? appointment.latitude.toNumber() : null,
  longitude: appointment.longitude ? appointment.longitude.toNumber() : null,
  notes: appointment.notes,
  cancellationReason: appointment.cancellationReason,
  cancellationResolutionNote: appointment.cancellationResolutionNote,
  visitSummary: appointment.visitSummary,
  createdByRole: appointment.createdByRole,
  slotDurationMinutes: appointment.slotDurationMinutes,
  bufferMinutes: appointment.bufferMinutes,
  completedAt: appointment.completedAt,
  createdAt: appointment.createdAt,
  patient: {
    id: appointment.patientProfile.id,
    name: appointment.patientProfile.user.fullName,
    phoneNumber: appointment.patientProfile.user.phoneNumber,
    dateOfBirth: appointment.patientProfile.dateOfBirth
      ? appointment.patientProfile.dateOfBirth.toISOString().slice(0, 10)
      : null,
    gender: appointment.patientProfile.gender,
    emergencyContactName: appointment.patientProfile.emergencyContactName,
    emergencyContactPhone: appointment.patientProfile.emergencyContactPhone,
    allergies: appointment.patientProfile.allergies,
    chronicConditions: appointment.patientProfile.chronicConditions,
    currentMedications: appointment.patientProfile.currentMedications,
    mobilityNotes: appointment.patientProfile.mobilityNotes,
    communicationPreferences: appointment.patientProfile.communicationPreferences,
    notes: appointment.patientProfile.notes,
  },
  doctor: {
    id: appointment.doctor.id,
    name: appointment.doctor.user.fullName,
    phoneNumber: appointment.doctor.user.phoneNumber,
    specialty: appointment.doctor.specialty,
    location: appointment.doctor.location
      ? {
          city: appointment.doctor.location.city,
          addressLine: appointment.doctor.location.addressLine,
          latitude: appointment.doctor.location.latitude
            ? appointment.doctor.location.latitude.toNumber()
            : null,
          longitude: appointment.doctor.location.longitude
            ? appointment.doctor.location.longitude.toNumber()
            : null,
        }
      : null,
  },
  serviceRequest: appointment.serviceRequest
    ? {
        id: appointment.serviceRequest.id,
        status: appointment.serviceRequest.status,
      }
    : null,
  slot: appointment.slot
    ? {
        id: appointment.slot.id,
        status: appointment.slot.status,
        startsAt: appointment.slot.startsAt,
        endsAt: appointment.slot.endsAt,
      }
    : null,
  review: appointment.review
    ? {
        id: appointment.review.id,
        rating: appointment.review.rating,
        comment: appointment.review.comment,
        doctorReply: appointment.review.doctorReply,
        isHidden: appointment.review.isHidden,
      }
    : null,
  visitDetail: mapVisitDetail(appointment.visitDetail),
});

const getAdminRecipients = async () =>
  prisma.user.findMany({
    where: {
      role: Role.ADMIN,
      status: UserStatus.ACTIVE,
    },
    select: { id: true },
  });

export const releaseAppointmentSlots = async (
  tx: PrismaExecutor,
  appointmentId: string,
  slotId?: string | null
) => {
  if (!slotId) {
    return;
  }

  await tx.doctorScheduleSlot.update({
    where: { id: slotId },
    data: {
      status: ScheduleSlotStatus.AVAILABLE,
      blockedReason: null,
      isBuffer: false,
    },
  });

  await tx.doctorScheduleSlot.updateMany({
    where: {
      bufferForAppointmentId: appointmentId,
    },
    data: {
      status: ScheduleSlotStatus.AVAILABLE,
      blockedReason: null,
      isBuffer: false,
      bufferForAppointmentId: null,
    },
  });
};

const reserveAdjacentTravelBuffers = async (
  tx: PrismaExecutor,
  doctorId: string,
  startsAt: Date,
  endsAt: Date,
  appointmentId: string,
  bufferMinutes: number
) => {
  if (bufferMinutes <= 0) {
    return;
  }

  const bufferStart = new Date(startsAt.getTime() - bufferMinutes * 60 * 1000);
  const bufferEnd = new Date(endsAt.getTime() + bufferMinutes * 60 * 1000);

  await Promise.all([
    tx.doctorScheduleSlot.updateMany({
      where: {
        doctorId,
        status: ScheduleSlotStatus.AVAILABLE,
        startsAt: {
          lt: startsAt,
        },
        endsAt: {
          gt: bufferStart,
          lte: startsAt,
        },
      },
      data: {
        status: ScheduleSlotStatus.BLOCKED,
        isBuffer: true,
        blockedReason: 'Travel buffer before appointment',
        bufferForAppointmentId: appointmentId,
      },
    }),
    tx.doctorScheduleSlot.updateMany({
      where: {
        doctorId,
        status: ScheduleSlotStatus.AVAILABLE,
        startsAt: {
          gte: endsAt,
          lt: bufferEnd,
        },
        endsAt: {
          gt: endsAt,
        },
      },
      data: {
        status: ScheduleSlotStatus.BLOCKED,
        isBuffer: true,
        blockedReason: 'Travel buffer after appointment',
        bufferForAppointmentId: appointmentId,
      },
    }),
  ]);
};

const resolveAppointmentWindow = async (
  doctorId: string,
  input: {
    slotId?: string;
    startsAt?: string;
    endsAt?: string;
  }
) => {
  if (input.slotId) {
    const slot = await prisma.doctorScheduleSlot.findUnique({
      where: { id: input.slotId },
    });

    if (!slot || slot.doctorId !== doctorId) {
      throw new ApiError(404, 'Schedule slot not found');
    }

    if (slot.status !== ScheduleSlotStatus.AVAILABLE) {
      throw new ApiError(400, 'This schedule slot is no longer available');
    }

    return {
      slot,
      startsAt: slot.startsAt,
      endsAt: slot.endsAt,
      slotDurationMinutes: Math.max(
        1,
        Math.round((slot.endsAt.getTime() - slot.startsAt.getTime()) / (60 * 1000))
      ),
    };
  }

  if (!input.startsAt || !input.endsAt) {
    throw new ApiError(400, 'Manual appointment time is required');
  }

  const startsAt = new Date(input.startsAt);
  const endsAt = new Date(input.endsAt);

  if (startsAt >= endsAt) {
    throw new ApiError(400, 'Appointment end time must be after the start time');
  }

  const overlappingAppointment = await prisma.appointment.findFirst({
    where: {
      doctorId,
      status: {
        in: [
          AppointmentStatus.PENDING,
          AppointmentStatus.CONFIRMED,
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

  if (overlappingAppointment) {
    throw new ApiError(400, 'This time overlaps another active appointment');
  }

  return {
    slot: null,
    startsAt,
    endsAt,
    slotDurationMinutes: Math.max(1, Math.round((endsAt.getTime() - startsAt.getTime()) / (60 * 1000))),
  };
};

export const createAppointment = async (
  actor: { userId: string; role: Role },
  input: {
    doctorId: string;
    patientProfileId?: string;
    slotId?: string;
    startsAt?: string;
    endsAt?: string;
    serviceRequestId?: string;
    patientAddress: string;
    city: string;
    latitude?: number;
    longitude?: number;
    notes?: string;
    createdByRole?: Role;
  }
) => {
  const patientProfile =
    actor.role === Role.ADMIN && input.patientProfileId
      ? await prisma.patientProfile.findUnique({
          where: { id: input.patientProfileId },
          include: { user: true },
        })
      : await prisma.patientProfile.findUnique({
          where: { userId: actor.userId },
          include: { user: true },
        });

  if (!patientProfile) {
    throw new ApiError(404, 'Patient profile not found');
  }

  const doctor = await prisma.doctorProfile.findUnique({
    where: { id: input.doctorId },
    include: {
      user: true,
    },
  });

  if (!doctor || doctor.user.status !== UserStatus.ACTIVE) {
    throw new ApiError(404, 'Doctor profile not found');
  }

  if (actor.role === Role.PATIENT && !input.slotId) {
    throw new ApiError(403, 'Patients must book through an available schedule slot');
  }

  const resolvedWindow = await resolveAppointmentWindow(doctor.id, {
    slotId: input.slotId,
    startsAt: input.startsAt,
    endsAt: input.endsAt,
  });
  const configuredBufferMinutes = doctor.defaultBufferMinutes ?? 0;
  const bufferMinutes = Math.max(configuredBufferMinutes, resolvedWindow.slotDurationMinutes);

  const appointment = await prisma.$transaction(async (tx) => {
    let serviceRequestId = input.serviceRequestId;

    if (serviceRequestId) {
      const serviceRequest = await tx.serviceRequest.findUnique({
        where: { id: serviceRequestId },
      });

      if (!serviceRequest) {
        throw new ApiError(404, 'Linked service request not found');
      }

      await tx.serviceRequest.update({
        where: { id: serviceRequestId },
        data: {
          requestedDoctorId: doctor.id,
          assignedDoctorId: doctor.id,
          status: ServiceRequestStatus.ASSIGNED,
          scheduledFor: resolvedWindow.startsAt,
          serviceAddress: input.patientAddress,
          city: input.city,
          latitude: toDecimalInput(input.latitude),
          longitude: toDecimalInput(input.longitude),
          notes: input.notes,
        },
      });
    } else {
      const createdRequest = await tx.serviceRequest.create({
        data: {
          patientProfileId: patientProfile.id,
          requestedDoctorId: doctor.id,
          assignedDoctorId: doctor.id,
          type: ServiceRequestType.SPECIFIC_DOCTOR,
          status: ServiceRequestStatus.ASSIGNED,
          serviceAddress: input.patientAddress,
          city: input.city,
          latitude: toDecimalInput(input.latitude),
          longitude: toDecimalInput(input.longitude),
          scheduledFor: resolvedWindow.startsAt,
          notes: input.notes,
          issueDescription: input.notes,
          isWithinDoctorRange: true,
        },
      });

      serviceRequestId = createdRequest.id;
    }

    const createdAppointment = await tx.appointment.create({
      data: {
        serviceRequestId,
        patientProfileId: patientProfile.id,
        doctorId: doctor.id,
        slotId: resolvedWindow.slot?.id,
        status: AppointmentStatus.PENDING,
        startsAt: resolvedWindow.startsAt,
        endsAt: resolvedWindow.endsAt,
        patientAddress: input.patientAddress,
        city: input.city,
        latitude: toDecimalInput(input.latitude),
        longitude: toDecimalInput(input.longitude),
        notes: input.notes,
        createdByRole: input.createdByRole ?? actor.role,
        slotDurationMinutes: resolvedWindow.slotDurationMinutes,
        bufferMinutes,
      },
      include: appointmentInclude,
    });

    if (resolvedWindow.slot) {
      await tx.doctorScheduleSlot.update({
        where: { id: resolvedWindow.slot.id },
        data: {
          status: ScheduleSlotStatus.BOOKED,
        },
      });
    }

    await reserveAdjacentTravelBuffers(
      tx,
      doctor.id,
      resolvedWindow.startsAt,
      resolvedWindow.endsAt,
      createdAppointment.id,
      bufferMinutes
    );

    await tx.patientProfile.update({
      where: { id: patientProfile.id },
      data: {
        city: input.city,
        homeAddress: input.patientAddress,
        latitude: toDecimalInput(input.latitude),
        longitude: toDecimalInput(input.longitude),
      },
    });

    return createdAppointment;
  });

  const admins = await getAdminRecipients();
  await createNotifications([
    {
      userId: doctor.userId,
      type: NotificationType.REQUEST_ASSIGNED,
      title: 'New booking to confirm',
      body: `${patientProfile.user.fullName} requested ${resolvedWindow.startsAt.toLocaleString()}. Confirm or reject it from Requests.`,
      data: { appointmentId: appointment.id, requestId: appointment.serviceRequestId ?? undefined },
    },
    {
      userId: patientProfile.userId,
      type: NotificationType.GENERAL,
      title: 'Booking pending confirmation',
      body: `Your visit with ${doctor.user.fullName} is waiting for doctor confirmation.`,
      data: { appointmentId: appointment.id, requestId: appointment.serviceRequestId ?? undefined },
    },
    ...admins.map((admin) => ({
      userId: admin.id,
      type: NotificationType.ADMIN_ALERT,
      title: 'Pending booking created',
      body: `${patientProfile.user.fullName} booked ${doctor.user.fullName} and is awaiting doctor confirmation.`,
      data: { appointmentId: appointment.id, requestId: appointment.serviceRequestId ?? undefined },
    })),
  ]);

  return mapAppointment(appointment);
};

export const listAppointments = async (
  actor: { userId: string; role: Role },
  filters: {
    doctorId?: string;
    patientProfileId?: string;
    status?: AppointmentStatus;
    from?: string;
    to?: string;
  }
) => {
  if (actor.role === Role.PATIENT) {
    const patientProfile = await prisma.patientProfile.findUnique({
      where: { userId: actor.userId },
    });

    if (!patientProfile) {
      throw new ApiError(404, 'Patient profile not found');
    }

    const appointments = await prisma.appointment.findMany({
      where: {
        patientProfileId: patientProfile.id,
        status: filters.status,
        startsAt: filters.from ? { gte: new Date(filters.from) } : undefined,
        endsAt: filters.to ? { lte: new Date(filters.to) } : undefined,
      },
      include: appointmentInclude,
      orderBy: { startsAt: 'desc' },
    });

    return appointments.map(mapAppointment);
  }

  if (actor.role === Role.DOCTOR) {
    const doctor = await prisma.doctorProfile.findUnique({
      where: { userId: actor.userId },
    });

    if (!doctor) {
      throw new ApiError(404, 'Doctor profile not found');
    }

    const appointments = await prisma.appointment.findMany({
      where: {
        doctorId: doctor.id,
        status: filters.status,
        startsAt: filters.from ? { gte: new Date(filters.from) } : undefined,
        endsAt: filters.to ? { lte: new Date(filters.to) } : undefined,
      },
      include: appointmentInclude,
      orderBy: { startsAt: 'asc' },
    });

    return appointments.map(mapAppointment);
  }

  const appointments = await prisma.appointment.findMany({
    where: {
      doctorId: filters.doctorId,
      patientProfileId: filters.patientProfileId,
      status: filters.status,
      startsAt: filters.from ? { gte: new Date(filters.from) } : undefined,
      endsAt: filters.to ? { lte: new Date(filters.to) } : undefined,
    },
    include: appointmentInclude,
    orderBy: { startsAt: 'desc' },
  });

  return appointments.map(mapAppointment);
};

export const updateAppointmentStatus = async (
  actor: { userId: string; role: Role },
  appointmentId: string,
  status: AppointmentStatus
) => {
  const appointment = await prisma.appointment.findUnique({
    where: { id: appointmentId },
    include: appointmentInclude,
  });

  if (!appointment) {
    throw new ApiError(404, 'Appointment not found');
  }

  if (actor.role === Role.DOCTOR) {
    const doctor = await prisma.doctorProfile.findUnique({
      where: { userId: actor.userId },
    });

    if (!doctor || doctor.id !== appointment.doctorId) {
      throw new ApiError(403, 'This appointment does not belong to the doctor');
    }
  }

  const updated = await prisma.appointment.update({
    where: { id: appointmentId },
    data: {
      status,
    },
    include: appointmentInclude,
  });

  return mapAppointment(updated);
};

export const requestAppointmentCancellation = async (
  actor: { userId: string; role: Role },
  appointmentId: string,
  reason: string
) => {
  const appointment = await prisma.appointment.findUnique({
    where: { id: appointmentId },
    include: appointmentInclude,
  });

  if (!appointment) {
    throw new ApiError(404, 'Appointment not found');
  }

  if (actor.role === Role.DOCTOR) {
    const doctor = await prisma.doctorProfile.findUnique({
      where: { userId: actor.userId },
    });

    if (!doctor || appointment.doctorId !== doctor.id) {
      throw new ApiError(404, 'Appointment not found');
    }
  }

  if (actor.role === Role.PATIENT) {
    const patient = await prisma.patientProfile.findUnique({
      where: { userId: actor.userId },
    });

    if (!patient || appointment.patientProfileId !== patient.id) {
      throw new ApiError(404, 'Appointment not found');
    }
  }

  const updated = await prisma.appointment.update({
    where: { id: appointmentId },
    data: {
      status: AppointmentStatus.CANCELLATION_REQUESTED,
      cancellationRequestedByRole: actor.role,
      cancellationReason: reason,
    },
    include: appointmentInclude,
  });

  const admins = await getAdminRecipients();
  const requesterName =
    actor.role === Role.DOCTOR ? updated.doctor.user.fullName : updated.patientProfile.user.fullName;
  const requesterLabel = actor.role === Role.DOCTOR ? 'Doctor' : 'Patient';
  await createNotifications(admins.map((admin) => ({
    userId: admin.id,
    type: NotificationType.ADMIN_ALERT,
    title: `${requesterLabel} requested cancellation`,
    body: `${requesterName} requested cancellation approval.`,
    data: { appointmentId: updated.id },
  })));

  return mapAppointment(updated);
};

export const rescheduleAppointment = async (
  actor: { userId: string; role: Role },
  appointmentId: string,
  input: {
    slotId?: string;
    startsAt?: string;
    endsAt?: string;
    patientAddress?: string;
    city?: string;
    latitude?: number;
    longitude?: number;
    notes?: string;
  }
) => {
  const appointment = await prisma.appointment.findUnique({
    where: { id: appointmentId },
    include: appointmentInclude,
  });

  if (!appointment) {
    throw new ApiError(404, 'Appointment not found');
  }

  if (actor.role === Role.PATIENT) {
    const patient = await prisma.patientProfile.findUnique({
      where: { userId: actor.userId },
    });

    if (!patient || appointment.patientProfileId !== patient.id) {
      throw new ApiError(404, 'Appointment not found');
    }
  }

  if (appointment.status === AppointmentStatus.COMPLETED) {
    throw new ApiError(400, 'Completed appointments cannot be rescheduled');
  }

  if (actor.role === Role.PATIENT && !input.slotId) {
    throw new ApiError(403, 'Patients must reschedule through an available schedule slot');
  }

  const resolvedWindow = await resolveAppointmentWindow(appointment.doctorId, {
    slotId: input.slotId,
    startsAt: input.startsAt,
    endsAt: input.endsAt,
  });

  const updated = await prisma.$transaction(async (tx) => {
    await releaseAppointmentSlots(tx, appointment.id, appointment.slotId);

    if (resolvedWindow.slot) {
      await tx.doctorScheduleSlot.update({
        where: { id: resolvedWindow.slot.id },
        data: {
          status: ScheduleSlotStatus.BOOKED,
        },
      });
    }

    await reserveAdjacentTravelBuffers(
      tx,
      appointment.doctorId,
      resolvedWindow.startsAt,
      resolvedWindow.endsAt,
      appointment.id,
      appointment.bufferMinutes
    );

    if (appointment.serviceRequestId) {
      await tx.serviceRequest.update({
        where: { id: appointment.serviceRequestId },
        data: {
          scheduledFor: resolvedWindow.startsAt,
          serviceAddress: input.patientAddress ?? appointment.patientAddress,
          city: input.city ?? appointment.city,
          latitude:
            input.latitude === undefined
              ? appointment.latitude
              : toDecimalInput(input.latitude),
          longitude:
            input.longitude === undefined
              ? appointment.longitude
              : toDecimalInput(input.longitude),
          notes: input.notes ?? appointment.notes,
        },
      });
    }

    const next = await tx.appointment.update({
      where: { id: appointment.id },
      data: {
        slotId: resolvedWindow.slot?.id ?? null,
        startsAt: resolvedWindow.startsAt,
        endsAt: resolvedWindow.endsAt,
        patientAddress: input.patientAddress ?? appointment.patientAddress,
        city: input.city ?? appointment.city,
        latitude:
          input.latitude === undefined ? appointment.latitude : toDecimalInput(input.latitude),
        longitude:
          input.longitude === undefined ? appointment.longitude : toDecimalInput(input.longitude),
        notes: input.notes ?? appointment.notes,
        status: AppointmentStatus.PENDING,
      },
      include: appointmentInclude,
    });

    if (appointment.serviceRequestId) {
      await tx.serviceRequest.update({
        where: { id: appointment.serviceRequestId },
        data: {
          status: ServiceRequestStatus.ASSIGNED,
          assignedDoctorId: appointment.doctorId,
          scheduledFor: resolvedWindow.startsAt,
          serviceAddress: input.patientAddress ?? appointment.patientAddress,
          city: input.city ?? appointment.city,
          latitude:
            input.latitude === undefined
              ? appointment.latitude
              : toDecimalInput(input.latitude),
          longitude:
            input.longitude === undefined
              ? appointment.longitude
              : toDecimalInput(input.longitude),
          notes: input.notes ?? appointment.notes,
        },
      });
    }

    return next;
  });

  await createNotifications([
    {
      userId: updated.doctor.userId,
      type: NotificationType.REQUEST_ASSIGNED,
      title: 'Rescheduled booking to confirm',
      body: `${updated.patientProfile.user.fullName} moved the visit to ${updated.startsAt.toLocaleString()}. Confirm or reject it from Requests.`,
      data: { appointmentId: updated.id, requestId: updated.serviceRequestId ?? undefined },
    },
    {
      userId: updated.patientProfile.userId,
      type: NotificationType.GENERAL,
      title: 'Booking update pending confirmation',
      body: `Your updated visit with ${updated.doctor.user.fullName} is waiting for doctor confirmation.`,
      data: { appointmentId: updated.id, requestId: updated.serviceRequestId ?? undefined },
    },
  ]);

  return mapAppointment(updated);
};

export const reviewAppointmentCancellation = async (
  adminUserId: string,
  appointmentId: string,
  input: {
    approve: boolean;
    resolutionNote: string;
  }
) => {
  const appointment = await prisma.appointment.findUnique({
    where: { id: appointmentId },
    include: appointmentInclude,
  });

  if (!appointment) {
    throw new ApiError(404, 'Appointment not found');
  }

  if (appointment.status !== AppointmentStatus.CANCELLATION_REQUESTED) {
    throw new ApiError(400, 'This appointment is not awaiting cancellation approval');
  }

  const updated = await prisma.$transaction(async (tx) => {
    if (input.approve) {
      const cancelled = await tx.appointment.update({
        where: { id: appointmentId },
        data: {
          status: AppointmentStatus.CANCELLED,
          cancellationResolutionNote: input.resolutionNote,
          approvedByAdminId: adminUserId,
        },
        include: appointmentInclude,
      });

      await releaseAppointmentSlots(tx, appointmentId, appointment.slotId);

      if (cancelled.serviceRequestId) {
        await tx.serviceRequest.update({
          where: { id: cancelled.serviceRequestId },
          data: {
            status: ServiceRequestStatus.CANCELLED,
          },
        });
      }

      return cancelled;
    }

    return tx.appointment.update({
      where: { id: appointmentId },
      data: {
        status: AppointmentStatus.CONFIRMED,
        cancellationResolutionNote: input.resolutionNote,
        approvedByAdminId: adminUserId,
      },
      include: appointmentInclude,
    });
  });

  await createNotifications([
    {
      userId: updated.doctor.userId,
      type: NotificationType.APPOINTMENT_CANCELLED,
      title: input.approve ? 'Cancellation approved' : 'Cancellation rejected',
      body: input.approve
        ? 'The appointment cancellation was approved.'
        : 'The appointment cancellation was rejected.',
      data: { appointmentId: updated.id },
    },
    {
      userId: updated.patientProfile.userId,
      type: input.approve
        ? NotificationType.APPOINTMENT_CANCELLED
        : NotificationType.APPOINTMENT_CONFIRMED,
      title: input.approve ? 'Appointment cancelled' : 'Appointment remains confirmed',
      body: input.approve
        ? `${updated.doctor.user.fullName} will not attend this visit.`
        : 'The doctor cancellation request was rejected.',
      data: { appointmentId: updated.id },
    },
  ]);

  return mapAppointment(updated);
};

export const completeAppointment = async (
  userId: string,
  appointmentId: string,
  input: {
    visitSummary?: string;
    visitDetails?: {
      chiefComplaint?: string;
      symptoms?: string;
      clinicalNotes?: string;
      diagnosis?: string;
      treatmentProvided?: string;
      followUpInstructions?: string;
      followUpRecommendedAt?: string;
      bloodPressureSystolic?: number;
      bloodPressureDiastolic?: number;
      heartRate?: number;
      temperatureC?: number;
      oxygenSaturation?: number;
      weightKg?: number;
      heightCm?: number;
    };
  }
) => {
  const doctor = await prisma.doctorProfile.findUnique({
    where: { userId },
  });

  if (!doctor) {
    throw new ApiError(404, 'Doctor profile not found');
  }

  const appointment = await prisma.appointment.findUnique({
    where: { id: appointmentId },
    include: appointmentInclude,
  });

  if (!appointment || appointment.doctorId !== doctor.id) {
    throw new ApiError(404, 'Appointment not found');
  }

  if (appointment.status === AppointmentStatus.COMPLETED) {
    throw new ApiError(400, 'Completed appointment records are locked');
  }

  const visitSummary = buildVisitSummary(input.visitSummary, input.visitDetails);
  const visitDetailData = buildVisitDetailWriteInput(input.visitDetails);

  const updated = await prisma.$transaction(async (tx) => {
    const completed = await tx.appointment.update({
      where: { id: appointmentId },
      data: {
        status: AppointmentStatus.COMPLETED,
        visitSummary,
        completedAt: new Date(),
      },
      include: appointmentInclude,
    });

    if (visitDetailData) {
      await tx.visitDetail.upsert({
        where: { appointmentId },
        update: visitDetailData,
        create: {
          appointmentId,
          ...visitDetailData,
        },
      });
    }

    if (completed.serviceRequestId) {
      await tx.serviceRequest.update({
        where: { id: completed.serviceRequestId },
        data: {
          status: ServiceRequestStatus.COMPLETED,
        },
      });
    }

    await tx.doctorProfile.update({
      where: { id: doctor.id },
      data: {
        completedVisitCount: {
          increment: 1,
        },
      },
    });

    await applyPointsTransaction(tx, completed.patientProfileId, {
      type: PointsTransactionType.SERVICE_COMPLETION,
      points: 25,
      notes: 'Visit completion reward',
      serviceRequestId: completed.serviceRequestId ?? undefined,
    });

    return tx.appointment.findUnique({
      where: { id: appointmentId },
      include: appointmentInclude,
    });
  });

  if (!updated) {
    throw new ApiError(500, 'Appointment completion could not be finalized');
  }

  await createNotifications([
    {
      userId: updated.patientProfile.userId,
      type: NotificationType.APPOINTMENT_COMPLETED,
      title: 'Visit completed',
      body: 'Your doctor completed the visit and shared a summary.',
      data: { appointmentId: updated.id },
    },
  ]);

  return mapAppointment(updated);
};
