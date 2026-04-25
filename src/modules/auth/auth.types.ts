import { z } from 'zod';
import { startPhoneAuthSchema, verifyPhoneAuthSchema } from './auth.schema.js';

export type StartPhoneAuthInput = z.infer<typeof startPhoneAuthSchema>;
export type VerifyPhoneAuthInput = z.infer<typeof verifyPhoneAuthSchema>;
