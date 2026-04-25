import type { Prisma } from '@prisma/client';

export interface PointsMutationInput {
  type: Prisma.PointsTransactionUncheckedCreateInput['type'];
  points: number;
  notes?: string;
  serviceRequestId?: string;
  referralEventId?: string;
}
