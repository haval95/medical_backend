import type { NextFunction, Request, Response } from 'express';
import { Permission, Role, UserStatus } from '@prisma/client';
import { prisma } from '../prisma/client.js';
import { ApiError } from '../utils/ApiError.js';
import { hasPermission } from '../utils/permissions.js';
import { setRequestActor } from '../utils/requestContext.js';
import { verifyAccessToken } from '../utils/token.js';

export const authenticate = async (
  req: Request,
  _res: Response,
  next: NextFunction
) => {
  const authHeader = req.headers.authorization;

  if (!authHeader?.startsWith('Bearer ')) {
    return next(new ApiError(401, 'Authentication token is required'));
  }

  try {
    const decoded = verifyAccessToken(authHeader.replace('Bearer ', ''));
    const user = await prisma.user.findUnique({
      where: { id: decoded.id },
      select: {
        id: true,
        phoneNumber: true,
        role: true,
        permissions: true,
        status: true,
      },
    });

    if (!user) {
      return next(new ApiError(401, 'Authentication token is invalid or expired'));
    }

    if (user.status !== UserStatus.ACTIVE) {
      return next(new ApiError(403, 'This account is disabled'));
    }

    req.user = user;
    setRequestActor({
      userId: user.id,
      role: user.role,
    });
    next();
  } catch {
    next(new ApiError(401, 'Authentication token is invalid or expired'));
  }
};

export const authorize =
  (...roles: Role[]) =>
  (req: Request, _res: Response, next: NextFunction) => {
    if (!req.user) {
      return next(new ApiError(401, 'Authentication is required'));
    }

    if (!roles.includes(req.user.role)) {
      return next(new ApiError(403, 'You do not have permission to access this resource'));
    }

    next();
  };

export const authorizePermissions =
  (...permissions: Permission[]) =>
  (req: Request, _res: Response, next: NextFunction) => {
    if (!req.user) {
      return next(new ApiError(401, 'Authentication is required'));
    }

    if (!hasPermission(req.user.permissions, permissions)) {
      return next(new ApiError(403, 'Missing required permissions'));
    }

    next();
  };
