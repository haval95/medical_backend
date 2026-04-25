import { Router } from 'express';
import { authenticate } from '../../middleware/authMiddleware.js';
import * as referralController from './referral.controller.js';
const router = Router();
router.get('/validate/:code', referralController.validate);
router.get('/me', authenticate, referralController.getMine);
export default router;
