import jwt from 'jsonwebtoken';
import { env } from '../config/env';

export const generateToken = (userId: string, role: string, app?: string) => {
  return jwt.sign({ id: userId, role, app }, env.JWT_SECRET, {
    expiresIn: '7d',
  });
};

export const verifyToken = (token: string) => {
  return jwt.verify(token, env.JWT_SECRET) as { id: string; role: string; app?: string };
};
