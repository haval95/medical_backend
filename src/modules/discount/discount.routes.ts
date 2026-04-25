import { Router } from 'express';
import { Role } from '@prisma/client';
import { authenticate, authorize } from '../../middleware/authMiddleware.js';
import * as discountController from './discount.controller.js';

const router = Router();

router.get('/', authenticate, discountController.list);
router.post(
  '/:discountId/redeem',
  authenticate,
  authorize(Role.PATIENT),
  discountController.redeem
);

export default router;
