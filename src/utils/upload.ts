import { randomUUID } from 'crypto';
import { DeleteObjectCommand, PutObjectCommand, S3Client } from '@aws-sdk/client-s3';
import { env } from '../config/env.js';
import { ApiError } from './ApiError.js';

const ensureSpacesConfigured = () => {
  if (!env.DO_SPACES_ACCESS_KEY || !env.DO_SPACES_SECRET_KEY) {
    throw new ApiError(
      500,
      'DigitalOcean Spaces credentials are not configured on the backend environment'
    );
  }
};

const createSpacesClient = () => {
  ensureSpacesConfigured();

  return new S3Client({
    endpoint: env.DO_SPACES_ENDPOINT,
    region: env.DO_SPACES_REGION,
    credentials: {
      accessKeyId: env.DO_SPACES_ACCESS_KEY!,
      secretAccessKey: env.DO_SPACES_SECRET_KEY!,
    },
  });
};

const normalizeFolder = (folder: string) => folder.replace(/^\/+|\/+$/g, '');

export const getManagedUploadKeyFromUrl = (fileUrl?: string | null) => {
  if (!fileUrl) {
    return null;
  }

  const expectedPrefix = `${env.DO_SPACES_CDN_URL}/${normalizeFolder(env.DO_SPACES_BASE_FOLDER)}/`;

  if (!fileUrl.startsWith(expectedPrefix)) {
    return null;
  }

  return fileUrl.slice(`${env.DO_SPACES_CDN_URL}/`.length);
};

export const uploadFileToSpaces = async (input: {
  file: Buffer;
  folder: string;
  fileExtension?: string;
  mimeType: string;
}) => {
  const client = createSpacesClient();
  const extension = input.fileExtension?.replace(/^\./, '').toLowerCase();
  const key = [
    normalizeFolder(env.DO_SPACES_BASE_FOLDER),
    normalizeFolder(input.folder),
    `${randomUUID()}${extension ? `.${extension}` : ''}`,
  ].join('/');

  await client.send(
    new PutObjectCommand({
      Bucket: env.DO_SPACES_BUCKET,
      Key: key,
      Body: input.file,
      ACL: 'public-read',
      ContentType: input.mimeType,
    })
  );

  return {
    key,
    url: `${env.DO_SPACES_CDN_URL}/${key}`,
  };
};

export const deleteFileFromSpaces = async (key: string) => {
  const client = createSpacesClient();

  await client.send(
    new DeleteObjectCommand({
      Bucket: env.DO_SPACES_BUCKET,
      Key: key,
    })
  );
};
