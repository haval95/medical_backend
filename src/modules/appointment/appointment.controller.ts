import type { Request, Response } from 'express';
import { ApiResponse } from '../../utils/ApiResponse.js';
import { asyncHandler } from '../../utils/asyncHandler.js';
import {
  appointmentCancellationDecisionSchema,
  appointmentCancellationRequestSchema,
  completeAppointmentSchema,
  createAppointmentSchema,
  listAppointmentsSchema,
  rescheduleAppointmentSchema,
  updateAppointmentStatusSchema,
} from './appointment.schema.js';
import {
  completeAppointment,
  createAppointment,
  listAppointments,
  requestAppointmentCancellation,
  rescheduleAppointment,
  reviewAppointmentCancellation,
  updateAppointmentStatus,
} from './appointment.service.js';

export const create = asyncHandler(async (req: Request, res: Response) => {
  const payload = createAppointmentSchema.parse(req.body);
  const data = await createAppointment(
    {
      userId: req.user!.id,
      role: req.user!.role,
    },
    payload
  );
  res.status(201).json(ApiResponse.success('Appointment created successfully', data));
});

export const listMine = asyncHandler(async (req: Request, res: Response) => {
  const filters = listAppointmentsSchema.parse(req.query);
  const data = await listAppointments(
    {
      userId: req.user!.id,
      role: req.user!.role,
    },
    filters
  );
  res.json(ApiResponse.success('Appointments retrieved successfully', data));
});

export const updateStatus = asyncHandler(async (req: Request, res: Response) => {
  const payload = updateAppointmentStatusSchema.parse(req.body);
  const data = await updateAppointmentStatus(
    {
      userId: req.user!.id,
      role: req.user!.role,
    },
    req.params.appointmentId,
    payload.status
  );
  res.json(ApiResponse.success('Appointment status updated successfully', data));
});

export const requestCancellation = asyncHandler(async (req: Request, res: Response) => {
  const payload = appointmentCancellationRequestSchema.parse(req.body);
  const data = await requestAppointmentCancellation(
    {
      userId: req.user!.id,
      role: req.user!.role,
    },
    req.params.appointmentId,
    payload.reason
  );
  res.json(ApiResponse.success('Appointment cancellation requested successfully', data));
});

export const reschedule = asyncHandler(async (req: Request, res: Response) => {
  const payload = rescheduleAppointmentSchema.parse(req.body);
  const data = await rescheduleAppointment(
    {
      userId: req.user!.id,
      role: req.user!.role,
    },
    req.params.appointmentId,
    payload
  );
  res.json(ApiResponse.success('Appointment rescheduled successfully', data));
});

export const reviewCancellation = asyncHandler(async (req: Request, res: Response) => {
  const payload = appointmentCancellationDecisionSchema.parse(req.body);
  const data = await reviewAppointmentCancellation(req.user!.id, req.params.appointmentId, payload);
  res.json(ApiResponse.success('Appointment cancellation reviewed successfully', data));
});

export const complete = asyncHandler(async (req: Request, res: Response) => {
  const payload = completeAppointmentSchema.parse(req.body);
  const data = await completeAppointment(req.user!.id, req.params.appointmentId, payload);
  res.json(ApiResponse.success('Appointment completed successfully', data));
});
