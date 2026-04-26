import { ApiResponse } from '../../utils/ApiResponse.js';
import { asyncHandler } from '../../utils/asyncHandler.js';
import { createMyPatientAddress, getMyPatientDiscountSummary, getMyPatientAddresses, getMyPatientReferralSummary, getMyPatientSummary, removeMyPatientAddress, updateMyPatientAddress, updateMyPatientProfile, } from './patient.service.js';
import { patientAddressSchema, updatePatientAddressSchema, updatePatientProfileSchema, } from './patient.schema.js';
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
export const listAddresses = asyncHandler(async (req, res) => {
    const data = await getMyPatientAddresses(req.user.id);
    res.json(ApiResponse.success('Patient addresses retrieved successfully', data));
});
export const createAddress = asyncHandler(async (req, res) => {
    const payload = patientAddressSchema.parse(req.body);
    const data = await createMyPatientAddress(req.user.id, payload);
    res.status(201).json(ApiResponse.success('Patient address created successfully', data));
});
export const updateAddress = asyncHandler(async (req, res) => {
    const payload = updatePatientAddressSchema.parse(req.body);
    const data = await updateMyPatientAddress(req.user.id, req.params.addressId, payload);
    res.json(ApiResponse.success('Patient address updated successfully', data));
});
export const deleteAddress = asyncHandler(async (req, res) => {
    await removeMyPatientAddress(req.user.id, req.params.addressId);
    res.json(ApiResponse.success('Patient address deleted successfully', { id: req.params.addressId }));
});
