import { AppointmentStatus, NotificationType, PointsTransactionType, Role, ScheduleSlotStatus, ServiceRequestStatus, ServiceRequestType, UserStatus, } from '@prisma/client';
import { prisma } from '../../prisma/client.js';
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
};
const normalizeText = (value) => value?.trim() || null;
const hasVisitDetailsPayload = (input) => Boolean(input &&
    Object.values(input).some((value) => value !== undefined && value !== null && value !== ''));
const buildVisitDetailWriteInput = (input) => {
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
        temperatureC: input?.temperatureC === undefined ? null : toDecimalInput(input.temperatureC),
        oxygenSaturation: input?.oxygenSaturation ?? null,
        weightKg: input?.weightKg === undefined ? null : toDecimalInput(input.weightKg),
        heightCm: input?.heightCm === undefined ? null : toDecimalInput(input.heightCm),
    };
};
const buildVisitSummary = (visitSummary, visitDetails) => {
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
const mapVisitDetail = (detail) => detail
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
export const mapAppointment = (appointment) => ({
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
const getAdminRecipients = async () => prisma.user.findMany({
    where: {
        role: Role.ADMIN,
        status: UserStatus.ACTIVE,
    },
    select: { id: true },
});
const releaseAppointmentSlots = async (tx, appointmentId, slotId) => {
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
const reserveAdjacentTravelBuffers = async (tx, doctorId, startsAt, endsAt, appointmentId, bufferMinutes) => {
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
export const createAppointment = async (actor, input) => {
    const patientProfile = actor.role === Role.ADMIN && input.patientProfileId
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
    const [doctor, slot] = await Promise.all([
        prisma.doctorProfile.findUnique({
            where: { id: input.doctorId },
            include: {
                user: true,
            },
        }),
        prisma.doctorScheduleSlot.findUnique({
            where: { id: input.slotId },
        }),
    ]);
    if (!doctor || doctor.user.status !== UserStatus.ACTIVE) {
        throw new ApiError(404, 'Doctor profile not found');
    }
    if (!slot || slot.doctorId !== doctor.id) {
        throw new ApiError(404, 'Schedule slot not found');
    }
    if (slot.status !== ScheduleSlotStatus.AVAILABLE) {
        throw new ApiError(400, 'This schedule slot is no longer available');
    }
    const slotDurationMinutes = Math.max(1, Math.round((slot.endsAt.getTime() - slot.startsAt.getTime()) / (60 * 1000)));
    const configuredBufferMinutes = doctor.defaultBufferMinutes ?? 0;
    const bufferMinutes = Math.max(configuredBufferMinutes, slotDurationMinutes);
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
                    status: ServiceRequestStatus.ACCEPTED,
                    scheduledFor: slot.startsAt,
                    serviceAddress: input.patientAddress,
                    city: input.city,
                    latitude: toDecimalInput(input.latitude),
                    longitude: toDecimalInput(input.longitude),
                    notes: input.notes,
                },
            });
        }
        else {
            const createdRequest = await tx.serviceRequest.create({
                data: {
                    patientProfileId: patientProfile.id,
                    requestedDoctorId: doctor.id,
                    assignedDoctorId: doctor.id,
                    type: ServiceRequestType.SPECIFIC_DOCTOR,
                    status: ServiceRequestStatus.ACCEPTED,
                    serviceAddress: input.patientAddress,
                    city: input.city,
                    latitude: toDecimalInput(input.latitude),
                    longitude: toDecimalInput(input.longitude),
                    scheduledFor: slot.startsAt,
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
                slotId: slot.id,
                status: AppointmentStatus.CONFIRMED,
                startsAt: slot.startsAt,
                endsAt: slot.endsAt,
                patientAddress: input.patientAddress,
                city: input.city,
                latitude: toDecimalInput(input.latitude),
                longitude: toDecimalInput(input.longitude),
                notes: input.notes,
                createdByRole: input.createdByRole ?? actor.role,
                slotDurationMinutes,
                bufferMinutes,
            },
            include: appointmentInclude,
        });
        await tx.doctorScheduleSlot.update({
            where: { id: slot.id },
            data: {
                status: ScheduleSlotStatus.BOOKED,
            },
        });
        await reserveAdjacentTravelBuffers(tx, doctor.id, slot.startsAt, slot.endsAt, createdAppointment.id, bufferMinutes);
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
            type: NotificationType.APPOINTMENT_CONFIRMED,
            title: 'New booked appointment',
            body: `${patientProfile.user.fullName} booked ${slot.startsAt.toLocaleString()}.`,
            data: { appointmentId: appointment.id },
        },
        {
            userId: patientProfile.userId,
            type: NotificationType.APPOINTMENT_CONFIRMED,
            title: 'Appointment confirmed',
            body: `Your visit with ${doctor.user.fullName} is confirmed.`,
            data: { appointmentId: appointment.id },
        },
        ...admins.map((admin) => ({
            userId: admin.id,
            type: NotificationType.ADMIN_ALERT,
            title: 'Appointment booked',
            body: `${patientProfile.user.fullName} booked ${doctor.user.fullName}.`,
            data: { appointmentId: appointment.id },
        })),
    ]);
    return mapAppointment(appointment);
};
export const listAppointments = async (actor, filters) => {
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
export const updateAppointmentStatus = async (actor, appointmentId, status) => {
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
export const requestAppointmentCancellation = async (userId, appointmentId, reason) => {
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
    const updated = await prisma.appointment.update({
        where: { id: appointmentId },
        data: {
            status: AppointmentStatus.CANCELLATION_REQUESTED,
            cancellationRequestedByRole: Role.DOCTOR,
            cancellationReason: reason,
        },
        include: appointmentInclude,
    });
    const admins = await getAdminRecipients();
    await createNotifications(admins.map((admin) => ({
        userId: admin.id,
        type: NotificationType.ADMIN_ALERT,
        title: 'Doctor requested cancellation',
        body: `${updated.doctor.user.fullName} requested cancellation approval.`,
        data: { appointmentId: updated.id },
    })));
    return mapAppointment(updated);
};
export const reviewAppointmentCancellation = async (adminUserId, appointmentId, input) => {
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
export const completeAppointment = async (userId, appointmentId, input) => {
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
