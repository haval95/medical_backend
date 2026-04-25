import type { Request, Response } from 'express';
import { ApiResponse } from '../../utils/ApiResponse.js';
import { asyncHandler } from '../../utils/asyncHandler.js';
import { getMyUserProfile, listUsers } from './user.service.js';

export const me = asyncHandler(async (req: Request, res: Response) => {
  const data = await getMyUserProfile(req.user!.id);
  res.json(ApiResponse.success('User profile retrieved successfully', data));
});

export const list = asyncHandler(async (_req: Request, res: Response) => {
  const data = await listUsers();
  res.json(ApiResponse.success('Users retrieved successfully', data));
});
