import { AccessReviewStatus, AppointmentStatus, BackupOperationStatus, DiscountStatus, GovernanceRequestStatus, GovernanceRequestType, NotificationDeliveryStatus, Permission, Role, ServiceRequestStatus, SecurityIncidentStatus, UserStatus, } from '@prisma/client';
import { prisma } from '../../prisma/client.js';
import { ApiError } from '../../utils/ApiError.js';
import { decimalToNumber, toDecimalInput } from '../../utils/geo.js';
import { normalizePhoneNumber } from '../../utils/phone.js';
import { getNotificationQueueOverview, processQueuedNotificationDeliveries, } from '../../utils/notifications.js';
import { uploadFileToSpaces } from '../../utils/upload.js';
import { resolvePermissions, rolePermissionDefaults } from '../../utils/permissions.js';
import { grantAdminAdjustment } from '../points/points.service.js';
import { createDoctorUnavailability, createScheduleTemplateForDoctor, listDoctorSlots, updateDoctorLocationById, updateDoctorProfileById, } from '../doctor/doctor.service.js';
import { appointmentInclude, createAppointment, listAppointments, mapAppointment, } from '../appointment/appointment.service.js';
import { listReviews, mapReview, moderateReview, reviewInclude } from '../review/review.service.js';
const adminUserInclude = {
    doctorProfile: {
        include: {
            location: true,
            credentials: true,
        },
    },
    patientProfile: true,
};
const adminDoctorInclude = {
    user: true,
    location: true,
    credentials: true,
};
const adminDoctorListInclude = {
    ...adminDoctorInclude,
    _count: {
        select: {
            appointments: true,
        },
    },
};
const adminPatientInclude = {
    user: true,
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
};
const adminRequestInclude = {
    patientProfile: {
        include: {
            user: true,
        },
    },
    assignedDoctor: {
        include: {
            user: true,
        },
    },
    requestedDoctor: {
        include: {
            user: true,
        },
    },
    appointment: true,
};
const buildPaginatedResult = (items, page, pageSize, totalItems) => {
    const totalPages = Math.max(1, Math.ceil(totalItems / pageSize));
    return {
        items,
        meta: {
            page,
            pageSize,
            totalItems,
            totalPages,
            hasNextPage: page < totalPages,
            hasPreviousPage: page > 1,
        },
    };
};
const parseDateOnly = (value) => value ? new Date(`${value}T00:00:00.000Z`) : undefined;
const formatDateOnly = (value) => value ? value.toISOString().slice(0, 10) : null;
const serializeConsent = (consent) => ({
    id: consent.id,
    type: consent.type,
    version: consent.version,
    grantedAt: consent.grantedAt,
    revokedAt: consent.revokedAt,
    source: consent.source,
});
const serializeConsentJson = (consent) => ({
    id: consent.id,
    type: consent.type,
    version: consent.version,
    grantedAt: consent.grantedAt.toISOString(),
    revokedAt: consent.revokedAt?.toISOString() ?? null,
    source: consent.source,
});
const serializeVisitDetailJson = (detail) => detail
    ? {
        id: detail.id,
        chiefComplaint: detail.chiefComplaint,
        symptoms: detail.symptoms,
        clinicalNotes: detail.clinicalNotes,
        diagnosis: detail.diagnosis,
        treatmentProvided: detail.treatmentProvided,
        followUpInstructions: detail.followUpInstructions,
        followUpRecommendedAt: detail.followUpRecommendedAt?.toISOString() ?? null,
        bloodPressureSystolic: detail.bloodPressureSystolic,
        bloodPressureDiastolic: detail.bloodPressureDiastolic,
        heartRate: detail.heartRate,
        temperatureC: detail.temperatureC ? detail.temperatureC.toNumber() : null,
        oxygenSaturation: detail.oxygenSaturation,
        weightKg: detail.weightKg ? detail.weightKg.toNumber() : null,
        heightCm: detail.heightCm ? detail.heightCm.toNumber() : null,
    }
    : null;
