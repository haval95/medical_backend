import { OtpPurpose } from '@prisma/client';
import { z } from 'zod';
import { patientRegistrationSchema } from '../patient/patient.schema.js';

export const startPhoneAuthSchema = z.object({
  phoneNumber: z.string().trim().min(8).max(20),
  intent: z.nativeEnum(OtpPurpose).optional(),
});

export const verifyPhoneAuthSchema = z.object({
  challengeId: z.string().trim().min(10),
  otpCode: z.string().trim().length(6),
  registration: patientRegistrationSchema.optional(),
});
