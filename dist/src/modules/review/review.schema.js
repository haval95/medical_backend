import { z } from 'zod';
export const createReviewSchema = z.object({
    appointmentId: z.string().trim().min(10),
    rating: z.number().int().min(1).max(5),
    comment: z.string().trim().max(1500).optional(),
});
export const replyReviewSchema = z.object({
    doctorReply: z.string().trim().min(2).max(1500),
});
export const moderateReviewSchema = z.object({
    isHidden: z.boolean(),
    hiddenReason: z.string().trim().max(500).optional(),
});
