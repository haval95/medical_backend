import { Router } from 'express';
import { Permission, Role } from '@prisma/client';
import { authenticate, authorize, authorizePermissions } from '../../middleware/authMiddleware.js';
import * as appointmentController from './appointment.controller.js';

const router = Router();

router.use(authenticate);

router.get('/', appointmentController.listMine);
router.post('/', authorize(Role.PATIENT, Role.ADMIN), appointmentController.create);
router.patch(
  '/:appointmentId/status',
  authorize(Role.DOCTOR, Role.ADMIN),
  appointmentController.updateStatus
);
router.post(
  '/:appointmentId/cancellation-request',
  authorize(Role.DOCTOR),
  appointmentController.requestCancellation
);
router.post(
  '/:appointmentId/cancellation-review',
  authorize(Role.ADMIN),
  authorizePermissions(Permission.APPOINTMENT_MANAGE),
  appointmentController.reviewCancellation
);
router.post('/:appointmentId/complete', authorize(Role.DOCTOR), appointmentController.complete);

export default router;
