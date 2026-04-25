import type { Request, Response } from 'express';
import { ApiResponse } from '../../utils/ApiResponse.js';
import { asyncHandler } from '../../utils/asyncHandler.js';
import { getMyReferralSummary, validateReferralCode } from './referral.service.js';

export const validate = asyncHandler(async (req: Request, res: Response) => {
  const data = await validateReferralCode(req.params.code);
  res.json(ApiResponse.success('Referral code validated successfully', data));
});

export const getMine = asyncHandler(async (req: Request, res: Response) => {
  const data = await getMyReferralSummary(req.user!.id, req.user!.role);
  res.json(ApiResponse.success('Referral summary retrieved successfully', data));
});
