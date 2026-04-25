"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.debugUpload = exports.upload = void 0;
const multer_1 = __importDefault(require("multer"));
const ApiError_js_1 = require("../utils/ApiError.js");
// Configure multer to use memory storage
const storage = multer_1.default.memoryStorage();
// File filter for images only
const fileFilter = (req, file, cb) => {
    const allowedMimeTypes = [
        'image/jpeg',
        'image/jpg',
        'image/png',
        'image/webp',
    ];
    if (allowedMimeTypes.includes(file.mimetype)) {
        cb(null, true);
    }
    else {
        cb(new ApiError_js_1.ApiError(400, 'Only image files (JPEG, PNG, WebP) are allowed'));
    }
};
// Create multer instance
exports.upload = (0, multer_1.default)({
    storage,
    fileFilter,
    limits: {
        fileSize: 5 * 1024 * 1024, // 5MB max file size
    },
});
// Debug middleware to log request details
const debugUpload = (req, res, next) => {
    console.log('--- Upload Middleware Debug ---');
    console.log('Headers:', req.headers);
    console.log('Body:', req.body);
    console.log('Files:', req.files);
    console.log('-------------------------------');
    next();
};
exports.debugUpload = debugUpload;
