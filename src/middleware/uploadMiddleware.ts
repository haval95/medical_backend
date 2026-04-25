import multer from 'multer';
import { ApiError } from '../utils/ApiError.js';

// Configure multer to use memory storage
const storage = multer.memoryStorage();

// File filter for images only
const fileFilter = (
  req: any,
  file: Express.Multer.File,
  cb: multer.FileFilterCallback
) => {
  const allowedMimeTypes = [
    'image/jpeg',
    'image/jpg',
    'image/png',
    'image/webp',
  ];

  if (allowedMimeTypes.includes(file.mimetype)) {
    cb(null, true);
  } else {
    cb(new ApiError(400, 'Only image files (JPEG, PNG, WebP) are allowed'));
  }
};

// Create multer instance
export const upload = multer({
  storage,
  fileFilter,
  limits: {
    fileSize: 5 * 1024 * 1024, // 5MB max file size
  },
});

// Debug middleware to log request details
export const debugUpload = (req: any, res: any, next: any) => {
  console.log('--- Upload Middleware Debug ---');
  console.log('Headers:', req.headers);
  console.log('Body:', req.body);
  console.log('Files:', req.files);
  console.log('-------------------------------');
  next();
};
