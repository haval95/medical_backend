import { Router } from 'express';
import { Role } from '@prisma/client';
import { authenticate, authorize } from '../../middleware/authMiddleware.js';
import * as pointsController from './points.controller.js';
const router = Router();
router.get('/me', authenticate, authorize(Role.PATIENT), pointsController.getMyPoints);
export default router;
