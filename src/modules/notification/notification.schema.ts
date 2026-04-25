import { z } from 'zod';

export const registerPushTokenSchema = z.object({
  token: z.string().trim().min(10),
  platform: z.string().trim().min(2).max(20),
});
