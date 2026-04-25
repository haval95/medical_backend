import type { Request, Response } from 'express';
import { ApiResponse } from '../../utils/ApiResponse.js';
import { asyncHandler } from '../../utils/asyncHandler.js';
import {
  assignRequestSchema,
  createRequestSchema,
  updateRequestStatusSchema,
} from './request.schema.js';
import {
  assignDoctorToRequest,
  createServiceRequest,
  getRequestsForUser,
  updateServiceRequestStatus,
} from './request.service.js';

export const create = asyncHandler(async (req: Request, res: Response) => {
  const payload = createRequestSchema.parse(req.body);
  const data = await createServiceRequest(req.user!.id, payload);
  res.status(201).json(ApiResponse.success('Service request created successfully', data));
});

export const listMine = asyncHandler(async (req: Request, res: Response) => {
  const data = await getRequestsForUser(req.user!.id, req.user!.role);
  res.json(ApiResponse.success('Service requests retrieved successfully', data));
});

export const updateStatus = asyncHandler(async (req: Request, res: Response) => {
  const payload = updateRequestStatusSchema.parse(req.body);
  const data = await updateServiceRequestStatus(
    req.user!.id,
    req.user!.role,
    req.params.requestId,
    payload.status
  );
  res.json(ApiResponse.success('Service request status updated successfully', data));
});

export const assignDoctor = asyncHandler(async (req: Request, res: Response) => {
  const payload = assignRequestSchema.parse(req.body);
  const data = await assignDoctorToRequest(req.params.requestId, payload.doctorId);
  res.json(ApiResponse.success('Doctor assigned to service request successfully', data));
});
