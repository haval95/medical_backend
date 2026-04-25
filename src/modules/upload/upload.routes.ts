import { Router } from 'express';
import multer from 'multer';
import * as uploadController from './upload.controller';
import { authenticate } from '../../middleware/authMiddleware';

const router = Router();

// Configure multer with a sensible default file size limit (5MB) or override with UPLOAD_MAX_BYTES env var
const maxUploadBytes = Number(process.env.UPLOAD_MAX_BYTES || 5 * 1024 * 1024);
const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: maxUploadBytes },
});

router.post(
  '/upload',
  authenticate,
  upload.single('file'),
  uploadController.uploadFile
);
router.delete('/', authenticate, uploadController.deleteFile);
router.get('/list', authenticate, uploadController.listFiles);

export default router;
