import { Router } from 'express';
import { authenticate, authorize } from '../../middleware/authMiddleware';
import * as userController from './user.controller';
import { upload } from '../../middleware/uploadMiddleware';

const router = Router();

// User-specific routes
router.patch(
  '/profile-image',
  authenticate,
  upload.single('profileImage'),
  userController.updateProfileImage
);

// Admin: delete profile image for a given user
router.delete(
  '/:id/profile-image',
  authenticate,
  authorize(['ADMIN']),
  userController.deleteProfileImage
);

// All user management endpoints require ADMIN role
router.get('/', authenticate, authorize(['ADMIN']), userController.listUsers);
router.get('/:id', authenticate, authorize(['ADMIN']), userController.getUser);
router.post(
  '/',
  authenticate,
  authorize(['ADMIN']),
  upload.single('profileImage'),
  userController.createUser
);
router.patch(
  '/:id',
  authenticate,
  authorize(['ADMIN']),
  userController.updateUser
);
router.delete(
  '/:id',
  authenticate,
  authorize(['ADMIN']),
  userController.deleteUser
);
router.post(
  '/bulk-delete',
  authenticate,
  authorize(['ADMIN']),
  userController.bulkDelete
);

export default router;
