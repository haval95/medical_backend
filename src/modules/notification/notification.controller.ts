import type { Request, Response } from 'express';
import { ApiResponse } from '../../utils/ApiResponse.js';
import { asyncHandler } from '../../utils/asyncHandler.js';
import { listMyNotifications, markNotificationRead, registerPushToken } from '../../utils/notifications.js';
import { registerPushTokenSchema } from './notification.schema.js';

export const listMine = asyncHandler(async (req: Request, res: Response) => {
  const data = await listMyNotifications(req.user!.id);
  res.json(ApiResponse.success('Notifications retrieved successfully', data));
});

export const registerDevice = asyncHandler(async (req: Request, res: Response) => {
  const payload = registerPushTokenSchema.parse(req.body);
  const data = await registerPushToken(req.user!.id, payload);
  res.status(201).json(ApiResponse.success('Push token registered successfully', data));
});

export const markRead = asyncHandler(async (req: Request, res: Response) => {
  await markNotificationRead(req.user!.id, req.params.notificationId);
  res.json(ApiResponse.success('Notification marked as read', { id: req.params.notificationId }));
});
