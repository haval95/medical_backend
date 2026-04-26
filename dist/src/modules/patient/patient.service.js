import { AppointmentStatus, DiscountStatus, PointsTransactionType, ReferralEventType, Role, } from '@prisma/client';
import { prisma } from '../../prisma/client.js';
import { ApiError } from '../../utils/ApiError.js';
import { decimalToNumber, toDecimalInput } from '../../utils/geo.js';
import { normalizePhoneNumber } from '../../utils/phone.js';
import { resolvePermissions } from '../../utils/permissions.js';
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
const serializeAddress = (address) => ({
    id: address.id,
    label: address.label,
    fullAddress: address.fullAddress,
    city: address.city,
    latitude: decimalToNumber(address.latitude),
    longitude: decimalToNumber(address.longitude),
    phoneNumber: address.phoneNumber,
    notes: address.notes,
    isDefault: address.isDefault,
    createdAt: address.createdAt,
    updatedAt: address.updatedAt,
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
const buildPatientProfileUpdate = (input) => ({
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
const syncPatientDefaultAddress = async (tx, patientProfileId, input) => {
    const existingDefault = await tx.patientAddress.findFirst({
        where: {
            patientProfileId,
            isDefault: true,
        },
        orderBy: {
            createdAt: 'asc',
        },
    });
    if (existingDefault) {
        return tx.patientAddress.update({
            where: { id: existingDefault.id },
            data: {
                label: input.label,
                fullAddress: input.fullAddress,
                city: input.city,
                latitude: toDecimalInput(input.latitude),
                longitude: toDecimalInput(input.longitude),
                phoneNumber: normalizePhoneNumber(input.phoneNumber),
                notes: input.notes,
                isDefault: true,
            },
        });
    }
    return tx.patientAddress.create({
        data: {
            patientProfileId,
            label: input.label,
            fullAddress: input.fullAddress,
            city: input.city,
            latitude: toDecimalInput(input.latitude),
            longitude: toDecimalInput(input.longitude),
            phoneNumber: normalizePhoneNumber(input.phoneNumber),
            notes: input.notes,
            isDefault: input.isDefault ?? true,
        },
    });
};
const ensurePatientAddressBootstrap = async (tx, profile) => {
    const addressCount = await tx.patientAddress.count({
        where: { patientProfileId: profile.id },
    });
    if (addressCount > 0 || !profile.homeAddress || !profile.city) {
        return;
    }
    await tx.patientAddress.create({
        data: {
            patientProfileId: profile.id,
            label: 'Home',
            fullAddress: profile.homeAddress,
            city: profile.city,
            latitude: profile.latitude,
            longitude: profile.longitude,
            phoneNumber: profile.user.phoneNumber,
            isDefault: true,
        },
    });
};
const formatPatientSummary = (profile) => ({
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
export const createPatientFromRegistration = async (input) => {
    const referralCode = input.referralCode?.toUpperCase();
    return prisma.$transaction(async (tx) => {
        let referredDoctor = null;
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
        if (input.homeAddress && input.city) {
            await syncPatientDefaultAddress(tx, patientProfile.id, {
                label: 'Home',
                fullAddress: input.homeAddress,
                city: input.city,
                latitude: input.latitude,
                longitude: input.longitude,
                phoneNumber: user.phoneNumber,
                isDefault: true,
            });
        }
        if (referredDoctor) {
            const referralEvent = await tx.referralEvent.create({
                data: {
                    doctorId: referredDoctor.id,
                    patientProfileId: patientProfile.id,
                    type: ReferralEventType.PATIENT_REGISTRATION,
                    referralCode: referralCode,
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
export const getPatientProfileByUserId = async (userId) => {
    const profile = await prisma.patientProfile.findUnique({
        where: { userId },
        include: patientSummaryInclude,
    });
    if (!profile) {
        throw new ApiError(404, 'Patient profile not found');
    }
    return profile;
};
export const getMyPatientSummary = async (userId) => {
    const profile = await getPatientProfileByUserId(userId);
    await prisma.$transaction(async (tx) => {
        await ensurePatientAddressBootstrap(tx, profile);
    });
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
export const getMyPatientReferralSummary = async (userId) => {
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
export const getMyPatientDiscountSummary = async (userId) => {
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
export const updateMyPatientProfile = async (userId, input) => {
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
        if (input.homeAddress && input.city) {
            await syncPatientDefaultAddress(tx, profile.id, {
                label: 'Home',
                fullAddress: input.homeAddress,
                city: input.city,
                latitude: input.latitude,
                longitude: input.longitude,
                phoneNumber: input.emergencyContactPhone || profile.user.phoneNumber,
                notes: input.notes,
                isDefault: true,
            });
        }
    });
    const refreshed = await getPatientProfileByUserId(userId);
    return formatPatientSummary(refreshed);
};
export const getMyPatientAddresses = async (userId) => {
    const profile = await getPatientProfileByUserId(userId);
    await prisma.$transaction(async (tx) => {
        await ensurePatientAddressBootstrap(tx, profile);
    });
    const addresses = await prisma.patientAddress.findMany({
        where: { patientProfileId: profile.id },
        orderBy: [{ isDefault: 'desc' }, { createdAt: 'asc' }],
    });
    return addresses.map(serializeAddress);
};
export const createMyPatientAddress = async (userId, input) => {
    const profile = await getPatientProfileByUserId(userId);
    const created = await prisma.$transaction(async (tx) => {
        if (input.isDefault) {
            await tx.patientAddress.updateMany({
                where: {
                    patientProfileId: profile.id,
                    isDefault: true,
                },
                data: {
                    isDefault: false,
                },
            });
        }
        const address = await tx.patientAddress.create({
            data: {
                patientProfileId: profile.id,
                label: input.label,
                fullAddress: input.fullAddress,
                city: input.city,
                latitude: toDecimalInput(input.latitude),
                longitude: toDecimalInput(input.longitude),
                phoneNumber: normalizePhoneNumber(input.phoneNumber),
                notes: input.notes,
                isDefault: input.isDefault ?? false,
            },
        });
        if (address.isDefault) {
            await tx.patientProfile.update({
                where: { id: profile.id },
                data: {
                    city: address.city,
                    homeAddress: address.fullAddress,
                    latitude: address.latitude,
                    longitude: address.longitude,
                },
            });
        }
        return address;
    });
    return serializeAddress(created);
};
export const updateMyPatientAddress = async (userId, addressId, input) => {
    const profile = await getPatientProfileByUserId(userId);
    const existing = await prisma.patientAddress.findFirst({
        where: {
            id: addressId,
            patientProfileId: profile.id,
        },
    });
    if (!existing) {
        throw new ApiError(404, 'Patient address not found');
    }
    const updated = await prisma.$transaction(async (tx) => {
        if (input.isDefault) {
            await tx.patientAddress.updateMany({
                where: {
                    patientProfileId: profile.id,
                    isDefault: true,
                },
                data: {
                    isDefault: false,
                },
            });
        }
        const address = await tx.patientAddress.update({
            where: { id: addressId },
            data: {
                label: input.label,
                fullAddress: input.fullAddress,
                city: input.city,
                latitude: input.latitude === undefined ? undefined : toDecimalInput(input.latitude),
                longitude: input.longitude === undefined ? undefined : toDecimalInput(input.longitude),
                phoneNumber: input.phoneNumber
                    ? normalizePhoneNumber(input.phoneNumber)
                    : undefined,
                notes: input.notes,
                isDefault: input.isDefault,
            },
        });
        if (address.isDefault) {
            await tx.patientProfile.update({
                where: { id: profile.id },
                data: {
                    city: address.city,
                    homeAddress: address.fullAddress,
                    latitude: address.latitude,
                    longitude: address.longitude,
                },
            });
        }
        return address;
    });
    return serializeAddress(updated);
};
export const removeMyPatientAddress = async (userId, addressId) => {
    const profile = await getPatientProfileByUserId(userId);
    const existing = await prisma.patientAddress.findFirst({
        where: {
            id: addressId,
            patientProfileId: profile.id,
        },
    });
    if (!existing) {
        throw new ApiError(404, 'Patient address not found');
    }
    await prisma.$transaction(async (tx) => {
        await tx.patientAddress.delete({
            where: { id: addressId },
        });
        if (!existing.isDefault) {
            return;
        }
        const nextDefault = await tx.patientAddress.findFirst({
            where: { patientProfileId: profile.id },
            orderBy: { createdAt: 'asc' },
        });
        if (nextDefault) {
            await tx.patientAddress.update({
                where: { id: nextDefault.id },
                data: { isDefault: true },
            });
            await tx.patientProfile.update({
                where: { id: profile.id },
                data: {
                    city: nextDefault.city,
                    homeAddress: nextDefault.fullAddress,
                    latitude: nextDefault.latitude,
                    longitude: nextDefault.longitude,
                },
            });
            return;
        }
        await tx.patientProfile.update({
            where: { id: profile.id },
            data: {
                city: null,
                homeAddress: null,
                latitude: null,
                longitude: null,
            },
        });
    });
};
