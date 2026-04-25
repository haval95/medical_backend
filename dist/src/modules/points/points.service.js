import { PointsTransactionType } from '@prisma/client';
import { prisma } from '../../prisma/client.js';
import { ApiError } from '../../utils/ApiError.js';
const patientLedgerSelect = {
    id: true,
    type: true,
    points: true,
    balanceAfter: true,
    notes: true,
    createdAt: true,
};
export const applyPointsTransaction = async (db, patientProfileId, input) => {
    const patientProfile = await db.patientProfile.findUnique({
        where: { id: patientProfileId },
    });
    if (!patientProfile) {
        throw new ApiError(404, 'Patient profile not found');
    }
    const nextBalance = patientProfile.availablePoints + input.points;
    if (nextBalance < 0) {
        throw new ApiError(400, 'Insufficient points balance');
    }
    const updateData = {
        availablePoints: nextBalance,
    };
    if (input.points > 0) {
        updateData.lifetimePoints = {
            increment: input.points,
        };
    }
    await db.patientProfile.update({
        where: { id: patientProfileId },
        data: updateData,
    });
    return db.pointsTransaction.create({
        data: {
            patientProfileId,
            type: input.type,
            points: input.points,
            balanceAfter: nextBalance,
            notes: input.notes,
            serviceRequestId: input.serviceRequestId,
            referralEventId: input.referralEventId,
        },
        select: patientLedgerSelect,
    });
};
export const getMyPointsSummary = async (userId) => {
    const patientProfile = await prisma.patientProfile.findUnique({
        where: { userId },
        include: {
            pointsTransactions: {
                orderBy: { createdAt: 'desc' },
                take: 20,
                select: patientLedgerSelect,
            },
        },
    });
    if (!patientProfile) {
        throw new ApiError(404, 'Patient profile not found');
    }
    return {
        availablePoints: patientProfile.availablePoints,
        lifetimePoints: patientProfile.lifetimePoints,
        transactions: patientProfile.pointsTransactions,
    };
};
export const grantAdminAdjustment = async (patientProfileId, points, notes) => applyPointsTransaction(prisma, patientProfileId, {
    type: PointsTransactionType.ADMIN_ADJUSTMENT,
    points,
    notes,
});
