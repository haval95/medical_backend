import { AppointmentStatus, ScheduleSlotStatus, ServiceRequestStatus, UserStatus, } from '@prisma/client';
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
};
const visibleReviewInclude = {
    patientProfile: {
        include: {
            user: true,
        },
    },
};
const workingHourDays = [
    'MONDAY',
    'TUESDAY',
    'WEDNESDAY',
    'THURSDAY',
    'FRIDAY',
    'SATURDAY',
    'SUNDAY',
];
const timePattern = /^\d{2}:\d{2}$/;
const normalizeGeneralWorkingHours = (value) => {
    const defaults = new Map(workingHourDays.map((day) => [day, { day, isActive: false }]));
    if (Array.isArray(value)) {
        for (const entry of value) {
            if (!entry || typeof entry !== 'object' || Array.isArray(entry)) {
                continue;
            }
            const candidate = entry;
            const day = candidate.day;
            if (typeof day !== 'string' || !workingHourDays.includes(day)) {
                continue;
            }
            const startTime = typeof candidate.startTime === 'string' && timePattern.test(candidate.startTime)
                ? candidate.startTime
                : undefined;
            const endTime = typeof candidate.endTime === 'string' && timePattern.test(candidate.endTime)
                ? candidate.endTime
                : undefined;
            const isActive = Boolean(candidate.isActive) && Boolean(startTime && endTime);
            defaults.set(day, {
                day: day,
                isActive,
                startTime: isActive ? startTime : undefined,
                endTime: isActive ? endTime : undefined,
            });
        }
    }
    return workingHourDays.map((day) => defaults.get(day));
};
const serializeGeneralWorkingHours = (value) => value
    ? value.map((entry) => ({
        day: entry.day,
        isActive: entry.isActive,
        startTime: entry.isActive ? entry.startTime ?? null : null,
        endTime: entry.isActive ? entry.endTime ?? null : null,
    }))
    : undefined;
