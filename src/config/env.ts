import fs from 'fs';
import path from 'path';
import dotenv from 'dotenv';
import { fileURLToPath } from 'url';
import { z } from 'zod';

const currentFilePath = fileURLToPath(import.meta.url);
const currentDirectory = path.dirname(currentFilePath);
const envCandidates = Array.from(
  new Set([
    path.resolve(process.cwd(), '.env'),
    path.resolve(currentDirectory, '../../.env'),
    path.resolve(currentDirectory, '../../../.env'),
  ])
);
const envPath = envCandidates.find((candidate) => fs.existsSync(candidate));

dotenv.config(envPath ? { path: envPath } : undefined);

const envSchema = z.object({
  DATABASE_URL: z.string().min(1),
  PORT: z.coerce.number().int().positive().default(3001),
  JWT_SECRET: z.string().min(10),
  OTP_DEFAULT_CODE: z.string().length(6).default('123456'),
  DO_SPACES_ENDPOINT: z.string().url().default('https://sfo3.digitaloceanspaces.com'),
  DO_SPACES_REGION: z.string().default('sfo3'),
  DO_SPACES_BUCKET: z.string().default('havai-space'),
  DO_SPACES_ACCESS_KEY: z.string().optional(),
  DO_SPACES_SECRET_KEY: z.string().optional(),
  DO_SPACES_CDN_URL: z
    .string()
    .url()
    .default('https://havai-space.sfo3.cdn.digitaloceanspaces.com'),
  DO_SPACES_BASE_FOLDER: z.string().default('medical_sys'),
  NODE_ENV: z.enum(['development', 'production', 'test']).default('development'),
});

export const env = envSchema.parse(process.env);
