import { Router } from 'express';
import { authenticate } from '../../middleware/authMiddleware.js';
import * as notificationController from './notification.controller.js';
const router = Router();
router.use(authenticate);
router.get('/me', notificationController.listMine);
router.post('/device-tokens', notificationController.registerDevice);
router.patch('/:notificationId/read', notificationController.markRead);
export default router;
