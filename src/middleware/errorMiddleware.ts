import { Request, Response, NextFunction } from 'express';
import { ApiError } from '../utils/ApiError.js';
import { ApiResponse } from '../utils/ApiResponse.js';
import { ZodError } from 'zod';

export const errorMiddleware = (
  err: any,
  req: Request,
  res: Response,
  next: NextFunction
) => {
  console.error(err);

  if (err instanceof ApiError) {
    return res
      .status(err.statusCode)
      .json(ApiResponse.error(err.message, err.errors));
  }

  if (err instanceof ZodError) {
    return res
      .status(400)
      .json(ApiResponse.error('Validation Error', err.issues));
  }

  return res
    .status(500)
    .json(ApiResponse.error('Internal Server Error'));
};
