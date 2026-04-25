import { Router } from 'express';
import * as authController from './auth.controller.js';
import { authenticate } from '../../middleware/authMiddleware.js';

const router = Router();

router.post('/register', authController.register);
router.post('/login', authController.login);
router.get('/me', authenticate, authController.getMe);
router.post('/push-token', authenticate, authController.savePushToken);
router.delete('/push-token', authenticate, authController.removePushToken);
router.patch('/me', authenticate, authController.updateProfile);
router.post('/change-password', authenticate, authController.changePassword);

export default router;