const serializeCredential = (credential) => ({
    id: credential.id,
    type: credential.type,
    title: credential.title,
    issuer: credential.issuer,
    awardedAt: credential.awardedAt,
    documentUrl: credential.documentUrl,
    notes: credential.notes,
});
const mapDoctorCard = (doctor, patientLocation, extras) => {
    const consultationFee = doctor.consultationFee ?? 0;
    const doctorLatitude = decimalToNumber(doctor.location?.latitude);
    const doctorLongitude = decimalToNumber(doctor.location?.longitude);
    const distanceKm = calculateDistanceKm({
        latitude: doctorLatitude,
        longitude: doctorLongitude,
    }, patientLocation ?? {});
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
        consultationFee,
        isAvailable: doctor.isAvailable,
        serviceRadiusKm: doctor.serviceRadiusKm,
        defaultSlotMinutes: doctor.defaultSlotMinutes,
        defaultBufferMinutes: doctor.defaultBufferMinutes,
        generalWorkingHours: normalizeGeneralWorkingHours(doctor.generalWorkingHours),
        averageRating: decimalToNumber(doctor.averageRating) ?? 0,
        reviewCount: doctor.reviewCount,
        completedVisitCount: doctor.completedVisitCount,
        patientCount: extras?.patientCount ?? 0,
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
const mapVisibleReview = (review) => ({
    id: review.id,
    rating: review.rating,
    comment: review.comment,
    doctorReply: review.doctorReply,
    doctorReplyAt: review.doctorReplyAt,
    patientName: review.patientProfile.user.fullName,
    createdAt: review.createdAt,
});
const getPatientLocationContext = async (userId) => {
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
const getDoctorProfileById = async (doctorId) => {
    const doctor = await prisma.doctorProfile.findUnique({
        where: { id: doctorId },
        include: doctorInclude,
    });
    if (!doctor) {
        throw new ApiError(404, 'Doctor profile not found');
    }
    return doctor;
};
const getDoctorPatientCount = async (doctorId) => {
    const patients = await prisma.appointment.findMany({
        where: {
            doctorId,
            status: {
                notIn: [AppointmentStatus.REJECTED],
            },
        },
        distinct: ['patientProfileId'],
        select: {
            patientProfileId: true,
        },
    });
    return patients.length;
};
const ACTIVE_APPOINTMENT_STATUSES = [
    AppointmentStatus.PENDING,
    AppointmentStatus.CONFIRMED,
    AppointmentStatus.IN_PROGRESS,
    AppointmentStatus.CANCELLATION_REQUESTED,
];
const rangesOverlap = (first, second) => first.startsAt < second.endsAt && first.endsAt > second.startsAt;
const startOfScheduleDate = (value) => new Date(`${value}T00:00:00`);
const endOfScheduleDate = (value) => {
    const result = startOfScheduleDate(value);
    result.setDate(result.getDate() + 1);
    return result;
};
const mapDoctorScheduleSlot = (slot) => ({
    id: slot.id,
    startsAt: slot.startsAt,
    endsAt: slot.endsAt,
    status: slot.status,
    isBuffer: slot.isBuffer,
    blockedReason: slot.blockedReason,
    appointment: slot.appointment
        ? {
            id: slot.appointment.id,
            status: slot.appointment.status,
            patientProfile: {
                user: {
                    fullName: slot.appointment.patientProfile.user.fullName,
                },
            },
        }
        : null,
});
export const getDoctorProfileByUserId = async (userId) => {
    const doctor = await prisma.doctorProfile.findUnique({
        where: { userId },
        include: doctorInclude,
    });
    if (!doctor) {
        throw new ApiError(404, 'Doctor profile not found');
    }
    return doctor;
};
export const listDoctors = async (viewerUserId) => {
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
export const getDoctorDetails = async (doctorId, viewerUserId) => {
    const patientLocation = await getPatientLocationContext(viewerUserId);
    const doctor = await getDoctorProfileById(doctorId);
    const [reviews, availableSlots, patientCount] = await Promise.all([
        prisma.review.findMany({
            where: {
                doctorId,
                isHidden: false,
            },
            include: visibleReviewInclude,
            orderBy: { createdAt: 'desc' },
            take: 3,
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
        getDoctorPatientCount(doctorId),
    ]);
    return {
        ...mapDoctorCard(doctor, patientLocation ?? undefined, { patientCount }),
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
export const getDoctorReviews = async (doctorId) => {
    await getDoctorProfileById(doctorId);
    const reviews = await prisma.review.findMany({
        where: {
            doctorId,
            isHidden: false,
        },
        include: visibleReviewInclude,
        orderBy: [{ createdAt: 'desc' }],
        take: 100,
    });
    return reviews.map(mapVisibleReview);
};
export const getMyDoctorSummary = async (userId) => {
    const doctor = await getDoctorProfileByUserId(userId);
    const [activePatients, pendingRequests, recentRequests, referralStats, upcomingAppointments, slotCounts] = await Promise.all([
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
        scheduleCounts: slotCounts.reduce((accumulator, item) => {
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
export const updateDoctorLocationById = async (doctorId, input) => prisma.doctorLocation.upsert({
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
export const updateMyDoctorLocation = async (userId, input) => {
    const doctor = await getDoctorProfileByUserId(userId);
    return updateDoctorLocationById(doctor.id, input);
};
export const updateDoctorProfileById = async (doctorId, input) => {
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
                consultationFee: input.consultationFee,
                languages: input.languages,
                serviceRadiusKm: input.serviceRadiusKm,
                defaultSlotMinutes: input.defaultSlotMinutes,
                defaultBufferMinutes: input.defaultBufferMinutes,
                generalWorkingHours: input.generalWorkingHours === undefined
                    ? undefined
                    : serializeGeneralWorkingHours(input.generalWorkingHours),
                isAvailable: input.isAvailable,
                workplaceName: input.workplaceName === undefined ? undefined : input.workplaceName,
                workplaceAddress: input.workplaceAddress === undefined ? undefined : input.workplaceAddress,
                workplaceLatitude: input.workplaceLatitude === undefined
                    ? undefined
                    : toDecimalInput(input.workplaceLatitude),
                workplaceLongitude: input.workplaceLongitude === undefined
                    ? undefined
                    : toDecimalInput(input.workplaceLongitude),
            },
        });
        return tx.doctorProfile.findUnique({
            where: { id: doctorId },
            include: doctorInclude,
        });
    });
    if (input.photoUrl !== undefined &&
        previousPhotoUrl &&
        previousPhotoUrl !== input.photoUrl) {
        const previousKey = getManagedUploadKeyFromUrl(previousPhotoUrl);
        if (previousKey) {
            await deleteFileFromSpaces(previousKey).catch((error) => {
                console.error('Failed to delete previous doctor profile photo from Spaces', error);
            });
        }
    }
    if (!updatedDoctor) {
        throw new ApiError(500, 'Doctor profile could not be updated');
    }
    return mapDoctorCard(updatedDoctor);
};
export const updateMyDoctorProfile = async (userId, input) => {
    const doctor = await getDoctorProfileByUserId(userId);
    return updateDoctorProfileById(doctor.id, input);
};
export const updateMyDoctorAvailability = async (userId, input) => {
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
export const listDoctorSlots = async (doctorId, from, to) => prisma.doctorScheduleSlot
    .findMany({
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
})
    .then((slots) => slots.map(mapDoctorScheduleSlot));
export const createDoctorScheduleSlot = async (doctorId, input) => {
    const startsAt = new Date(input.startsAt);
    const endsAt = new Date(input.endsAt);
    if (startsAt >= endsAt) {
        throw new ApiError(400, 'Slot end time must be after the start time');
    }
    const overlapping = await prisma.doctorScheduleSlot.findFirst({
        where: {
            doctorId,
            startsAt: {
                lt: endsAt,
            },
            endsAt: {
                gt: startsAt,
            },
            status: {
                in: [ScheduleSlotStatus.AVAILABLE, ScheduleSlotStatus.BOOKED, ScheduleSlotStatus.BLOCKED, ScheduleSlotStatus.UNAVAILABLE],
            },
        },
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
    if (overlapping) {
        throw new ApiError(400, 'This slot overlaps an existing schedule block');
    }
    const created = await prisma.doctorScheduleSlot.create({
        data: {
            doctorId,
            startsAt,
            endsAt,
            status: ScheduleSlotStatus.AVAILABLE,
            sourceLabel: input.sourceLabel ?? 'MANUAL_SLOT',
        },
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
    return mapDoctorScheduleSlot(created);
};
export const createMyDoctorScheduleSlot = async (userId, input) => {
    const doctor = await getDoctorProfileByUserId(userId);
    return createDoctorScheduleSlot(doctor.id, input);
};
export const updateDoctorScheduleSlot = async (doctorId, slotId, input) => {
    const slot = await prisma.doctorScheduleSlot.findFirst({
        where: {
            id: slotId,
            doctorId,
        },
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
    if (!slot) {
        throw new ApiError(404, 'Schedule slot not found');
    }
    if (slot.appointment || slot.status === ScheduleSlotStatus.BOOKED) {
        throw new ApiError(400, 'Booked schedule slots cannot be edited');
    }
    const startsAt = input.startsAt ? new Date(input.startsAt) : slot.startsAt;
    const endsAt = input.endsAt ? new Date(input.endsAt) : slot.endsAt;
    if (startsAt >= endsAt) {
        throw new ApiError(400, 'Slot end time must be after the start time');
    }
    const overlapping = await prisma.doctorScheduleSlot.findFirst({
        where: {
            doctorId,
            id: {
                not: slotId,
            },
            startsAt: {
                lt: endsAt,
            },
            endsAt: {
                gt: startsAt,
            },
        },
    });
    if (overlapping) {
        throw new ApiError(400, 'This slot overlaps an existing schedule block');
    }
    const updated = await prisma.doctorScheduleSlot.update({
        where: { id: slotId },
        data: {
            startsAt,
            endsAt,
            blockedReason: input.blockedReason === undefined ? undefined : input.blockedReason,
            status: input.status ?? slot.status,
            isBuffer: false,
            bufferForAppointmentId: null,
        },
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
    return mapDoctorScheduleSlot(updated);
};
export const updateMyDoctorScheduleSlot = async (userId, slotId, input) => {
    const doctor = await getDoctorProfileByUserId(userId);
    return updateDoctorScheduleSlot(doctor.id, slotId, input);
};
export const deleteDoctorScheduleSlot = async (doctorId, slotId) => {
    const slot = await prisma.doctorScheduleSlot.findFirst({
        where: {
            id: slotId,
            doctorId,
        },
        include: {
            appointment: true,
        },
    });
    if (!slot) {
        throw new ApiError(404, 'Schedule slot not found');
    }
    if (slot.appointment || slot.status === ScheduleSlotStatus.BOOKED) {
        throw new ApiError(400, 'Booked schedule slots cannot be deleted');
    }
    await prisma.doctorScheduleSlot.delete({
        where: { id: slotId },
    });
};
export const deleteMyDoctorScheduleSlot = async (userId, slotId) => {
    const doctor = await getDoctorProfileByUserId(userId);
    return deleteDoctorScheduleSlot(doctor.id, slotId);
};
export const createScheduleTemplateForDoctor = async (doctorId, input) => {
    const doctor = await getDoctorProfileById(doctorId);
    const resolvedSlotMinutes = input.slotMinutes ?? doctor.defaultSlotMinutes;
    const allGeneratedSlots = buildScheduleSlots({
        ...input,
        slotMinutes: resolvedSlotMinutes,
    });
    const now = new Date();
    const scheduleRangeStart = startOfScheduleDate(input.fromDate);
    const scheduleRangeEnd = endOfScheduleDate(input.toDate);
    const mutableRangeStart = scheduleRangeStart.getTime() > now.getTime() ? scheduleRangeStart : now;
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
        .filter((slot) => Boolean(slot.appointment && slot.appointment.bufferMinutes > 0))
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
        .filter((slot) => !activeAppointmentRanges.some((appointmentRange) => rangesOverlap(slot, appointmentRange)))
        .map((slot) => {
        const overlappingUnavailability = unavailabilityWindows.find((window) => rangesOverlap(slot, window));
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
                blockedReason: slot.endsAt <= overlappingBuffer.appointmentStartsAt
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
export const createMyScheduleTemplate = async (userId, input) => {
    const doctor = await getDoctorProfileByUserId(userId);
    return createScheduleTemplateForDoctor(doctor.id, input);
};
export const createDoctorUnavailability = async (doctorId, input) => {
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
        throw new ApiError(400, 'This unavailability range overlaps with booked appointments. Resolve those appointments first.');
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
export const createMyDoctorUnavailability = async (userId, input) => {
    const doctor = await getDoctorProfileByUserId(userId);
    return createDoctorUnavailability(doctor.id, input);
};
