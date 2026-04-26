import {
  AppointmentStatus,
  NotificationType,
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
import { calculateDistanceKm, decimalToNumber, isWithinRadiusKm, toDecimalInput } from '../../utils/geo.js';
import { createNotifications, type NotificationInput } from '../../utils/notifications.js';

const requestInclude = {
  patientProfile: {
    include: {
      user: true,
    },
  },
  requestedDoctor: {
    include: {
      user: true,
      location: true,
    },
  },
  assignedDoctor: {
    include: {
      user: true,
      location: true,
    },
  },
  appointment: true,
} satisfies Prisma.ServiceRequestInclude;

const mapRequest = (
  request: Prisma.ServiceRequestGetPayload<{ include: typeof requestInclude }>
) => ({
  id: request.id,
  type: request.type,
  status: request.status,
  serviceAddress: request.serviceAddress,
  city: request.city,
  latitude: decimalToNumber(request.latitude),
  longitude: decimalToNumber(request.longitude),
  preferredStartAt: request.preferredStartAt,
  preferredEndAt: request.preferredEndAt,
  scheduledFor: request.scheduledFor,
  notes: request.notes,
  issueDescription: request.issueDescription,
  distanceKm: decimalToNumber(request.distanceKm),
  isWithinDoctorRange: request.isWithinDoctorRange,
  createdAt: request.createdAt,
  patient: {
    id: request.patientProfile.id,
    name: request.patientProfile.user.fullName,
    phoneNumber: request.patientProfile.user.phoneNumber,
  },
  requestedDoctor: request.requestedDoctor
    ? {
        id: request.requestedDoctor.id,
        name: request.requestedDoctor.user.fullName,
        city: request.requestedDoctor.location?.city ?? null,
      }
    : null,
  assignedDoctor: request.assignedDoctor
    ? {
        id: request.assignedDoctor.id,
        name: request.assignedDoctor.user.fullName,
        city: request.assignedDoctor.location?.city ?? null,
      }
    : null,
  appointment: request.appointment
    ? {
        id: request.appointment.id,
        status: request.appointment.status,
        startsAt: request.appointment.startsAt,
        endsAt: request.appointment.endsAt,
      }
    : null,
});

const selectAdminRecipients = async () =>
  prisma.user.findMany({
    where: {
      role: Role.ADMIN,
      status: UserStatus.ACTIVE,
    },
    select: {
      id: true,
    },
  });

const releaseRejectedAppointmentAllocation = async (
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
      bufferForAppointmentId: null,
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

const getAvailableDoctorMatch = async (input: {
  city: string;
  latitude?: number;
  longitude?: number;
}) => {
  const doctors = await prisma.doctorProfile.findMany({
    where: {
      isAvailable: true,
      user: {
        status: UserStatus.ACTIVE,
      },
    },
    include: {
      user: true,
      location: true,
    },
  });

  const rankedDoctors = doctors
    .map((doctor) => {
      const distanceKm = calculateDistanceKm(
        {
          latitude: decimalToNumber(doctor.location?.latitude),
          longitude: decimalToNumber(doctor.location?.longitude),
        },
        {
          latitude: input.latitude,
          longitude: input.longitude,
        }
      );

      return {
        doctor,
        distanceKm,
        isWithinRange:
          distanceKm === null
            ? doctor.location?.city?.toLowerCase() === input.city.toLowerCase()
            : isWithinRadiusKm(distanceKm, doctor.serviceRadiusKm),
      };
    })
    .filter((item) => item.isWithinRange)
    .sort((first, second) => {
      if (first.distanceKm === null && second.distanceKm === null) {
        return 0;
      }

      if (first.distanceKm === null) {
        return 1;
      }

      if (second.distanceKm === null) {
        return -1;
      }

      return first.distanceKm - second.distanceKm;
    });

  return rankedDoctors[0] ?? null;
};

export const createServiceRequest = async (
  userId: string,
  input: {
    type: ServiceRequestType;
    requestedDoctorId?: string;
    serviceAddress: string;
    city: string;
    latitude?: number;
    longitude?: number;
    preferredStartAt?: string;
    preferredEndAt?: string;
    scheduledFor?: string;
    notes?: string;
    issueDescription?: string;
  }
) => {
  const patientProfile = await prisma.patientProfile.findUnique({
    where: { userId },
  });

  if (!patientProfile) {
    throw new ApiError(404, 'Patient profile not found');
  }

  let assignedDoctorId: string | undefined;
  let requestedDoctorId = input.requestedDoctorId;
  let status: ServiceRequestStatus = ServiceRequestStatus.PENDING;
  let distanceKm: number | null = null;
  let isWithinDoctorRange: boolean | null = null;

  if (input.type === ServiceRequestType.SPECIFIC_DOCTOR) {
    const doctor = await prisma.doctorProfile.findUnique({
      where: { id: input.requestedDoctorId },
      include: { user: true, location: true },
    });

    if (!doctor) {
      throw new ApiError(404, 'Requested doctor was not found');
    }

    requestedDoctorId = doctor.id;
    distanceKm = calculateDistanceKm(
      {
        latitude: decimalToNumber(doctor.location?.latitude),
        longitude: decimalToNumber(doctor.location?.longitude),
      },
      {
        latitude: input.latitude,
        longitude: input.longitude,
      }
    );
    isWithinDoctorRange =
      distanceKm === null
        ? doctor.location?.city?.toLowerCase() === input.city.toLowerCase()
        : isWithinRadiusKm(distanceKm, doctor.serviceRadiusKm);

    if (doctor.isAvailable && isWithinDoctorRange) {
      assignedDoctorId = doctor.id;
      status = ServiceRequestStatus.ASSIGNED;
    }
  } else {
    const match = await getAvailableDoctorMatch({
      city: input.city,
      latitude: input.latitude,
      longitude: input.longitude,
    });

    if (match) {
      assignedDoctorId = match.doctor.id;
      distanceKm = match.distanceKm;
      isWithinDoctorRange = match.isWithinRange;
      status = ServiceRequestStatus.ASSIGNED;
    }
  }

  const request = await prisma.serviceRequest.create({
    data: {
      patientProfileId: patientProfile.id,
      type: input.type,
      requestedDoctorId,
      assignedDoctorId,
      status,
      serviceAddress: input.serviceAddress,
      city: input.city,
      latitude: toDecimalInput(input.latitude),
      longitude: toDecimalInput(input.longitude),
      preferredStartAt: input.preferredStartAt ? new Date(input.preferredStartAt) : undefined,
      preferredEndAt: input.preferredEndAt ? new Date(input.preferredEndAt) : undefined,
      scheduledFor: input.scheduledFor ? new Date(input.scheduledFor) : undefined,
      notes: input.notes,
      issueDescription: input.issueDescription,
      distanceKm: toDecimalInput(distanceKm),
      isWithinDoctorRange,
    },
    include: requestInclude,
  });

  await prisma.patientProfile.update({
    where: { id: patientProfile.id },
    data: {
      city: input.city,
      homeAddress: input.serviceAddress,
      latitude: toDecimalInput(input.latitude),
      longitude: toDecimalInput(input.longitude),
    },
  });

  const admins = await selectAdminRecipients();
  const notificationBatch: NotificationInput[] = admins.map((admin) => ({
    userId: admin.id,
    type: NotificationType.REQUEST_CREATED,
    title: 'New patient request',
    body: `A new service request was created in ${input.city}.`,
    data: { requestId: request.id },
  }));

  if (request.assignedDoctor?.userId) {
    notificationBatch.push({
      userId: request.assignedDoctor.userId,
      type: NotificationType.REQUEST_ASSIGNED,
      title: 'New home-visit request',
      body: `${request.patientProfile.user.fullName} requested a visit in ${request.city}.`,
      data: { requestId: request.id },
    });
  }

  await createNotifications(notificationBatch);

  return mapRequest(request);
};

export const getRequestsForUser = async (userId: string, role: Role) => {
  if (role === Role.PATIENT) {
    const patientProfile = await prisma.patientProfile.findUnique({
      where: { userId },
    });

    if (!patientProfile) {
      throw new ApiError(404, 'Patient profile not found');
    }

    const requests = await prisma.serviceRequest.findMany({
      where: { patientProfileId: patientProfile.id },
      include: requestInclude,
      orderBy: { createdAt: 'desc' },
    });

    return requests.map(mapRequest);
  }

  if (role === Role.DOCTOR) {
    const doctorProfile = await prisma.doctorProfile.findUnique({
      where: { userId },
    });

    if (!doctorProfile) {
      throw new ApiError(404, 'Doctor profile not found');
    }

    const requests = await prisma.serviceRequest.findMany({
      where: {
        OR: [{ assignedDoctorId: doctorProfile.id }, { requestedDoctorId: doctorProfile.id }],
      },
      include: requestInclude,
      orderBy: { createdAt: 'desc' },
    });

    return requests.map(mapRequest);
  }

  const requests = await prisma.serviceRequest.findMany({
    include: requestInclude,
    orderBy: { createdAt: 'desc' },
  });

  return requests.map(mapRequest);
};

export const updateServiceRequestStatus = async (
  userId: string,
  role: Role,
  requestId: string,
  status: ServiceRequestStatus
) => {
  const request = await prisma.serviceRequest.findUnique({
    where: { id: requestId },
    include: requestInclude,
  });

  if (!request) {
    throw new ApiError(404, 'Service request not found');
  }

  if (role === Role.DOCTOR) {
    const doctorProfile = await prisma.doctorProfile.findUnique({
      where: { userId },
    });

    if (!doctorProfile) {
      throw new ApiError(404, 'Doctor profile not found');
    }

    const belongsToDoctor =
      request.assignedDoctorId === doctorProfile.id || request.requestedDoctorId === doctorProfile.id;

    if (!belongsToDoctor) {
      throw new ApiError(403, 'This service request does not belong to the doctor');
    }
  }

  const updated = await prisma.serviceRequest.update({
    where: { id: requestId },
    data: { status },
    include: requestInclude,
  });

  return mapRequest(updated);
};

export const acceptServiceRequest = async (userId: string, requestId: string) => {
  const doctorProfile = await prisma.doctorProfile.findUnique({
    where: { userId },
  });

  if (!doctorProfile) {
    throw new ApiError(404, 'Doctor profile not found');
  }

  const request = await prisma.serviceRequest.findUnique({
    where: { id: requestId },
    include: requestInclude,
  });

  if (!request) {
    throw new ApiError(404, 'Service request not found');
  }

  const belongsToDoctor =
    request.assignedDoctorId === doctorProfile.id || request.requestedDoctorId === doctorProfile.id;

  if (!belongsToDoctor) {
    throw new ApiError(403, 'This service request does not belong to the doctor');
  }

  const updated = await prisma.$transaction(async (tx) => {
    await tx.serviceRequest.update({
      where: { id: requestId },
      data: {
        assignedDoctorId: doctorProfile.id,
        status: ServiceRequestStatus.ACCEPTED,
      },
    });

    if (request.appointment) {
      await tx.appointment.update({
        where: { id: request.appointment.id },
        data: {
          doctorId: doctorProfile.id,
          status: AppointmentStatus.CONFIRMED,
        },
      });
    }

    return tx.serviceRequest.findUnique({
      where: { id: requestId },
      include: requestInclude,
    });
  });

  if (!updated) {
    throw new ApiError(500, 'Service request acceptance could not be finalized');
  }

  await createNotifications([
    {
      userId: updated.patientProfile.userId,
      type: updated.appointment ? NotificationType.APPOINTMENT_CONFIRMED : NotificationType.REQUEST_ASSIGNED,
      title: updated.appointment ? 'Appointment confirmed' : 'Doctor accepted your request',
      body: updated.appointment
        ? `${updated.assignedDoctor?.user.fullName ?? 'A doctor'} confirmed your visit.`
        : `${updated.assignedDoctor?.user.fullName ?? 'A doctor'} accepted the visit request.`,
      data: { requestId: updated.id, appointmentId: updated.appointment?.id, doctorId: updated.assignedDoctorId },
    },
  ]);

  return mapRequest(updated);
};

export const rejectServiceRequest = async (
  userId: string,
  requestId: string,
  reason?: string
) => {
  const doctorProfile = await prisma.doctorProfile.findUnique({
    where: { userId },
  });

  if (!doctorProfile) {
    throw new ApiError(404, 'Doctor profile not found');
  }

  const request = await prisma.serviceRequest.findUnique({
    where: { id: requestId },
    include: requestInclude,
  });

  if (!request) {
    throw new ApiError(404, 'Service request not found');
  }

  const belongsToDoctor =
    request.assignedDoctorId === doctorProfile.id || request.requestedDoctorId === doctorProfile.id;

  if (!belongsToDoctor) {
    throw new ApiError(403, 'This service request does not belong to the doctor');
  }

  const updated = await prisma.$transaction(async (tx) => {
    if (request.appointment) {
      await releaseRejectedAppointmentAllocation(tx, request.appointment.id, request.appointment.slotId);
      await tx.appointment.update({
        where: { id: request.appointment.id },
        data: {
          status: AppointmentStatus.PENDING,
          slotId: null,
        },
      });
    }

    await tx.serviceRequest.update({
      where: { id: requestId },
      data: {
        assignedDoctorId: null,
        status: ServiceRequestStatus.MATCHING,
        notes: reason ? `${request.notes ? `${request.notes}\n` : ''}Doctor rejection: ${reason}` : request.notes,
      },
    });

    return tx.serviceRequest.findUnique({
      where: { id: requestId },
      include: requestInclude,
    });
  });

  if (!updated) {
    throw new ApiError(500, 'Service request rejection could not be finalized');
  }

  const admins = await selectAdminRecipients();
  await createNotifications([
    ...admins.map((admin) => ({
      userId: admin.id,
      type: NotificationType.ADMIN_ALERT,
      title: 'Doctor rejected request',
      body: `${request.requestedDoctor?.user.fullName ?? request.assignedDoctor?.user.fullName ?? 'Doctor'} rejected a patient request and it needs admin finalization.`,
      data: { requestId: updated.id, appointmentId: updated.appointment?.id, reason },
    })),
    {
      userId: updated.patientProfile.userId,
      type: NotificationType.GENERAL,
      title: 'Booking sent to admin review',
      body: 'The doctor could not take this visit. Admin will review and finalize the booking.',
      data: { requestId: updated.id, appointmentId: updated.appointment?.id },
    },
  ]);

  return mapRequest(updated);
};

export const assignDoctorToRequest = async (requestId: string, doctorId: string) => {
  const [doctor, request] = await Promise.all([
    prisma.doctorProfile.findUnique({
      where: { id: doctorId },
      include: {
        user: true,
        location: true,
      },
    }),
    prisma.serviceRequest.findUnique({
      where: { id: requestId },
      include: requestInclude,
    }),
  ]);

  if (!doctor) {
    throw new ApiError(404, 'Doctor profile not found');
  }

  if (!request) {
    throw new ApiError(404, 'Service request not found');
  }

  const distanceKm = calculateDistanceKm(
    {
      latitude: decimalToNumber(doctor.location?.latitude),
      longitude: decimalToNumber(doctor.location?.longitude),
    },
    {
      latitude: decimalToNumber(request.latitude),
      longitude: decimalToNumber(request.longitude),
    }
  );

  const updated = await prisma.$transaction(async (tx) => {
    await tx.serviceRequest.update({
      where: { id: requestId },
      data: {
        assignedDoctorId: doctor.id,
        requestedDoctorId: request.requestedDoctorId ?? doctor.id,
        status: ServiceRequestStatus.ASSIGNED,
        distanceKm: toDecimalInput(distanceKm),
        isWithinDoctorRange:
          distanceKm === null
            ? doctor.location?.city?.toLowerCase() === request.city.toLowerCase()
            : isWithinRadiusKm(distanceKm, doctor.serviceRadiusKm),
      },
    });

    if (request.appointment) {
      await tx.appointment.update({
        where: { id: request.appointment.id },
        data: {
          doctorId: doctor.id,
          status: AppointmentStatus.PENDING,
        },
      });
    }

    return tx.serviceRequest.findUnique({
      where: { id: requestId },
      include: requestInclude,
    });
  });

  if (!updated) {
    throw new ApiError(500, 'Doctor assignment could not be finalized');
  }

  await createNotifications([
    {
      userId: doctor.userId,
      type: NotificationType.REQUEST_ASSIGNED,
      title: 'Request assigned',
      body: `${updated.patientProfile.user.fullName} was assigned to you.`,
      data: { requestId: updated.id, appointmentId: updated.appointment?.id },
    },
    {
      userId: updated.patientProfile.userId,
      type: NotificationType.GENERAL,
      title: 'Admin reassigned your booking',
      body: `${doctor.user.fullName} was assigned to review and confirm your visit.`,
      data: { requestId: updated.id, appointmentId: updated.appointment?.id, doctorId: doctor.id },
    },
  ]);

  return mapRequest(updated);
};
