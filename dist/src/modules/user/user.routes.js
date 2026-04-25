import { Router } from 'express';
import { Role } from '@prisma/client';
import { authenticate, authorize } from '../../middleware/authMiddleware.js';
import * as userController from './user.controller.js';
const router = Router();
router.get('/me', authenticate, userController.me);
router.get('/', authenticate, authorize(Role.ADMIN), userController.list);
export default router;
