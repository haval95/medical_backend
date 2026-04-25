import { z } from 'zod';

export const registerSchema = z.object({
  email: z.string().email(),
  password: z.string().min(6),
  name: z.string().min(2, 'Full name is required'),
  phone: z.string().min(4).optional(),
  role: z.enum(['USER', 'ADMIN']).default('USER'),
  status: z.enum(['ACTIVE', 'ON_LEAVE', 'TERMINATED', 'SUSPENDED']).default('ACTIVE'),
  userCode: z.string().optional(),
  gender: z.string().optional(),
  dateOfBirth: z.coerce.date().optional(),
  nationality: z.string().optional(),
  maritalStatus: z.string().optional(),
  personalEmail: z.string().email().optional().or(z.literal('')),
  address: z.string().optional(),
  city: z.string().optional(),
  country: z.string().optional(),
  nationalIdNumber: z.string().optional(),
  passportNumber: z.string().optional(),
});

export const loginSchema = z.object({
  email: z.string().email(),
  password: z.string().min(1),
});

export const changePasswordSchema = z.object({
  currentPassword: z.string().min(1, 'Current password is required'),
  newPassword: z.string().min(6, 'New password must be at least 6 characters'),
});

export const refreshTokenSchema = z.object({
  refreshToken: z.string().min(1),
});

export const updateProfileSchema = registerSchema.omit({ role: true, status: true, userCode: true }).partial().extend({
    password: z.string().min(6).optional(),
});
