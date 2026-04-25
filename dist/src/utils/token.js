import jwt from 'jsonwebtoken';
import { env } from '../config/env.js';
export const generateAccessToken = (payload) => jwt.sign(payload, env.JWT_SECRET, {
    expiresIn: '7d',
});
export const verifyAccessToken = (token) => jwt.verify(token, env.JWT_SECRET);
export const buildAuthPayload = (id, phoneNumber, role, permissions, status) => ({
    id,
    phoneNumber,
    role,
    permissions,
    status,
});
