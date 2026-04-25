import { Router } from 'express';
import { Role } from '@prisma/client';
import { authenticate, authorize } from '../../middleware/authMiddleware.js';
import * as patientController from './patient.controller.js';

const router = Router();

router.get('/me/summary', authenticate, authorize(Role.PATIENT), patientController.getMySummary);
router.get(
  '/me/referrals',
  authenticate,
  authorize(Role.PATIENT),
  patientController.getMyReferralSummary
);
router.get(
  '/me/discounts',
  authenticate,
  authorize(Role.PATIENT),
  patientController.getMyDiscountSummary
);
router.patch('/me/profile', authenticate, authorize(Role.PATIENT), patientController.updateProfile);

export default router;
