import { ApiResponse } from '../../utils/ApiResponse.js';
import { asyncHandler } from '../../utils/asyncHandler.js';
import { createDoctorUnavailabilitySchema, createDoctorScheduleSlotSchema, createScheduleTemplateSchema, listDoctorSlotsSchema, updateDoctorScheduleSlotSchema, updateDoctorAvailabilitySchema, updateDoctorLocationSchema, updateDoctorProfileSchema, } from './doctor.schema.js';
import { createMyDoctorScheduleSlot, createMyDoctorUnavailability, createMyScheduleTemplate, deleteMyDoctorScheduleSlot, getDoctorDetails, getDoctorReviews, getMyDoctorSummary, listDoctorSlots, listDoctors, updateMyDoctorScheduleSlot, updateMyDoctorAvailability, updateMyDoctorLocation, updateMyDoctorProfile, } from './doctor.service.js';
export const getDoctors = asyncHandler(async (req, res) => {
    const data = await listDoctors(req.user?.role === 'PATIENT' ? req.user.id : undefined);
    res.json(ApiResponse.success('Doctors retrieved successfully', data));
});
export const getDoctor = asyncHandler(async (req, res) => {
    const data = await getDoctorDetails(req.params.doctorId, req.user?.role === 'PATIENT' ? req.user.id : undefined);
    res.json(ApiResponse.success('Doctor profile retrieved successfully', data));
});
export const getDoctorReviewList = asyncHandler(async (req, res) => {
    const data = await getDoctorReviews(req.params.doctorId);
    res.json(ApiResponse.success('Doctor reviews retrieved successfully', data));
});
export const getDoctorSlots = asyncHandler(async (req, res) => {
    const filters = listDoctorSlotsSchema.parse(req.query);
    const data = await listDoctorSlots(req.params.doctorId, filters.from, filters.to);
    res.json(ApiResponse.success('Doctor schedule slots retrieved successfully', data));
});
export const getMySummary = asyncHandler(async (req, res) => {
    const data = await getMyDoctorSummary(req.user.id);
    res.json(ApiResponse.success('Doctor summary retrieved successfully', data));
});
export const updateLocation = asyncHandler(async (req, res) => {
    const payload = updateDoctorLocationSchema.parse(req.body);
    const data = await updateMyDoctorLocation(req.user.id, payload);
    res.json(ApiResponse.success('Doctor location updated successfully', data));
});
export const updateProfile = asyncHandler(async (req, res) => {
    const payload = updateDoctorProfileSchema.parse(req.body);
    const data = await updateMyDoctorProfile(req.user.id, payload);
    res.json(ApiResponse.success('Doctor profile updated successfully', data));
});
export const updateAvailability = asyncHandler(async (req, res) => {
    const payload = updateDoctorAvailabilitySchema.parse(req.body);
    const data = await updateMyDoctorAvailability(req.user.id, payload);
    res.json(ApiResponse.success('Doctor availability updated successfully', data));
});
export const createScheduleTemplate = asyncHandler(async (req, res) => {
    const payload = createScheduleTemplateSchema.parse(req.body);
    const data = await createMyScheduleTemplate(req.user.id, payload);
    res
        .status(201)
        .json(ApiResponse.success('Doctor schedule applied successfully', data));
});
export const createUnavailability = asyncHandler(async (req, res) => {
    const payload = createDoctorUnavailabilitySchema.parse(req.body);
    const data = await createMyDoctorUnavailability(req.user.id, payload);
    res
        .status(201)
        .json(ApiResponse.success('Doctor unavailability created successfully', data));
});
export const createScheduleSlot = asyncHandler(async (req, res) => {
    const payload = createDoctorScheduleSlotSchema.parse(req.body);
    const data = await createMyDoctorScheduleSlot(req.user.id, payload);
    res.status(201).json(ApiResponse.success('Doctor schedule slot created successfully', data));
});
export const updateScheduleSlot = asyncHandler(async (req, res) => {
    const payload = updateDoctorScheduleSlotSchema.parse(req.body);
    const data = await updateMyDoctorScheduleSlot(req.user.id, req.params.slotId, payload);
    res.json(ApiResponse.success('Doctor schedule slot updated successfully', data));
});
export const deleteScheduleSlot = asyncHandler(async (req, res) => {
    await deleteMyDoctorScheduleSlot(req.user.id, req.params.slotId);
    res.json(ApiResponse.success('Doctor schedule slot deleted successfully', { id: req.params.slotId }));
});
