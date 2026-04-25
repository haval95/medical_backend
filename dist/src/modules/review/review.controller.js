import { ApiResponse } from '../../utils/ApiResponse.js';
import { asyncHandler } from '../../utils/asyncHandler.js';
import { createReviewSchema, moderateReviewSchema, replyReviewSchema } from './review.schema.js';
import { createReview, listReviews, moderateReview, replyToReview } from './review.service.js';
export const listMine = asyncHandler(async (req, res) => {
    const data = await listReviews({
        userId: req.user.id,
        role: req.user.role,
    });
    res.json(ApiResponse.success('Reviews retrieved successfully', data));
});
export const create = asyncHandler(async (req, res) => {
    const payload = createReviewSchema.parse(req.body);
    const data = await createReview(req.user.id, payload);
    res.status(201).json(ApiResponse.success('Review created successfully', data));
});
export const reply = asyncHandler(async (req, res) => {
    const payload = replyReviewSchema.parse(req.body);
    const data = await replyToReview(req.user.id, req.params.reviewId, payload.doctorReply);
    res.json(ApiResponse.success('Review reply saved successfully', data));
});
export const moderate = asyncHandler(async (req, res) => {
    const payload = moderateReviewSchema.parse(req.body);
    const data = await moderateReview(req.params.reviewId, payload);
    res.json(ApiResponse.success('Review moderation updated successfully', data));
});
