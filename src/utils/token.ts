import jwt from 'jsonwebtoken';
import type { Permission, Role, UserStatus } from '@prisma/client';
import { env } from '../config/env.js';
import type { AuthenticatedUser } from '../types/auth.js';

export const generateAccessToken = (payload: AuthenticatedUser) =>
  jwt.sign(payload, env.JWT_SECRET, {
    expiresIn: '7d',
  });

export const verifyAccessToken = (token: string) =>
  jwt.verify(token, env.JWT_SECRET) as AuthenticatedUser;

export const buildAuthPayload = (
  id: string,
  phoneNumber: string,
  role: Role,
  permissions: Permission[],
  status: UserStatus
): AuthenticatedUser => ({
  id,
  phoneNumber,
  role,
  permissions,
  status,
});