const mapAdminDoctor = (doctor) => ({
    id: doctor.id,
    referralCode: doctor.referralCode,
    specialty: doctor.specialty,
    bio: doctor.bio,
    languages: doctor.languages,
    yearsExperience: doctor.yearsExperience,
    isAvailable: doctor.isAvailable,
    serviceRadiusKm: doctor.serviceRadiusKm,
    defaultSlotMinutes: doctor.defaultSlotMinutes,
    defaultBufferMinutes: doctor.defaultBufferMinutes,
    onboardingPoints: doctor.onboardingPoints,
    workplaceName: doctor.workplaceName,
    workplaceAddress: doctor.workplaceAddress,
    averageRating: decimalToNumber(doctor.averageRating) ?? 0,
    reviewCount: doctor.reviewCount,
    completedVisitCount: doctor.completedVisitCount,
    _count: {
        appointments: doctor._count.appointments,
    },
    user: {
        id: doctor.user.id,
        fullName: doctor.user.fullName,
        phoneNumber: doctor.user.phoneNumber,
        photoUrl: doctor.user.photoUrl,
    },
    location: doctor.location
        ? {
            city: doctor.location.city,
            addressLine: doctor.location.addressLine,
            latitude: decimalToNumber(doctor.location.latitude),
            longitude: decimalToNumber(doctor.location.longitude),
        }
        : null,
    credentials: doctor.credentials.map((credential) => ({
        id: credential.id,
        type: credential.type,
        title: credential.title,
        issuer: credential.issuer,
        awardedAt: credential.awardedAt?.toISOString() ?? null,
    })),
});
const mapAdminPatient = (patient) => ({
    id: patient.id,
    availablePoints: patient.availablePoints,
    lifetimePoints: patient.lifetimePoints,
    city: patient.city,
    homeAddress: patient.homeAddress,
    latitude: decimalToNumber(patient.latitude),
    longitude: decimalToNumber(patient.longitude),
    dateOfBirth: formatDateOnly(patient.dateOfBirth),
    gender: patient.gender,
    emergencyContactName: patient.emergencyContactName,
    emergencyContactPhone: patient.emergencyContactPhone,
    allergies: patient.allergies,
    chronicConditions: patient.chronicConditions,
    currentMedications: patient.currentMedications,
    mobilityNotes: patient.mobilityNotes,
    communicationPreferences: patient.communicationPreferences,
    notes: patient.notes,
    referralCodeUsed: patient.referralCodeUsed,
    consents: patient.consents.map(serializeConsentJson),
    user: {
        id: patient.user.id,
        fullName: patient.user.fullName,
        phoneNumber: patient.user.phoneNumber,
        status: patient.user.status,
    },
    referredByDoctor: patient.referredByDoctor
        ? {
            user: {
                fullName: patient.referredByDoctor.user.fullName,
            },
        }
        : null,
    primaryDoctor: patient.primaryDoctor
        ? {
            user: {
                fullName: patient.primaryDoctor.user.fullName,
            },
        }
        : null,
});
const mapAdminRequest = (request) => ({
    id: request.id,
    type: request.type,
    status: request.status,
    serviceAddress: request.serviceAddress,
    city: request.city,
    latitude: decimalToNumber(request.latitude),
    longitude: decimalToNumber(request.longitude),
    preferredStartAt: request.preferredStartAt?.toISOString() ?? null,
    preferredEndAt: request.preferredEndAt?.toISOString() ?? null,
    scheduledFor: request.scheduledFor?.toISOString() ?? null,
    notes: request.notes,
    issueDescription: request.issueDescription,
    distanceKm: request.distanceKm === null || request.distanceKm === undefined
        ? null
        : Number(request.distanceKm),
    isWithinDoctorRange: request.isWithinDoctorRange,
    createdAt: request.createdAt.toISOString(),
    patientProfile: {
        user: {
            fullName: request.patientProfile.user.fullName,
            phoneNumber: request.patientProfile.user.phoneNumber,
        },
    },
    assignedDoctor: request.assignedDoctor
        ? {
            id: request.assignedDoctor.id,
            user: {
                fullName: request.assignedDoctor.user.fullName,
            },
        }
        : null,
    requestedDoctor: request.requestedDoctor
        ? {
            id: request.requestedDoctor.id,
            user: {
                fullName: request.requestedDoctor.user.fullName,
            },
        }
        : null,
    appointment: request.appointment
        ? {
            id: request.appointment.id,
            status: request.appointment.status,
        }
        : null,
});
const syncPatientConsents = async (tx, patientProfileId, consents) => {
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
            }
            else {
                await tx.patientConsent.create({
                    data: {
                        patientProfileId,
                        type: consent.type,
                        version: consent.version,
                        source: consent.source ?? 'ADMIN',
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
const buildPatientProfileWriteData = (input) => ({
    city: input.city,
    homeAddress: input.homeAddress,
    latitude: input.latitude === undefined ? undefined : toDecimalInput(input.latitude),
    longitude: input.longitude === undefined ? undefined : toDecimalInput(input.longitude),
    dateOfBirth: input.dateOfBirth === undefined ? undefined : parseDateOnly(input.dateOfBirth),
    gender: input.gender,
    emergencyContactName: input.emergencyContactName,
    emergencyContactPhone: input.emergencyContactPhone === undefined
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
const mapAdminUser = (user) => ({
    id: user.id,
    fullName: user.fullName,
    phoneNumber: user.phoneNumber,
    role: user.role,
    permissions: user.permissions,
    status: user.status,
    photoUrl: user.photoUrl,
    createdAt: user.createdAt,
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
            onboardingPoints: user.doctorProfile.onboardingPoints,
            workplaceName: user.doctorProfile.workplaceName,
            workplaceAddress: user.doctorProfile.workplaceAddress,
            averageRating: decimalToNumber(user.doctorProfile.averageRating) ?? 0,
            reviewCount: user.doctorProfile.reviewCount,
            completedVisitCount: user.doctorProfile.completedVisitCount,
            location: user.doctorProfile.location
                ? {
                    city: user.doctorProfile.location.city,
                    addressLine: user.doctorProfile.location.addressLine,
                    latitude: decimalToNumber(user.doctorProfile.location.latitude),
                    longitude: decimalToNumber(user.doctorProfile.location.longitude),
                }
                : null,
            credentials: user.doctorProfile.credentials.map((credential) => ({
                id: credential.id,
                type: credential.type,
                title: credential.title,
                issuer: credential.issuer,
                awardedAt: credential.awardedAt,
            })),
        }
        : null,
    patientProfile: user.patientProfile
        ? {
            id: user.patientProfile.id,
            city: user.patientProfile.city,
            homeAddress: user.patientProfile.homeAddress,
            latitude: decimalToNumber(user.patientProfile.latitude),
            longitude: decimalToNumber(user.patientProfile.longitude),
            dateOfBirth: formatDateOnly(user.patientProfile.dateOfBirth),
            gender: user.patientProfile.gender,
            emergencyContactName: user.patientProfile.emergencyContactName,
            emergencyContactPhone: user.patientProfile.emergencyContactPhone,
            allergies: user.patientProfile.allergies,
            chronicConditions: user.patientProfile.chronicConditions,
            currentMedications: user.patientProfile.currentMedications,
            mobilityNotes: user.patientProfile.mobilityNotes,
            communicationPreferences: user.patientProfile.communicationPreferences,
            notes: user.patientProfile.notes,
            availablePoints: user.patientProfile.availablePoints,
            lifetimePoints: user.patientProfile.lifetimePoints,
            referralCodeUsed: user.patientProfile.referralCodeUsed,
        }
        : null,
});
export const getAdminDashboard = async () => {
    const [userCount, doctorCount, patientCount, requestCount, pendingRequestCount, activeDiscountCount, upcomingAppointmentCount, cancellationQueueCount,] = await Promise.all([
        prisma.user.count(),
        prisma.user.count({ where: { role: Role.DOCTOR } }),
        prisma.user.count({ where: { role: Role.PATIENT } }),
        prisma.serviceRequest.count(),
        prisma.serviceRequest.count({
            where: {
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
        prisma.discount.count({
            where: {
                status: DiscountStatus.ACTIVE,
            },
        }),
        prisma.appointment.count({
            where: {
                startsAt: { gte: new Date() },
                status: {
                    in: [AppointmentStatus.CONFIRMED, AppointmentStatus.PENDING],
                },
            },
        }),
        prisma.appointment.count({
            where: {
                status: AppointmentStatus.CANCELLATION_REQUESTED,
            },
        }),
    ]);
    return {
        userCount,
        doctorCount,
        patientCount,
        requestCount,
        pendingRequestCount,
        activeDiscountCount,
        upcomingAppointmentCount,
        cancellationQueueCount,
    };
};
export const getAdminRequests = async () => {
    const requests = await prisma.serviceRequest.findMany({
        orderBy: { createdAt: 'desc' },
        include: adminRequestInclude,
    });
    return requests.map(mapAdminRequest);
};
export const listAdminRequestDirectory = async (filters) => {
    const where = {
        status: filters.status,
        type: filters.type,
        city: filters.city || undefined,
        OR: filters.search
            ? [
                {
                    patientProfile: {
                        is: {
                            user: {
                                is: {
                                    fullName: { contains: filters.search, mode: 'insensitive' },
                                },
                            },
                        },
                    },
                },
                {
                    patientProfile: {
                        is: {
                            user: {
                                is: {
                                    phoneNumber: { contains: filters.search, mode: 'insensitive' },
                                },
                            },
                        },
                    },
                },
                { serviceAddress: { contains: filters.search, mode: 'insensitive' } },
                { city: { contains: filters.search, mode: 'insensitive' } },
                {
                    requestedDoctor: {
                        is: {
                            user: {
                                is: {
                                    fullName: { contains: filters.search, mode: 'insensitive' },
                                },
                            },
                        },
                    },
                },
                {
                    assignedDoctor: {
                        is: {
                            user: {
                                is: {
                                    fullName: { contains: filters.search, mode: 'insensitive' },
                                },
                            },
                        },
                    },
                },
            ]
            : undefined,
    };
    const orderBy = filters.sortBy === 'OLDEST'
        ? [{ createdAt: 'asc' }]
        : filters.sortBy === 'CITY'
            ? [{ city: 'asc' }, { createdAt: 'desc' }]
            : [{ createdAt: 'desc' }];
    const [totalItems, requests] = await prisma.$transaction([
        prisma.serviceRequest.count({ where }),
        prisma.serviceRequest.findMany({
            where,
            include: adminRequestInclude,
            orderBy,
            skip: (filters.page - 1) * filters.pageSize,
            take: filters.pageSize,
        }),
    ]);
    return buildPaginatedResult(requests.map(mapAdminRequest), filters.page, filters.pageSize, totalItems);
};
export const getAdminRequestById = async (requestId) => {
    const request = await prisma.serviceRequest.findUnique({
        where: { id: requestId },
        include: adminRequestInclude,
    });
    if (!request) {
        throw new ApiError(404, 'Service request not found');
    }
    return mapAdminRequest(request);
};
export const listAdminUsers = async (filters) => {
    const users = await prisma.user.findMany({
        where: {
            role: filters.role,
            status: filters.status,
            OR: filters.search
                ? [
                    { fullName: { contains: filters.search, mode: 'insensitive' } },
                    { phoneNumber: { contains: filters.search, mode: 'insensitive' } },
                ]
                : undefined,
        },
        orderBy: { createdAt: 'desc' },
        include: adminUserInclude,
    });
    return users.map(mapAdminUser);
};
export const createAdminManagedUser = async (input) => {
    const phoneNumber = normalizePhoneNumber(input.phoneNumber);
    const existing = await prisma.user.findUnique({
        where: { phoneNumber },
    });
    if (existing) {
        throw new ApiError(400, 'A user with this phone number already exists');
    }
    if (input.role === Role.DOCTOR && !input.doctorProfile) {
        throw new ApiError(400, 'Doctor profile details are required for doctor users');
    }
    return prisma.$transaction(async (tx) => {
        let referredByDoctorId;
        if (input.patientProfile?.referralCodeUsed) {
            const doctor = await tx.doctorProfile.findUnique({
                where: { referralCode: input.patientProfile.referralCodeUsed },
            });
            if (!doctor) {
                throw new ApiError(404, 'Referral code for the patient profile was not found');
            }
            referredByDoctorId = doctor.id;
        }
        const created = await tx.user.create({
            data: {
                fullName: input.fullName,
                phoneNumber,
                role: input.role,
                status: input.status ?? UserStatus.ACTIVE,
                photoUrl: input.photoUrl,
                permissions: input.role === Role.ADMIN
                    ? resolvePermissions(Role.ADMIN, input.permissions)
                    : resolvePermissions(input.role),
                doctorProfile: input.role === Role.DOCTOR && input.doctorProfile
                    ? {
                        create: {
                            referralCode: input.doctorProfile.referralCode ?? `DOC-${phoneNumber.slice(-6)}`.toUpperCase(),
                            specialty: input.doctorProfile.specialty,
                            bio: input.doctorProfile.bio,
                            yearsExperience: input.doctorProfile.yearsExperience ?? 0,
                            languages: input.doctorProfile.languages ?? [],
                            serviceRadiusKm: input.doctorProfile.serviceRadiusKm ?? 15,
                            isAvailable: input.doctorProfile.isAvailable ?? true,
                            onboardingPoints: input.doctorProfile.onboardingPoints ?? 100,
                            workplaceName: input.doctorProfile.workplaceName,
                            workplaceAddress: input.doctorProfile.workplaceAddress,
                            workplaceLatitude: toDecimalInput(input.doctorProfile.workplaceLatitude),
                            workplaceLongitude: toDecimalInput(input.doctorProfile.workplaceLongitude),
                            credentials: input.doctorProfile.credentials?.length
                                ? {
                                    create: input.doctorProfile.credentials.map((credential, index) => ({
                                        ...credential,
                                        awardedAt: credential.awardedAt ? new Date(credential.awardedAt) : undefined,
                                        displayOrder: index,
                                    })),
                                }
                                : undefined,
                            location: input.doctorProfile.location
                                ? {
                                    create: {
                                        city: input.doctorProfile.location.city,
                                        addressLine: input.doctorProfile.location.addressLine,
                                        latitude: toDecimalInput(input.doctorProfile.location.latitude),
                                        longitude: toDecimalInput(input.doctorProfile.location.longitude),
                                        notes: input.doctorProfile.location.notes,
                                    },
                                }
                                : undefined,
                        },
                    }
                    : undefined,
                patientProfile: input.role === Role.PATIENT
                    ? {
                        create: {
                            referralCodeUsed: input.patientProfile?.referralCodeUsed,
                            referredByDoctorId,
                            primaryDoctorId: referredByDoctorId,
                            availablePoints: input.patientProfile?.availablePoints ?? 0,
                            lifetimePoints: input.patientProfile?.lifetimePoints ??
                                input.patientProfile?.availablePoints ??
                                0,
                            ...buildPatientProfileWriteData({
                                city: input.patientProfile?.city,
                                homeAddress: input.patientProfile?.homeAddress,
                                latitude: input.patientProfile?.latitude,
                                longitude: input.patientProfile?.longitude,
                                dateOfBirth: input.patientProfile?.dateOfBirth,
                                gender: input.patientProfile?.gender,
                                emergencyContactName: input.patientProfile?.emergencyContactName,
                                emergencyContactPhone: input.patientProfile?.emergencyContactPhone,
                                allergies: input.patientProfile?.allergies,
                                chronicConditions: input.patientProfile?.chronicConditions,
                                currentMedications: input.patientProfile?.currentMedications,
                                mobilityNotes: input.patientProfile?.mobilityNotes,
                                communicationPreferences: input.patientProfile?.communicationPreferences,
                                notes: input.patientProfile?.notes,
                            }),
                        },
                    }
                    : undefined,
            },
            include: adminUserInclude,
        });
        if (created.patientProfile && input.patientProfile?.consents?.length) {
            await syncPatientConsents(tx, created.patientProfile.id, input.patientProfile.consents);
        }
        const refreshed = await tx.user.findUnique({
            where: { id: created.id },
            include: adminUserInclude,
        });
        if (!refreshed) {
            throw new ApiError(500, 'Created user could not be reloaded');
        }
        return mapAdminUser(refreshed);
    });
};
export const updateAdminManagedUser = async (userId, input) => {
    const existing = await prisma.user.findUnique({
        where: { id: userId },
    });
    if (!existing) {
        throw new ApiError(404, 'User not found');
    }
    const nextPhoneNumber = input.phoneNumber
        ? normalizePhoneNumber(input.phoneNumber)
        : undefined;
    if (nextPhoneNumber && nextPhoneNumber !== existing.phoneNumber) {
        const duplicate = await prisma.user.findUnique({
            where: { phoneNumber: nextPhoneNumber },
        });
        if (duplicate) {
            throw new ApiError(400, 'Another user already uses this phone number');
        }
    }
    const updated = await prisma.user.update({
        where: { id: userId },
        data: {
            fullName: input.fullName,
            phoneNumber: nextPhoneNumber,
            role: input.role,
            status: input.status,
            photoUrl: input.photoUrl,
            permissions: input.permissions && (input.role ?? existing.role) === Role.ADMIN
                ? resolvePermissions(Role.ADMIN, input.permissions)
                : undefined,
        },
        include: adminUserInclude,
    });
    return mapAdminUser(updated);
};
export const listAdminDoctors = async () => {
    const doctors = await prisma.doctorProfile.findMany({
        include: adminDoctorListInclude,
        orderBy: {
            user: {
                fullName: 'asc',
            },
        },
    });
    return doctors.map(mapAdminDoctor);
};
export const listAdminDoctorDirectory = async (filters) => {
    const where = {
        isAvailable: filters.availability === 'AVAILABLE'
            ? true
            : filters.availability === 'OFFLINE'
                ? false
                : undefined,
        location: filters.city
            ? {
                is: {
                    city: filters.city,
                },
            }
            : undefined,
        OR: filters.search
            ? [
                {
                    user: {
                        is: {
                            fullName: { contains: filters.search, mode: 'insensitive' },
                        },
                    },
                },
                {
                    user: {
                        is: {
                            phoneNumber: { contains: filters.search, mode: 'insensitive' },
                        },
                    },
                },
                { specialty: { contains: filters.search, mode: 'insensitive' } },
                {
                    location: {
                        is: {
                            city: { contains: filters.search, mode: 'insensitive' },
                        },
                    },
                },
                {
                    location: {
                        is: {
                            addressLine: { contains: filters.search, mode: 'insensitive' },
                        },
                    },
                },
            ]
            : undefined,
    };
    const primaryOrderBy = filters.sortBy === 'RATING'
        ? { averageRating: 'desc' }
        : filters.sortBy === 'VISITS'
            ? { completedVisitCount: 'desc' }
            : filters.sortBy === 'RADIUS'
                ? { serviceRadiusKm: 'desc' }
                : { user: { fullName: 'asc' } };
    const [totalItems, doctors] = await prisma.$transaction([
        prisma.doctorProfile.count({ where }),
        prisma.doctorProfile.findMany({
            where,
            include: adminDoctorListInclude,
            orderBy: [primaryOrderBy, { user: { fullName: 'asc' } }],
            skip: (filters.page - 1) * filters.pageSize,
            take: filters.pageSize,
        }),
    ]);
    return buildPaginatedResult(doctors.map(mapAdminDoctor), filters.page, filters.pageSize, totalItems);
};
export const getAdminDoctorById = async (doctorId) => {
    const doctor = await prisma.doctorProfile.findUnique({
        where: { id: doctorId },
        include: adminDoctorListInclude,
    });
    if (!doctor) {
        throw new ApiError(404, 'Doctor profile not found');
    }
    return mapAdminDoctor(doctor);
};
export const updateAdminDoctor = async (doctorId, input) => {
    const updated = await updateDoctorProfileById(doctorId, input);
    if (input.location) {
        await updateDoctorLocationById(doctorId, input.location);
    }
    return updated;
};
export const uploadAdminDoctorPhoto = async (input) => {
    if (!input.mimeType.startsWith('image/')) {
        throw new ApiError(400, 'Only image uploads are allowed for doctor profile photos');
    }
    const fileBuffer = Buffer.from(input.contentBase64, 'base64');
    if (!fileBuffer.length) {
        throw new ApiError(400, 'Uploaded image content is empty');
    }
    if (fileBuffer.length > 5 * 1024 * 1024) {
        throw new ApiError(400, 'Doctor profile photos must be 5 MB or smaller');
    }
    const fileExtension = input.fileName.includes('.')
        ? input.fileName.split('.').pop()
        : undefined;
    return uploadFileToSpaces({
        file: fileBuffer,
        folder: 'doctors/profile-photos',
        fileExtension,
        mimeType: input.mimeType,
    });
};
export const listAdminPatients = async () => {
    const patients = await prisma.patientProfile.findMany({
        include: adminPatientInclude,
        orderBy: {
            user: {
                fullName: 'asc',
            },
        },
    });
    return patients.map(mapAdminPatient);
};
export const listAdminPatientDirectory = async (filters) => {
    const where = {
        gender: filters.gender,
        city: filters.city || undefined,
        user: filters.status
            ? {
                is: {
                    status: filters.status,
                },
            }
            : undefined,
        OR: filters.search
            ? [
                {
                    user: {
                        is: {
                            fullName: { contains: filters.search, mode: 'insensitive' },
                        },
                    },
                },
                {
                    user: {
                        is: {
                            phoneNumber: { contains: filters.search, mode: 'insensitive' },
                        },
                    },
                },
                { city: { contains: filters.search, mode: 'insensitive' } },
                { homeAddress: { contains: filters.search, mode: 'insensitive' } },
                { emergencyContactName: { contains: filters.search, mode: 'insensitive' } },
            ]
            : undefined,
    };
    const primaryOrderBy = filters.sortBy === 'POINTS'
        ? { availablePoints: 'desc' }
        : filters.sortBy === 'CITY'
            ? { city: 'asc' }
            : { user: { fullName: 'asc' } };
    const [totalItems, patients] = await prisma.$transaction([
        prisma.patientProfile.count({ where }),
        prisma.patientProfile.findMany({
            where,
            include: adminPatientInclude,
            orderBy: [primaryOrderBy, { user: { fullName: 'asc' } }],
            skip: (filters.page - 1) * filters.pageSize,
            take: filters.pageSize,
        }),
    ]);
    return buildPaginatedResult(patients.map(mapAdminPatient), filters.page, filters.pageSize, totalItems);
};
export const getAdminPatientById = async (patientProfileId) => {
    const patient = await prisma.patientProfile.findUnique({
        where: { id: patientProfileId },
        include: adminPatientInclude,
    });
    if (!patient) {
        throw new ApiError(404, 'Patient profile not found');
    }
    return mapAdminPatient(patient);
};
export const updateAdminPatient = async (patientProfileId, input) => {
    const patient = await prisma.patientProfile.findUnique({
        where: { id: patientProfileId },
    });
    if (!patient) {
        throw new ApiError(404, 'Patient profile not found');
    }
    await prisma.$transaction(async (tx) => {
        if (input.fullName || input.status) {
            await tx.user.update({
                where: { id: patient.userId },
                data: {
                    fullName: input.fullName,
                    status: input.status,
                },
            });
        }
        await tx.patientProfile.update({
            where: { id: patientProfileId },
            data: buildPatientProfileWriteData(input),
        });
        await syncPatientConsents(tx, patientProfileId, input.consents);
    });
    const refreshed = await prisma.patientProfile.findUnique({
        where: { id: patientProfileId },
        include: adminPatientInclude,
    });
    if (!refreshed) {
        throw new ApiError(404, 'Patient profile not found');
    }
    return mapAdminPatient(refreshed);
};
export const listAdminReferrals = async () => prisma.referralEvent.findMany({
    include: {
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
        discount: true,
    },
    orderBy: { createdAt: 'desc' },
});
export const listAdminDiscounts = async () => prisma.discount.findMany({
    orderBy: { createdAt: 'desc' },
});
export const createAdminDiscount = async (input) => {
    const existing = await prisma.discount.findUnique({
        where: { code: input.code },
    });
    if (existing) {
        throw new ApiError(400, 'A discount with this code already exists');
    }
    return prisma.discount.create({
        data: {
            code: input.code,
            title: input.title,
            description: input.description,
            type: input.type,
            value: input.value,
            pointsCost: input.pointsCost,
            isReferralReward: input.isReferralReward ?? false,
            status: input.status ?? DiscountStatus.ACTIVE,
        },
    });
};
export const updateAdminDiscount = async (discountId, input) => {
    const discount = await prisma.discount.findUnique({
        where: { id: discountId },
    });
    if (!discount) {
        throw new ApiError(404, 'Discount not found');
    }
    return prisma.discount.update({
        where: { id: discountId },
        data: input,
    });
};
export const adjustAdminPoints = async (patientProfileId, points, notes) => grantAdminAdjustment(patientProfileId, points, notes);
export const getPermissionCatalog = () => Object.values(Permission).map((permission) => ({
    key: permission,
    defaultRoles: Object.entries(rolePermissionDefaults)
        .filter(([, permissions]) => permissions.includes(permission))
        .map(([role]) => role),
}));
export const getAdminLocationOverview = async () => {
    const [doctors, patients, requests] = await Promise.all([
        prisma.doctorProfile.findMany({
            include: {
                user: true,
                location: true,
            },
        }),
        prisma.patientProfile.findMany({
            include: {
                user: true,
            },
        }),
        prisma.serviceRequest.findMany({
            where: {
                status: {
                    in: [
                        ServiceRequestStatus.PENDING,
                        ServiceRequestStatus.ASSIGNED,
                        ServiceRequestStatus.ACCEPTED,
                        ServiceRequestStatus.IN_PROGRESS,
                    ],
                },
            },
            include: {
                patientProfile: {
                    include: {
                        user: true,
                    },
                },
                assignedDoctor: {
                    include: {
                        user: true,
                    },
                },
            },
            take: 100,
            orderBy: { createdAt: 'desc' },
        }),
    ]);
    return {
        doctors: doctors.map((doctor) => ({
            id: doctor.id,
            name: doctor.user.fullName,
            latitude: decimalToNumber(doctor.location?.latitude),
            longitude: decimalToNumber(doctor.location?.longitude),
            addressLine: doctor.location?.addressLine ?? null,
            city: doctor.location?.city ?? null,
            isAvailable: doctor.isAvailable,
        })),
        patients: patients.map((patient) => ({
            id: patient.id,
            name: patient.user.fullName,
            latitude: decimalToNumber(patient.latitude),
            longitude: decimalToNumber(patient.longitude),
            addressLine: patient.homeAddress,
            city: patient.city,
        })),
        requests: requests.map((request) => ({
            id: request.id,
            patientName: request.patientProfile.user.fullName,
            assignedDoctorName: request.assignedDoctor?.user.fullName ?? null,
            latitude: decimalToNumber(request.latitude),
            longitude: decimalToNumber(request.longitude),
            serviceAddress: request.serviceAddress,
            city: request.city,
            status: request.status,
        })),
    };
};
export const listAdminAppointments = async (filters) => listAppointments({
    userId: 'admin',
    role: Role.ADMIN,
}, filters);
export const listAdminAppointmentDirectory = async (filters) => {
    const startsAtFilter = filters.from ? new Date(filters.from) : undefined;
    const endsAtFilter = filters.to ? new Date(filters.to) : undefined;
    const where = {
        doctorId: filters.doctorId,
        patientProfileId: filters.patientProfileId,
        status: filters.status,
        city: filters.city || undefined,
        startsAt: startsAtFilter ? { gte: startsAtFilter } : undefined,
        endsAt: endsAtFilter ? { lte: endsAtFilter } : undefined,
        OR: filters.search
            ? [
                {
                    patientProfile: {
                        is: {
                            user: {
                                is: {
                                    fullName: { contains: filters.search, mode: 'insensitive' },
                                },
                            },
                        },
                    },
                },
                {
                    patientProfile: {
                        is: {
                            user: {
                                is: {
                                    phoneNumber: { contains: filters.search, mode: 'insensitive' },
                                },
                            },
                        },
                    },
                },
                {
                    doctor: {
                        is: {
                            user: {
                                is: {
                                    fullName: { contains: filters.search, mode: 'insensitive' },
                                },
                            },
                        },
                    },
                },
                { city: { contains: filters.search, mode: 'insensitive' } },
                { patientAddress: { contains: filters.search, mode: 'insensitive' } },
            ]
            : undefined,
    };
    const orderBy = filters.sortBy === 'RECENT'
        ? [{ startsAt: 'desc' }]
        : filters.sortBy === 'CITY'
            ? [{ city: 'asc' }, { startsAt: 'asc' }]
            : [{ startsAt: 'asc' }];
    const [totalItems, appointments] = await prisma.$transaction([
        prisma.appointment.count({ where }),
        prisma.appointment.findMany({
            where,
            include: appointmentInclude,
            orderBy,
            skip: (filters.page - 1) * filters.pageSize,
            take: filters.pageSize,
        }),
    ]);
    return buildPaginatedResult(appointments.map(mapAppointment), filters.page, filters.pageSize, totalItems);
};
export const getAdminAppointmentById = async (appointmentId) => {
    const appointment = await prisma.appointment.findUnique({
        where: { id: appointmentId },
        include: appointmentInclude,
    });
    if (!appointment) {
        throw new ApiError(404, 'Appointment not found');
    }
    return mapAppointment(appointment);
};
export const createAdminAppointment = async (adminUserId, input) => createAppointment({
    userId: adminUserId,
    role: Role.ADMIN,
}, {
    ...input,
    createdByRole: Role.ADMIN,
});
export const listAdminReviews = async () => listReviews({
    userId: 'admin',
    role: Role.ADMIN,
});
export const listAdminReviewDirectory = async (filters) => {
    const where = {
        isHidden: filters.visibility === 'VISIBLE'
            ? false
            : filters.visibility === 'HIDDEN'
                ? true
                : undefined,
        rating: filters.rating,
        OR: filters.search
            ? [
                {
                    patientProfile: {
                        is: {
                            user: {
                                is: {
                                    fullName: { contains: filters.search, mode: 'insensitive' },
                                },
                            },
                        },
                    },
                },
                {
                    doctor: {
                        is: {
                            user: {
                                is: {
                                    fullName: { contains: filters.search, mode: 'insensitive' },
                                },
                            },
                        },
                    },
                },
                { comment: { contains: filters.search, mode: 'insensitive' } },
                { doctorReply: { contains: filters.search, mode: 'insensitive' } },
            ]
            : undefined,
    };
    const orderBy = filters.sortBy === 'RATING' ? [{ rating: 'desc' }, { createdAt: 'desc' }] : [{ createdAt: 'desc' }];
    const [totalItems, reviews] = await prisma.$transaction([
        prisma.review.count({ where }),
        prisma.review.findMany({
            where,
            include: reviewInclude,
            orderBy,
            skip: (filters.page - 1) * filters.pageSize,
            take: filters.pageSize,
        }),
    ]);
    return buildPaginatedResult(reviews.map(mapReview), filters.page, filters.pageSize, totalItems);
};
export const getAdminReviewById = async (reviewId) => {
    const review = await prisma.review.findUnique({
        where: { id: reviewId },
        include: reviewInclude,
    });
    if (!review) {
        throw new ApiError(404, 'Review not found');
    }
    return mapReview(review);
};
export const moderateAdminReview = async (reviewId, input) => moderateReview(reviewId, input);
const buildDateTimeRange = (from, to) => from || to
    ? {
        ...(from ? { gte: new Date(from) } : {}),
        ...(to ? { lte: new Date(to) } : {}),
    }
    : undefined;
const buildAdminReportFilters = (filters) => {
    const appointmentRange = buildDateTimeRange(filters.from, filters.to);
    const requestRange = buildDateTimeRange(filters.from, filters.to);
    const reviewRange = buildDateTimeRange(filters.from, filters.to);
    const appointmentWhere = {
        doctorId: filters.doctorId,
        patientProfileId: filters.patientProfileId,
        startsAt: appointmentRange,
        city: filters.city || undefined,
        AND: [
            filters.doctorSearch
                ? {
                    doctor: {
                        is: {
                            user: {
                                is: {
                                    fullName: {
                                        contains: filters.doctorSearch,
                                        mode: 'insensitive',
                                    },
                                },
                            },
                        },
                    },
                }
                : undefined,
            filters.patientSearch
                ? {
                    patientProfile: {
                        is: {
                            user: {
                                is: {
                                    fullName: {
                                        contains: filters.patientSearch,
                                        mode: 'insensitive',
                                    },
                                },
                            },
                        },
                    },
                }
                : undefined,
        ].filter(Boolean),
    };
    const requestWhere = {
        assignedDoctorId: filters.doctorId,
        patientProfileId: filters.patientProfileId,
        createdAt: requestRange,
        city: filters.city || undefined,
        AND: [
            filters.doctorSearch
                ? {
                    OR: [
                        {
                            assignedDoctor: {
                                is: {
                                    user: {
                                        is: {
                                            fullName: {
                                                contains: filters.doctorSearch,
                                                mode: 'insensitive',
                                            },
                                        },
                                    },
                                },
                            },
                        },
                        {
                            requestedDoctor: {
                                is: {
                                    user: {
                                        is: {
                                            fullName: {
                                                contains: filters.doctorSearch,
                                                mode: 'insensitive',
                                            },
                                        },
                                    },
                                },
                            },
                        },
                    ],
                }
                : undefined,
            filters.patientSearch
                ? {
                    patientProfile: {
                        is: {
                            user: {
                                is: {
                                    fullName: {
                                        contains: filters.patientSearch,
                                        mode: 'insensitive',
                                    },
                                },
                            },
                        },
                    },
                }
                : undefined,
        ].filter(Boolean),
    };
    const reviewWhere = {
        doctorId: filters.doctorId,
        patientProfileId: filters.patientProfileId,
        createdAt: reviewRange,
        AND: [
            filters.doctorSearch
                ? {
                    doctor: {
                        is: {
                            user: {
                                is: {
                                    fullName: {
                                        contains: filters.doctorSearch,
                                        mode: 'insensitive',
                                    },
                                },
                            },
                        },
                    },
                }
                : undefined,
            filters.patientSearch
                ? {
                    patientProfile: {
                        is: {
                            user: {
                                is: {
                                    fullName: {
                                        contains: filters.patientSearch,
                                        mode: 'insensitive',
                                    },
                                },
                            },
                        },
                    },
                }
                : undefined,
        ].filter(Boolean),
    };
    return { appointmentWhere, requestWhere, reviewWhere };
};
export const getAdminReportOverview = async (filters) => {
    const { appointmentWhere, reviewWhere } = buildAdminReportFilters(filters);
    const [appointmentCount, completedAppointmentCount, reviewStats] = await Promise.all([
        prisma.appointment.count({
            where: appointmentWhere,
        }),
        prisma.appointment.count({
            where: {
                ...appointmentWhere,
                status: AppointmentStatus.COMPLETED,
            },
        }),
        prisma.review.aggregate({
            where: reviewWhere,
            _count: {
                _all: true,
            },
            _avg: {
                rating: true,
            },
        }),
    ]);
    return {
        generatedAt: new Date().toISOString(),
        totals: {
            appointmentCount,
            completedAppointmentCount,
            reviewCount: reviewStats._count._all,
            averageReviewRating: reviewStats._avg.rating
                ? Math.round(reviewStats._avg.rating * 100) / 100
                : 0,
        },
    };
};
export const getAdminReportTable = async (filters) => {
    const { appointmentWhere, requestWhere } = buildAdminReportFilters(filters);
    if (filters.tab === 'appointmentRows') {
        const [totalItems, appointments] = await prisma.$transaction([
            prisma.appointment.count({
                where: appointmentWhere,
            }),
            prisma.appointment.findMany({
                where: appointmentWhere,
                include: {
                    patientProfile: {
                        include: {
                            user: true,
                        },
                    },
                    doctor: {
                        include: {
                            user: true,
                        },
                    },
                },
                orderBy: {
                    startsAt: 'desc',
                },
                skip: (filters.page - 1) * filters.pageSize,
                take: filters.pageSize,
            }),
        ]);
        return {
            tab: filters.tab,
            description: 'A paginated operational log of appointments for the selected filters.',
            ...buildPaginatedResult(appointments.map((appointment) => ({
                id: appointment.id,
                status: appointment.status,
                startsAt: appointment.startsAt.toISOString(),
                endsAt: appointment.endsAt.toISOString(),
                patientName: appointment.patientProfile.user.fullName,
                doctorName: appointment.doctor.user.fullName,
                city: appointment.city,
                patientAddress: appointment.patientAddress,
                createdAt: appointment.createdAt.toISOString(),
            })), filters.page, filters.pageSize, totalItems),
        };
    }
    if (filters.tab === 'topDoctors') {
        const [appointmentCounts, completedCounts] = await Promise.all([
            prisma.appointment.groupBy({
                by: ['doctorId'],
                where: appointmentWhere,
                _count: {
                    _all: true,
                },
            }),
            prisma.appointment.groupBy({
                by: ['doctorId'],
                where: {
                    ...appointmentWhere,
                    status: AppointmentStatus.COMPLETED,
                },
                _count: {
                    _all: true,
                },
            }),
        ]);
        const completedCountMap = new Map(completedCounts.map((item) => [item.doctorId, item._count._all]));
        const rankedDoctors = appointmentCounts
            .map((item) => ({
            doctorId: item.doctorId,
            appointmentCount: item._count._all,
            completedCount: completedCountMap.get(item.doctorId) ?? 0,
        }))
            .sort((first, second) => second.appointmentCount - first.appointmentCount ||
            second.completedCount - first.completedCount);
        const pageItems = rankedDoctors.slice((filters.page - 1) * filters.pageSize, filters.page * filters.pageSize);
        const doctors = await prisma.doctorProfile.findMany({
            where: {
                id: {
                    in: pageItems.map((item) => item.doctorId),
                },
            },
            include: {
                user: true,
            },
        });
        const doctorMap = new Map(doctors.map((doctor) => [doctor.id, doctor]));
        return {
            tab: filters.tab,
            description: 'Doctor output, completion, and rating performance in one table.',
            ...buildPaginatedResult(pageItems.map((item) => {
                const doctor = doctorMap.get(item.doctorId);
                return {
                    doctorId: item.doctorId,
                    doctorName: doctor?.user.fullName ?? 'Unknown doctor',
                    appointmentCount: item.appointmentCount,
                    completedCount: item.completedCount,
                    averageRating: decimalToNumber(doctor?.averageRating) ?? 0,
                };
            }), filters.page, filters.pageSize, rankedDoctors.length),
        };
    }
    if (filters.tab === 'cityDemand') {
        const cityDemand = await prisma.serviceRequest.groupBy({
            by: ['city'],
            where: requestWhere,
            _count: {
                _all: true,
            },
        });
        const rankedCities = cityDemand
            .map((item) => ({
            city: item.city,
            count: item._count._all,
        }))
            .sort((first, second) => second.count - first.count || first.city.localeCompare(second.city));
        return {
            tab: filters.tab,
            description: 'Demand concentration by city to support staffing and coverage decisions.',
            ...buildPaginatedResult(rankedCities.slice((filters.page - 1) * filters.pageSize, filters.page * filters.pageSize), filters.page, filters.pageSize, rankedCities.length),
        };
    }
    if (filters.tab === 'appointmentStatus') {
        const appointmentStatusGroups = await prisma.appointment.groupBy({
            by: ['status'],
            where: appointmentWhere,
            _count: {
                _all: true,
            },
        });
        const rows = appointmentStatusGroups
            .map((item) => ({
            status: item.status,
            count: item._count._all,
        }))
            .sort((first, second) => second.count - first.count || first.status.localeCompare(second.status));
        return {
            tab: filters.tab,
            description: 'Appointment volume grouped by status for the selected report scope.',
            ...buildPaginatedResult(rows.slice((filters.page - 1) * filters.pageSize, filters.page * filters.pageSize), filters.page, filters.pageSize, rows.length),
        };
    }
    const requestStatusGroups = await prisma.serviceRequest.groupBy({
        by: ['status'],
        where: requestWhere,
        _count: {
            _all: true,
        },
    });
    const rows = requestStatusGroups
        .map((item) => ({
        status: item.status,
        count: item._count._all,
    }))
        .sort((first, second) => second.count - first.count || first.status.localeCompare(second.status));
    return {
        tab: filters.tab,
        description: 'Request queue health grouped by lifecycle status.',
        ...buildPaginatedResult(rows.slice((filters.page - 1) * filters.pageSize, filters.page * filters.pageSize), filters.page, filters.pageSize, rows.length),
    };
};
const resolveRetentionDelete = async (tx, appliesTo, cutoff, dryRun) => {
    const normalized = appliesTo.trim().toUpperCase().replaceAll(' ', '_');
    switch (normalized) {
        case 'AUDIT_LOG': {
            const candidateCount = await tx.auditLog.count({
                where: {
                    createdAt: {
                        lt: cutoff,
                    },
                },
            });
            const deletedCount = dryRun
                ? 0
                : (await tx.auditLog.deleteMany({
                    where: {
                        createdAt: {
                            lt: cutoff,
                        },
                    },
                })).count;
            return { target: normalized, candidateCount, deletedCount };
        }
        case 'NOTIFICATION': {
            const candidateCount = await tx.notification.count({
                where: {
                    createdAt: {
                        lt: cutoff,
                    },
                },
            });
            const deletedCount = dryRun
                ? 0
                : (await tx.notification.deleteMany({
                    where: {
                        createdAt: {
                            lt: cutoff,
                        },
                    },
                })).count;
            return { target: normalized, candidateCount, deletedCount };
        }
        case 'AUTH_CHALLENGE': {
            const candidateCount = await tx.authChallenge.count({
                where: {
                    createdAt: {
                        lt: cutoff,
                    },
                },
            });
            const deletedCount = dryRun
                ? 0
                : (await tx.authChallenge.deleteMany({
                    where: {
                        createdAt: {
                            lt: cutoff,
                        },
                    },
                })).count;
            return { target: normalized, candidateCount, deletedCount };
        }
        case 'BACKUP_OPERATION': {
            const candidateCount = await tx.backupOperation.count({
                where: {
                    createdAt: {
                        lt: cutoff,
                    },
                },
            });
            const deletedCount = dryRun
                ? 0
                : (await tx.backupOperation.deleteMany({
                    where: {
                        createdAt: {
                            lt: cutoff,
                        },
                    },
                })).count;
            return { target: normalized, candidateCount, deletedCount };
        }
        case 'DATA_GOVERNANCE_REQUEST': {
            const candidateCount = await tx.dataGovernanceRequest.count({
                where: {
                    createdAt: {
                        lt: cutoff,
                    },
                    status: {
                        in: [GovernanceRequestStatus.COMPLETED, GovernanceRequestStatus.REJECTED],
                    },
                },
            });
            const deletedCount = dryRun
                ? 0
                : (await tx.dataGovernanceRequest.deleteMany({
                    where: {
                        createdAt: {
                            lt: cutoff,
                        },
                        status: {
                            in: [GovernanceRequestStatus.COMPLETED, GovernanceRequestStatus.REJECTED],
                        },
                    },
                })).count;
            return { target: normalized, candidateCount, deletedCount };
        }
        default:
            throw new ApiError(400, `Unsupported retention target "${appliesTo}". Use AUDIT_LOG, NOTIFICATION, AUTH_CHALLENGE, BACKUP_OPERATION, or DATA_GOVERNANCE_REQUEST.`);
    }
};
const buildGovernanceExportData = async (tx, request) => {
    const patient = request.subjectPatientProfile;
    const user = request.subjectUser ?? patient?.user ?? null;
    return {
        exportedAt: new Date().toISOString(),
        requestId: request.id,
        subject: user
            ? {
                userId: user.id,
                fullName: user.fullName,
                phoneNumber: user.phoneNumber,
                role: user.role,
                status: user.status,
            }
            : null,
        patientProfile: patient
            ? {
                id: patient.id,
                city: patient.city,
                homeAddress: patient.homeAddress,
                dateOfBirth: formatDateOnly(patient.dateOfBirth),
                gender: patient.gender,
                emergencyContactName: patient.emergencyContactName,
                emergencyContactPhone: patient.emergencyContactPhone,
                allergies: patient.allergies,
                chronicConditions: patient.chronicConditions,
                currentMedications: patient.currentMedications,
                mobilityNotes: patient.mobilityNotes,
                communicationPreferences: patient.communicationPreferences,
                notes: patient.notes,
                consents: patient.consents.map(serializeConsentJson),
            }
            : null,
        counts: {
            appointments: patient?.appointments.length ?? 0,
            requests: patient?.serviceRequests.length ?? 0,
            reviews: patient?.reviews.length ?? 0,
            consents: patient?.consents.length ?? 0,
        },
        appointments: patient?.appointments.map((appointment) => ({
            id: appointment.id,
            status: appointment.status,
            startsAt: appointment.startsAt.toISOString(),
            endsAt: appointment.endsAt.toISOString(),
            city: appointment.city,
            patientAddress: appointment.patientAddress,
            doctorName: appointment.doctor.user.fullName,
            specialty: appointment.doctor.specialty,
            visitSummary: appointment.visitSummary,
            visitDetail: serializeVisitDetailJson(appointment.visitDetail),
            review: appointment.review
                ? {
                    rating: appointment.review.rating,
                    comment: appointment.review.comment,
                }
                : null,
        })) ?? [],
    };
};
const executeGovernanceDeletion = async (tx, request) => {
    const patient = request.subjectPatientProfile;
    const user = request.subjectUser ?? patient?.user ?? null;
    if (!user) {
        throw new ApiError(400, 'Deletion execution requires a subject user or patient profile');
    }
    const redactedPhoneNumber = `deleted-${user.id.slice(-12)}`;
    await tx.user.update({
        where: {
            id: user.id,
        },
        data: {
            fullName: `Deleted User ${user.id.slice(-4)}`,
            phoneNumber: redactedPhoneNumber,
            photoUrl: null,
            status: UserStatus.DISABLED,
        },
    });
    if (patient) {
        await tx.patientProfile.update({
            where: {
                id: patient.id,
            },
            data: {
                referralCodeUsed: null,
                dateOfBirth: null,
                gender: null,
                emergencyContactName: null,
                emergencyContactPhone: null,
                homeAddress: null,
                city: null,
                latitude: null,
                longitude: null,
                allergies: null,
                chronicConditions: null,
                currentMedications: null,
                mobilityNotes: null,
                communicationPreferences: null,
                notes: null,
            },
        });
        await tx.patientConsent.updateMany({
            where: {
                patientProfileId: patient.id,
                revokedAt: null,
            },
            data: {
                revokedAt: new Date(),
            },
        });
    }
    return {
        completedAt: new Date().toISOString(),
        userId: user.id,
        patientProfileId: patient?.id ?? null,
        redactedPhoneNumber,
    };
};
export const getAdminComplianceOverview = async () => {
    const [auditLogCount, retentionRuleCount, openIncidentCount, pendingAccessReviewCount, pendingGovernanceRequestCount, queuedNotificationCount, failedNotificationCount, latestBackup,] = await Promise.all([
        prisma.auditLog.count(),
        prisma.documentRetentionRule.count({
            where: {
                isActive: true,
            },
        }),
        prisma.securityIncident.count({
            where: {
                status: {
                    in: [SecurityIncidentStatus.OPEN, SecurityIncidentStatus.INVESTIGATING],
                },
            },
        }),
        prisma.accessReview.count({
            where: {
                status: AccessReviewStatus.PENDING,
            },
        }),
        prisma.dataGovernanceRequest.count({
            where: {
                status: {
                    in: [GovernanceRequestStatus.PENDING, GovernanceRequestStatus.IN_PROGRESS],
                },
            },
        }),
        prisma.notificationDelivery.count({
            where: {
                status: NotificationDeliveryStatus.QUEUED,
            },
        }),
        prisma.notificationDelivery.count({
            where: {
                status: NotificationDeliveryStatus.FAILED,
            },
        }),
        prisma.backupOperation.findFirst({
            orderBy: {
                startedAt: 'desc',
            },
        }),
    ]);
    return {
        auditLogCount,
        retentionRuleCount,
        openIncidentCount,
        pendingAccessReviewCount,
        pendingGovernanceRequestCount,
        queuedNotificationCount,
        failedNotificationCount,
        latestBackup,
    };
};
export const listAuditLogs = async (filters) => prisma.auditLog.findMany({
    where: {
        entityType: filters.entityType,
        actorUserId: filters.actorUserId,
    },
    orderBy: {
        createdAt: 'desc',
    },
    take: filters.limit ?? 100,
});
export const listRetentionRules = async () => prisma.documentRetentionRule.findMany({
    orderBy: {
        createdAt: 'desc',
    },
});
export const createRetentionRule = async (input) => prisma.documentRetentionRule.create({
    data: {
        name: input.name,
        description: input.description,
        appliesTo: input.appliesTo,
        retainDays: input.retainDays,
        legalBasis: input.legalBasis,
        isActive: input.isActive ?? true,
    },
});
export const runRetentionRule = async (ruleId, input) => {
    const rule = await prisma.documentRetentionRule.findUnique({
        where: {
            id: ruleId,
        },
    });
    if (!rule) {
        throw new ApiError(404, 'Retention rule not found');
    }
    const cutoff = new Date(Date.now() - rule.retainDays * 24 * 60 * 60 * 1000);
    return prisma.$transaction(async (tx) => {
        const result = await resolveRetentionDelete(tx, rule.appliesTo, cutoff, input?.dryRun ?? false);
        const summary = {
            ...result,
            dryRun: input?.dryRun ?? false,
            cutoffAt: cutoff.toISOString(),
            executedAt: new Date().toISOString(),
        };
        const updatedRule = await tx.documentRetentionRule.update({
            where: {
                id: ruleId,
            },
            data: {
                lastRunAt: new Date(),
                lastRunSummary: summary,
            },
        });
        return {
            rule: updatedRule,
            summary,
        };
    });
};
export const listSecurityIncidents = async () => prisma.securityIncident.findMany({
    include: {
        reportedBy: {
            select: {
                id: true,
                fullName: true,
            },
        },
        assignedTo: {
            select: {
                id: true,
                fullName: true,
            },
        },
    },
    orderBy: {
        occurredAt: 'desc',
    },
});
export const createSecurityIncident = async (adminUserId, input) => prisma.securityIncident.create({
    data: {
        title: input.title,
        description: input.description,
        severity: input.severity,
        status: input.status ?? SecurityIncidentStatus.OPEN,
        reportedByUserId: adminUserId,
        assignedToUserId: input.assignedToUserId,
        occurredAt: input.occurredAt ? new Date(input.occurredAt) : new Date(),
        remediationNotes: input.remediationNotes,
    },
    include: {
        reportedBy: {
            select: {
                id: true,
                fullName: true,
            },
        },
        assignedTo: {
            select: {
                id: true,
                fullName: true,
            },
        },
    },
});
export const updateSecurityIncident = async (incidentId, input) => prisma.securityIncident.update({
    where: {
        id: incidentId,
    },
    data: {
        status: input.status,
        assignedToUserId: input.assignedToUserId,
        remediationNotes: input.remediationNotes,
        resolvedAt: input.status === SecurityIncidentStatus.RESOLVED ||
            input.status === SecurityIncidentStatus.CLOSED
            ? new Date()
            : undefined,
    },
    include: {
        reportedBy: {
            select: {
                id: true,
                fullName: true,
            },
        },
        assignedTo: {
            select: {
                id: true,
                fullName: true,
            },
        },
    },
});
export const listAccessReviews = async () => prisma.accessReview.findMany({
    include: {
        subjectUser: {
            select: {
                id: true,
                fullName: true,
                role: true,
            },
        },
        reviewer: {
            select: {
                id: true,
                fullName: true,
                role: true,
            },
        },
    },
    orderBy: {
        createdAt: 'desc',
    },
});
export const createAccessReview = async (adminUserId, input) => prisma.accessReview.create({
    data: {
        subjectUserId: input.subjectUserId,
        reviewerUserId: input.reviewerUserId ?? adminUserId,
        status: input.status ?? AccessReviewStatus.PENDING,
        notes: input.notes,
        reviewedAt: input.reviewedAt ? new Date(input.reviewedAt) : undefined,
    },
    include: {
        subjectUser: {
            select: {
                id: true,
                fullName: true,
                role: true,
            },
        },
        reviewer: {
            select: {
                id: true,
                fullName: true,
                role: true,
            },
        },
    },
});
export const updateAccessReview = async (reviewId, adminUserId, input) => prisma.accessReview.update({
    where: {
        id: reviewId,
    },
    data: {
        reviewerUserId: input.reviewerUserId === undefined ? adminUserId : input.reviewerUserId,
        status: input.status,
        notes: input.notes,
        reviewedAt: input.reviewedAt
            ? new Date(input.reviewedAt)
            : input.status && input.status !== AccessReviewStatus.PENDING
                ? new Date()
                : undefined,
    },
    include: {
        subjectUser: {
            select: {
                id: true,
                fullName: true,
                role: true,
            },
        },
        reviewer: {
            select: {
                id: true,
                fullName: true,
                role: true,
            },
        },
    },
});
export const listDataGovernanceRequests = async () => prisma.dataGovernanceRequest.findMany({
    include: {
        subjectPatientProfile: {
            include: {
                user: {
                    select: {
                        id: true,
                        fullName: true,
                    },
                },
            },
        },
        subjectUser: {
            select: {
                id: true,
                fullName: true,
                role: true,
            },
        },
        requestedBy: {
            select: {
                id: true,
                fullName: true,
                role: true,
            },
        },
        handledBy: {
            select: {
                id: true,
                fullName: true,
                role: true,
            },
        },
    },
    orderBy: {
        requestedAt: 'desc',
    },
});
export const createDataGovernanceRequest = async (adminUserId, input) => prisma.dataGovernanceRequest.create({
    data: {
        subjectPatientProfileId: input.subjectPatientProfileId,
        subjectUserId: input.subjectUserId,
        requestedByUserId: adminUserId,
        handledByUserId: input.handledByUserId,
        type: input.type,
        status: input.status ?? GovernanceRequestStatus.PENDING,
        notes: input.notes,
        completedAt: input.completedAt ? new Date(input.completedAt) : undefined,
    },
    include: {
        subjectPatientProfile: {
            include: {
                user: {
                    select: {
                        id: true,
                        fullName: true,
                    },
                },
            },
        },
        subjectUser: {
            select: {
                id: true,
                fullName: true,
                role: true,
            },
        },
        requestedBy: {
            select: {
                id: true,
                fullName: true,
                role: true,
            },
        },
        handledBy: {
            select: {
                id: true,
                fullName: true,
                role: true,
            },
        },
    },
});
export const processDataGovernanceRequest = async (requestId, adminUserId, input) => {
    const request = await prisma.dataGovernanceRequest.findUnique({
        where: {
            id: requestId,
        },
        include: {
            subjectPatientProfile: {
                include: {
                    user: true,
                    consents: true,
                    appointments: {
                        include: {
                            doctor: {
                                include: {
                                    user: true,
                                },
                            },
                            review: true,
                            visitDetail: true,
                        },
                    },
                    serviceRequests: true,
                    reviews: true,
                },
            },
            subjectUser: true,
        },
    });
    if (!request) {
        throw new ApiError(404, 'Data governance request not found');
    }
    return prisma.$transaction(async (tx) => {
        let resultData;
        if (input.executeAction) {
            if (request.type === GovernanceRequestType.DATA_EXPORT) {
                resultData = await buildGovernanceExportData(tx, request);
            }
            else if (request.type === GovernanceRequestType.DATA_DELETION) {
                resultData = await executeGovernanceDeletion(tx, request);
            }
        }
        return tx.dataGovernanceRequest.update({
            where: {
                id: requestId,
            },
            data: {
                status: input.status ?? (input.executeAction ? GovernanceRequestStatus.COMPLETED : undefined),
                handledByUserId: input.handledByUserId === undefined ? adminUserId : input.handledByUserId,
                notes: input.notes,
                resultData,
                completedAt: input.executeAction || input.status === GovernanceRequestStatus.COMPLETED
                    ? new Date()
                    : undefined,
            },
            include: {
                subjectPatientProfile: {
                    include: {
                        user: {
                            select: {
                                id: true,
                                fullName: true,
                            },
                        },
                    },
                },
                subjectUser: {
                    select: {
                        id: true,
                        fullName: true,
                        role: true,
                    },
                },
                requestedBy: {
                    select: {
                        id: true,
                        fullName: true,
                        role: true,
                    },
                },
                handledBy: {
                    select: {
                        id: true,
                        fullName: true,
                        role: true,
                    },
                },
            },
        });
    });
};
export const listBackupOperations = async () => prisma.backupOperation.findMany({
    include: {
        initiatedBy: {
            select: {
                id: true,
                fullName: true,
                role: true,
            },
        },
    },
    orderBy: {
        startedAt: 'desc',
    },
});
export const createBackupOperation = async (adminUserId, input) => prisma.backupOperation.create({
    data: {
        type: input.type,
        status: input.status ?? BackupOperationStatus.PLANNED,
        provider: input.provider,
        location: input.location,
        notes: input.notes,
        startedAt: input.startedAt ? new Date(input.startedAt) : new Date(),
        completedAt: input.completedAt ? new Date(input.completedAt) : undefined,
        initiatedByUserId: adminUserId,
    },
    include: {
        initiatedBy: {
            select: {
                id: true,
                fullName: true,
                role: true,
            },
        },
    },
});
export const updateBackupOperation = async (operationId, input) => prisma.backupOperation.update({
    where: {
        id: operationId,
    },
    data: {
        status: input.status,
        provider: input.provider,
        location: input.location,
        notes: input.notes,
        resultSummary: input.resultSummary,
        errorMessage: input.errorMessage,
        completedAt: input.completedAt
            ? new Date(input.completedAt)
            : input.status === BackupOperationStatus.SUCCEEDED ||
                input.status === BackupOperationStatus.FAILED
                ? new Date()
                : undefined,
    },
    include: {
        initiatedBy: {
            select: {
                id: true,
                fullName: true,
                role: true,
            },
        },
    },
});
export const getAdminNotificationQueue = async (limit) => getNotificationQueueOverview(limit);
export const processAdminNotificationQueue = async (limit) => processQueuedNotificationDeliveries(limit ?? 50);
export const createAdminDoctorScheduleTemplate = async (doctorId, input) => createScheduleTemplateForDoctor(doctorId, input);
export const createAdminDoctorUnavailability = async (doctorId, input) => createDoctorUnavailability(doctorId, input);
export const getAdminDoctorSlots = async (doctorId, from, to) => listDoctorSlots(doctorId, from, to);
