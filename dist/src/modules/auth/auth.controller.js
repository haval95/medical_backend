import { ApiResponse } from '../../utils/ApiResponse.js';
import { asyncHandler } from '../../utils/asyncHandler.js';
import { startPhoneAuthSchema, verifyPhoneAuthSchema } from './auth.schema.js';
import { getMe, listPublicOnboardingSteps, startPhoneAuth, verifyPhoneAuth, } from './auth.service.js';
export const start = asyncHandler(async (req, res) => {
    const payload = startPhoneAuthSchema.parse(req.body);
    const data = await startPhoneAuth(payload);
    res.json(ApiResponse.success('Phone authentication started successfully', data));
});
export const verify = asyncHandler(async (req, res) => {
    const payload = verifyPhoneAuthSchema.parse(req.body);
    const data = await verifyPhoneAuth(payload);
    res.json(ApiResponse.success('Phone authentication completed successfully', data));
});
export const me = asyncHandler(async (req, res) => {
    const data = await getMe(req.user.id);
    res.json(ApiResponse.success('Authenticated user retrieved successfully', data));
});
export const onboardingSteps = asyncHandler(async (_req, res) => {
    const data = await listPublicOnboardingSteps();
    res.json(ApiResponse.success('Onboarding steps retrieved successfully', data));
});
