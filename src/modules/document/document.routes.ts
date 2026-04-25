import { Router } from 'express';
import { authenticate } from '../../middleware/authMiddleware';
import { uploadDocument as uploadDocumentMiddleware } from '../../middleware/documentUploadMiddleware';
import * as documentController from './document.controller';

const router = Router();

// Any authenticated user can upload a document
router.post(
  '/upload',
  authenticate,
  uploadDocumentMiddleware.single('document'), // 'document' is the field name in the form-data
  documentController.uploadDocument
);

router.get('/', authenticate, documentController.getMyDocuments);
router.delete('/:id', authenticate, documentController.deleteDocument);

export default router;
