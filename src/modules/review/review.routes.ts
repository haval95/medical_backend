import { Router } from 'express';
import { Permission, Role } from '@prisma/client';
import { authenticate, authorize, authorizePermissions } from '../../middleware/authMiddleware.js';
import * as reviewController from './review.controller.js';

const router = Router();

router.use(authenticate);

router.get('/', reviewController.listMine);
router.post('/', authorize(Role.PATIENT), reviewController.create);
router.patch('/:reviewId/reply', authorize(Role.DOCTOR), reviewController.reply);
router.patch(
  '/:reviewId/moderate',
  authorize(Role.ADMIN),
  authorizePermissions(Permission.REVIEW_MODERATE),
  reviewController.moderate
);

export default router;
