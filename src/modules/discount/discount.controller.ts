import type { Request, Response } from 'express';
import { ApiResponse } from '../../utils/ApiResponse.js';
import { asyncHandler } from '../../utils/asyncHandler.js';
import { getDiscountCatalog, redeemDiscount } from './discount.service.js';

export const list = asyncHandler(async (req: Request, res: Response) => {
  const data = await getDiscountCatalog(req.user?.id, req.user?.role);
  res.json(ApiResponse.success('Discounts retrieved successfully', data));
});

export const redeem = asyncHandler(async (req: Request, res: Response) => {
  const data = await redeemDiscount(req.user!.id, req.params.discountId);
  res.json(ApiResponse.success('Discount redeemed successfully', data));
});
