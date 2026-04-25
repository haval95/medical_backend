import { Router } from 'express';
import { Permission, Role } from '@prisma/client';
import {
  authenticate,
  authorize,
  authorizePermissions,
} from '../../middleware/authMiddleware.js';
import * as requestController from './request.controller.js';

const router = Router();

router.get('/', authenticate, requestController.listMine);
router.post('/', authenticate, authorize(Role.PATIENT), requestController.create);
router.patch(
  '/:requestId/status',
  authenticate,
  authorize(Role.DOCTOR, Role.ADMIN),
  authorizePermissions(Permission.REQUEST_UPDATE),
  requestController.updateStatus
);
router.patch(
  '/:requestId/assign',
  authenticate,
  authorize(Role.ADMIN),
  authorizePermissions(Permission.REQUEST_ASSIGN),
  requestController.assignDoctor
);

export default router;
