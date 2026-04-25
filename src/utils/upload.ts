import {
  S3Client,
  PutObjectCommand,
  DeleteObjectCommand,
  ListObjectsV2Command,
} from '@aws-sdk/client-s3';
import { env } from '../config/env';
import { randomUUID } from 'crypto';

// Initialize S3 client for DigitalOcean Spaces
const s3Client = new S3Client({
  endpoint: env.DO_SPACES_ENDPOINT,
  region: env.DO_SPACES_REGION,
  credentials: {
    accessKeyId: env.DO_SPACES_ACCESS_KEY,
    secretAccessKey: env.DO_SPACES_SECRET_KEY,
  },
});

export interface UploadResult {
  url: string;
  key: string;
}

/**
 * Upload a file to DigitalOcean Spaces
 * @param file - The file buffer to upload
 * @param folder - The folder path in the bucket (e.g., 'products', 'shops')
 * @param filename - Optional custom filename (will generate UUID if not provided)
 * @returns The public URL and key of the uploaded file
 */
export const uploadFile = async (
  file: Buffer,
  folder: string,
  filename?: string,
  mimeType?: string,
  keyOverride?: string
): Promise<UploadResult> => {
  // Normalize folder and ensure top-level prefix 'hr-system'
  const normalizedFolder = folder ? folder.replace(/^\/+|\/+$/g, '') : '';

  // break into segments and (re)encode to avoid spaces / unsafe characters
  const segments = normalizedFolder
    ? normalizedFolder
        .split('/')
        .filter(Boolean)
        .map((seg) => {
          try {
            return encodeURIComponent(decodeURIComponent(seg));
          } catch {
            return encodeURIComponent(seg);
          }
        })
    : [];

  let finalFolder = 'hr-system';
  if (segments.length) {
    // ensure 'hr-system' top-level prefix
    if (segments[0] === 'hr-system') {
      finalFolder = segments.join('/');
    } else {
      finalFolder = `hr-system/${segments.join('/')}`;
    }
  }

  // include timestamp in filename to make uploaded keys unique and preserve extension
  const sanitizedFilename = filename ? encodeURIComponent(filename) : undefined;
  const uniquePart = sanitizedFilename
    ? `${Date.now()}-${sanitizedFilename}`
    : randomUUID();
  const key = keyOverride ?? `${finalFolder}/${uniquePart}`;

  const command = new PutObjectCommand({
    Bucket: env.DO_SPACES_BUCKET,
    Key: key,
    Body: file,
    ACL: 'public-read',
    ContentType: mimeType || 'image/jpeg',
    CacheControl: 'public, max-age=31536000, immutable',
    ContentDisposition: sanitizedFilename
      ? `inline; filename="${sanitizedFilename}"`
      : undefined,
  });

  await s3Client.send(command);

  const url = encodeURI(`${env.DO_SPACES_CDN_URL}/${key}`);
  return { url, key };
};

/**
 * Upload multiple files to DigitalOcean Spaces
 * @param files - Array of file buffers
 * @param folder - The folder path in the bucket
 * @returns Array of upload results
 */
export const uploadMultipleFiles = async (
  files: Array<{ buffer: Buffer; mimeType?: string; filename?: string }>,
  folder: string
): Promise<UploadResult[]> => {
  const uploadPromises = files.map((file) =>
    uploadFile(file.buffer, folder, file.filename, file.mimeType)
  );

  return Promise.all(uploadPromises);
};

/**
 * List files under a prefix in the bucket
 * @param prefix - The key prefix to list (e.g., 'hr-system/123_john/profile-images/')
 * @returns Array of upload results (url + key)
 */
export const listFiles = async (prefix: string): Promise<UploadResult[]> => {
  const normalizedPrefix = prefix ? prefix.replace(/^\/+|\/+$/g, '') : '';

  const segments = normalizedPrefix
    ? normalizedPrefix
        .split('/')
        .filter(Boolean)
        .map((seg) => {
          try {
            return encodeURIComponent(decodeURIComponent(seg));
          } catch {
            return encodeURIComponent(seg);
          }
        })
    : [];

  let listPrefix = 'hr-system';
  if (segments.length) {
    if (segments[0] === 'hr-system') {
      listPrefix = segments.join('/');
    } else {
      listPrefix = `hr-system/${segments.join('/')}`;
    }
  }

  const command = new ListObjectsV2Command({
    Bucket: env.DO_SPACES_BUCKET,
    Prefix: listPrefix,
    MaxKeys: 1000,
  });

  const response = await s3Client.send(command);
  const contents = response.Contents || [];

  return contents
    .filter((obj) => !!obj.Key)
    .map((obj) => ({
      key: obj.Key as string,
      url: encodeURI(`${env.DO_SPACES_CDN_URL}/${obj.Key}`),
    }));
};

/**
 * Delete a file from DigitalOcean Spaces
 * @param key - The file key to delete
 */
export const deleteFile = async (key: string): Promise<void> => {
  const command = new DeleteObjectCommand({
    Bucket: env.DO_SPACES_BUCKET,
    Key: key,
  });

  await s3Client.send(command);
};

/**
 * Delete multiple files from DigitalOcean Spaces
 * @param keys - Array of file keys to delete
 */
export const deleteMultipleFiles = async (keys: string[]): Promise<void> => {
  const deletePromises = keys.map((key) => deleteFile(key));
  await Promise.all(deletePromises);
};
