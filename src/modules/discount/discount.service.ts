import { DiscountStatus, PointsTransactionType, Role } from '@prisma/client';
import { prisma } from '../../prisma/client.js';
import { ApiError } from '../../utils/ApiError.js';
import { applyPointsTransaction } from '../points/points.service.js';

export const getDiscountCatalog = async (userId?: string, role?: Role) => {
  const catalog = await prisma.discount.findMany({
    where: {
      status: DiscountStatus.ACTIVE,
    },
    orderBy: [{ isReferralReward: 'desc' }, { title: 'asc' }],
  });

  if (role !== Role.PATIENT || !userId) {
    return {
      catalog,
      patientDiscounts: [],
    };
  }

  const patientProfile = await prisma.patientProfile.findUnique({
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

  if (!patientProfile) {
    throw new ApiError(404, 'Patient profile not found');
  }

  return {
    catalog,
    patientDiscounts: patientProfile.patientDiscounts,
  };
};

export const redeemDiscount = async (userId: string, discountId: string) => {
  const [patientProfile, discount] = await Promise.all([
    prisma.patientProfile.findUnique({
      where: { userId },
    }),
    prisma.discount.findUnique({
      where: { id: discountId },
    }),
  ]);

  if (!patientProfile) {
    throw new ApiError(404, 'Patient profile not found');
  }

  if (!discount || discount.status !== DiscountStatus.ACTIVE) {
    throw new ApiError(404, 'Discount is not available');
  }

  if (!discount.pointsCost) {
    throw new ApiError(400, 'This discount cannot be redeemed with points');
  }

  const pointsCost = discount.pointsCost;

  const existingActiveReward = await prisma.patientDiscount.findFirst({
    where: {
      patientProfileId: patientProfile.id,
      discountId,
      status: DiscountStatus.ACTIVE,
    },
  });

  if (existingActiveReward) {
    throw new ApiError(400, 'This discount is already active for the patient');
  }

  return prisma.$transaction(async (tx) => {
    await applyPointsTransaction(tx, patientProfile.id, {
      type: PointsTransactionType.DISCOUNT_REDEMPTION,
      points: pointsCost * -1,
      notes: `Redeemed ${discount.title}`,
    });

    return tx.patientDiscount.create({
      data: {
        patientProfileId: patientProfile.id,
        discountId,
        expiresAt: new Date(Date.now() + 1000 * 60 * 60 * 24 * 30),
      },
      include: {
        discount: true,
      },
    });
  });
};
