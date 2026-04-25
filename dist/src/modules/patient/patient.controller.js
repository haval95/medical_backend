import { ApiResponse } from '../../utils/ApiResponse.js';
import { asyncHandler } from '../../utils/asyncHandler.js';
import { getMyPatientDiscountSummary, getMyPatientReferralSummary, getMyPatientSummary, updateMyPatientProfile, } from './patient.service.js';
import { updatePatientProfileSchema } from './patient.schema.js';
export const getMySummary = asyncHandler(async (req, res) => {
    const data = await getMyPatientSummary(req.user.id);
    res.json(ApiResponse.success('Patient summary retrieved successfully', data));
});
export const getMyReferralSummary = asyncHandler(async (req, res) => {
    const data = await getMyPatientReferralSummary(req.user.id);
    res.json(ApiResponse.success('Patient referral summary retrieved successfully', data));
});
export const getMyDiscountSummary = asyncHandler(async (req, res) => {
    const data = await getMyPatientDiscountSummary(req.user.id);
    res.json(ApiResponse.success('Patient discount summary retrieved successfully', data));
});
export const updateProfile = asyncHandler(async (req, res) => {
    const payload = updatePatientProfileSchema.parse(req.body);
    const data = await updateMyPatientProfile(req.user.id, payload);
    res.json(ApiResponse.success('Patient profile updated successfully', data));
});
