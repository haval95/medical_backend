import { Request, Response, NextFunction } from 'express';
import * as authService from './auth.service.js';
import { registerSchema, loginSchema, changePasswordSchema, updateProfileSchema } from './auth.schema.js';
import { ApiResponse } from '../../utils/ApiResponse.js';

export const register = async (
  req: Request,
  res: Response,
  next: NextFunction
) => {
  try {
    const body = registerSchema.parse(req.body);
    const result = await authService.register(body);
    res
      .status(201)
      .json(ApiResponse.success('User registered successfully', result));
  } catch (error) {
    next(error);
  }
};

export const login = async (
  req: Request,
  res: Response,
  next: NextFunction
) => {
  try {
    const body = loginSchema.parse(req.body);
    const result = await authService.login(body);
    res.status(200).json(ApiResponse.success('Login successful', result));
  } catch (error) {
    next(error);
  }
};

export const getMe = async (
  req: Request,
  res: Response,
  next: NextFunction
) => {
  try {
    const user = await authService.getMe(req.user!.id);
    res.json(ApiResponse.success('User profile retrieved successfully', user));
  } catch (error) {
    next(error);
  }
};

export const savePushToken = async (
  req: Request,
  res: Response,
  next: NextFunction
) => {
  try {
    const { token } = req.body;
    if (!token) {
      throw new Error('Push token is required');
    }
    await authService.savePushToken(req.user!.id, token);
    res.json(ApiResponse.success('Push token saved', null));
  } catch (error) {
    next(error);
  }
};

export const removePushToken = async (
  req: Request,
  res: Response,
  next: NextFunction
) => {
  try {
    await authService.removePushToken(req.user!.id);
    res.json(ApiResponse.success('Push token removed', null));
  } catch (error) {
    next(error);
  }
};

export const updateProfile = async (
  req: Request,
  res: Response,
  next: NextFunction
) => {
  try {
    const body = updateProfileSchema.parse(req.body);
    const user = await authService.updateProfile(req.user!.id, body);
    res.json(ApiResponse.success('Profile updated', user));
  } catch (error) {
    next(error);
  }
};

export const changePassword = async (
  req: Request,
  res: Response,
  next: NextFunction
) => {
  try {
    const body = changePasswordSchema.parse(req.body);
    await authService.changePassword(req.user!.id, body);
    res.json(ApiResponse.success('Password changed successfully', null));
  } catch (error) {
    next(error);
  }
};
