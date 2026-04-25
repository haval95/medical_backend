import dotenv from 'dotenv';
import { z } from 'zod';

dotenv.config();

const envSchema = z.object({
  DATABASE_URL: z.string().url(),
  PORT: z.string().default('3000'),
  JWT_SECRET: z.string().min(10),
  ADMIN_COOKIE_SECRET: z.string().min(10),
  SESSION_SECRET: z.string().min(10),
  DO_SPACES_ENDPOINT: z.string().url(),
  DO_SPACES_REGION: z.string(),
  DO_SPACES_BUCKET: z.string(),
  DO_SPACES_ACCESS_KEY: z.string(),
  DO_SPACES_SECRET_KEY: z.string(),
  DO_SPACES_CDN_URL: z.string().url(),
  NODE_ENV: z
    .enum(['development', 'production', 'test'])
    .default('development'),
  GOOGLE_APPLICATION_CREDENTIALS: z.string().optional(),
  FCM_SENDER_ID: z.string().optional(),
  PROFILE_IMAGE_MAX_BYTES: z.string().optional(),
});

let env: z.infer<typeof envSchema>;
try {
  env = envSchema.parse(process.env);
} catch (error) {
  if (error instanceof z.ZodError) {
    console.error('❌ Environment variable validation failed:');
    error.issues.forEach((err: z.ZodIssue) => {
      console.error(`  - ${err.path.join('.')}: ${err.message}`);
    });
    console.error(
      '\n💡 Please check your .env file and ensure all required variables are set.'
    );
    process.exit(1);
  }
  throw error;
}

export { env };
