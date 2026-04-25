"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.deleteMultipleFiles = exports.deleteFile = exports.uploadMultipleFiles = exports.uploadFile = void 0;
const client_s3_1 = require("@aws-sdk/client-s3");
const env_js_1 = require("../config/env.js");
const crypto_1 = require("crypto");
// Initialize S3 client for DigitalOcean Spaces
const s3Client = new client_s3_1.S3Client({
    endpoint: env_js_1.env.DO_SPACES_ENDPOINT,
    region: env_js_1.env.DO_SPACES_REGION,
    credentials: {
        accessKeyId: env_js_1.env.DO_SPACES_ACCESS_KEY,
        secretAccessKey: env_js_1.env.DO_SPACES_SECRET_KEY,
    },
});
/**
 * Upload a file to DigitalOcean Spaces
 * @param file - The file buffer to upload
 * @param folder - The folder path in the bucket (e.g., 'products', 'shops')
 * @param filename - Optional custom filename (will generate UUID if not provided)
 * @returns The public URL and key of the uploaded file
 */
const uploadFile = async (file, folder, filename, mimeType, keyOverride) => {
    const key = keyOverride ?? `${folder}/${filename || (0, crypto_1.randomUUID)()}`;
    const command = new client_s3_1.PutObjectCommand({
        Bucket: env_js_1.env.DO_SPACES_BUCKET,
        Key: key,
        Body: file,
        ACL: 'public-read',
        ContentType: mimeType || 'image/jpeg',
    });
    await s3Client.send(command);
    const url = `${env_js_1.env.DO_SPACES_CDN_URL}/${key}`;
    return { url, key };
};
exports.uploadFile = uploadFile;
/**
 * Upload multiple files to DigitalOcean Spaces
 * @param files - Array of file buffers
 * @param folder - The folder path in the bucket
 * @returns Array of upload results
 */
const uploadMultipleFiles = async (files, folder) => {
    const uploadPromises = files.map((file) => (0, exports.uploadFile)(file.buffer, folder, file.filename, file.mimeType));
    return Promise.all(uploadPromises);
};
exports.uploadMultipleFiles = uploadMultipleFiles;
/**
 * Delete a file from DigitalOcean Spaces
 * @param key - The file key to delete
 */
const deleteFile = async (key) => {
    const command = new client_s3_1.DeleteObjectCommand({
        Bucket: env_js_1.env.DO_SPACES_BUCKET,
        Key: key,
    });
    await s3Client.send(command);
};
exports.deleteFile = deleteFile;
/**
 * Delete multiple files from DigitalOcean Spaces
 * @param keys - Array of file keys to delete
 */
const deleteMultipleFiles = async (keys) => {
    const deletePromises = keys.map((key) => (0, exports.deleteFile)(key));
    await Promise.all(deletePromises);
};
exports.deleteMultipleFiles = deleteMultipleFiles;
