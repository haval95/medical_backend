import { z } from 'zod';
import { registerSchema, loginSchema } from './auth.schema.js';

export type RegisterInput = z.infer<typeof registerSchema>;
export type LoginInput = z.infer<typeof loginSchema>;

export interface AuthResponse {
  user: {
    id: string;
    email: string;
    name: string | null;
    role: string;
    phone?: string | null;
    status?: string | null;
    userCode?: string | null;
    gender?: string | null;
    dateOfBirth?: string | Date | null;
    nationality?: string | null;
    maritalStatus?: string | null;
    personalEmail?: string | null;
    city?: string | null;
    country?: string | null;
    nationalIdNumber?: string | null;
    passportNumber?: string | null;
    profileImage?: string | null;
  };
  token: string;
  refreshToken?: string;
}

export interface JwtPayload {
  id: string;
  role: string;
  app?: string;
}
