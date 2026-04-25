import { Request, Response, NextFunction } from 'express';
import { verifyToken } from '../utils/token';
import { ApiError } from '../utils/ApiError';

export const authenticate = (
  req: Request,
  res: Response,
  next: NextFunction
) => {
  const authHeader = req.headers.authorization;

  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return next(new ApiError(401, 'Unauthorized - No token provided'));
  }

  const token = authHeader.split(' ')[1];

  try {
    const decoded = verifyToken(token);
    const appHeader = (req.headers['x-app'] || req.headers['x-app-context']) as
      | string
      | undefined;

    if (decoded.app && appHeader && decoded.app !== appHeader) {
      return next(new ApiError(403, 'Forbidden - Wrong application context'));
    }

    req.user = decoded as any;
    next();
  } catch (error) {
    next(new ApiError(401, 'Unauthorized - Invalid token'));
  }
};

export const authorize = (roles: string[]) => {
  return (req: Request, res: Response, next: NextFunction) => {
    if (!req.user) {
      return next(new ApiError(401, 'Unauthorized - User not authenticated'));
    }

    if (!roles.includes(req.user.role)) {
      return next(new ApiError(403, 'Forbidden - Insufficient permissions'));
    }

    next();
  };
};
