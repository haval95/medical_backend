import type { Request, Response } from 'express';
import { ApiResponse } from '../../utils/ApiResponse.js';
import { asyncHandler } from '../../utils/asyncHandler.js';
import { getMyPointsSummary } from './points.service.js';

export const getMyPoints = asyncHandler(async (req: Request, res: Response) => {
  const data = await getMyPointsSummary(req.user!.id);
  res.json(ApiResponse.success('Points summary retrieved successfully', data));
});
