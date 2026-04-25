import { Router } from 'express';
import { authenticate } from '../../middleware/authMiddleware.js';
import { authRateLimit } from '../../middleware/rateLimit.js';
import * as authController from './auth.controller.js';
const router = Router();
router.post('/phone/start', authRateLimit, authController.start);
router.post('/phone/verify', authRateLimit, authController.verify);
router.get('/me', authenticate, authController.me);
export default router;
