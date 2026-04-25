import { Request, Response } from 'express';
import {
  uploadFile as uploadFileToSpace,
  deleteFile as deleteFileFromSpace,
  listFiles as listFilesFromSpace,
} from '../../utils/upload';
import { ApiResponse } from '../../utils/ApiResponse';
import { env } from '../../config/env';
import * as userService from '../user/user.service';

export const uploadFile = async (req: Request, res: Response) => {
  const { folder } = req.body;
  const user = req.user;

  if (!req.file) {
    return res.status(400).json(ApiResponse.error('No file uploaded.'));
  }

  if (!user) {
    return res.status(401).json(ApiResponse.error('Unauthorized'));
  }

  // sanitize folder and build a user-prefixed subfolder
  const sanitizedSubRaw = folder
    ? String(folder).replace(/^\/+|\/+$/g, '')
    : '';
  const sanitizedSub = sanitizedSubRaw
    ? encodeURIComponent(sanitizedSubRaw)
    : '';

  // allow admins to upload files for another user by passing ownerId & ownerName
  const ownerId = req.body?.ownerId ? String(req.body.ownerId) : undefined;
  const ownerName = req.body?.ownerName
    ? String(req.body.ownerName)
    : undefined;

  // Only allow ownerId usage when authenticated user is ADMIN
  if (ownerId && user?.role !== 'ADMIN') {
    return res.status(403).json(ApiResponse.error('Forbidden'));
  }

  let folderName: string;
  if (ownerId && ownerName && user?.role === 'ADMIN') {
    const sanitizedOwnerName = encodeURIComponent(
      ownerName.replace(/^\/+|\/+$/g, '')
    );
    folderName = sanitizedSub
      ? `${ownerId}_${sanitizedOwnerName}/${sanitizedSub}`
      : `${ownerId}_${sanitizedOwnerName}`;
  } else {
    const sanitizedUserName = encodeURIComponent(
      String(user.name || '').replace(/^\/+|\/+$/g, '')
    );
    folderName = sanitizedSub
      ? `${user.id}_${sanitizedUserName}/${sanitizedSub}`
      : `${user.id}_${sanitizedUserName}`;
  }

  try {
    // Server-side validation for profile images
    const profileMaxBytes = Number(
      env.PROFILE_IMAGE_MAX_BYTES || 1 * 1024 * 1024
    );
    if (sanitizedSub === 'profile-images') {
      if (!req.file.mimetype.startsWith('image/')) {
        return res
          .status(400)
          .json(ApiResponse.error('Invalid file type for profile image.'));
      }
      if (req.file.size > profileMaxBytes) {
        return res
          .status(400)
          .json(
            ApiResponse.error(
              `Profile image must be under ${
                Math.round((profileMaxBytes / 1024 / 1024) * 100) / 100
              } MB.`
            )
          );
      }
    }

    const result = await uploadFileToSpace(
      req.file.buffer,
      folderName,
      req.file.originalname,
      req.file.mimetype
    );

    // If uploading to profile-images, persist the returned key to the user's record
    // Only persist when an explicit ownerId is provided (admin setting another user's image)
    // For personal profile updates, use PATCH /core/users/profile-image which will call uploadFileToSpace and persist
    if (sanitizedSub === 'profile-images') {
      if (ownerId) {
        const targetUserId = ownerId;
        try {
          const updatedUser = await userService.updateUser(targetUserId, {
            profileImage: result.key,
          });
          return res.status(200).json(
            ApiResponse.success('File uploaded and user updated', {
              upload: result,
              user: updatedUser,
            })
          );
        } catch (err) {
          console.error('Failed to save profile image to user:', err);
          return res
            .status(200)
            .json(
              ApiResponse.success(
                'File uploaded (failed to persist to user)',
                result
              )
            );
        }
      } else {
        // No ownerId provided — do not persist to DB to avoid accidentally overwriting uploader's profile (e.g., during user creation)
        return res
          .status(200)
          .json(ApiResponse.success('File uploaded', result));
      }
    }

    res.status(200).json(ApiResponse.success('File uploaded', result));
  } catch (error) {
    console.error(error);
    res.status(500).json(ApiResponse.error('Error uploading file.'));
  }
};

export const listFiles = async (req: Request, res: Response) => {
  const { userId, userName, sub } = req.query;
  const user = req.user;

  // only admins may request files for another user
  let targetId: string | undefined = undefined;
  let targetName: string | undefined = undefined;

  if (userId && String(userId) !== String(user?.id)) {
    if (user?.role !== 'ADMIN') {
      return res.status(403).json(ApiResponse.error('Forbidden'));
    }
    targetId = String(userId);
    targetName = String(userName || '');
  } else if (user) {
    targetId = String(user.id);
    targetName = String(user.name);
  } else {
    return res.status(401).json(ApiResponse.error('Unauthorized'));
  }

  const sanitizedSub = sub ? String(sub).replace(/^\/+|\/+$/g, '') : '';
  const prefix = sanitizedSub
    ? `${targetId}_${targetName}/${sanitizedSub}`
    : `${targetId}_${targetName}`;

  try {
    const results = await listFilesFromSpace(prefix);
    res
      .status(200)
      .json(ApiResponse.success('Files listed successfully', results));
  } catch (error) {
    console.error(error);
    res.status(500).json(ApiResponse.error('Error listing files.'));
  }
};

export const deleteFile = async (req: Request, res: Response) => {
  const { key } = req.body;
  const user = req.user;

  if (!user) return res.status(401).json(ApiResponse.error('Unauthorized'));
  if (!key)
    return res.status(400).json(ApiResponse.error('Missing key to delete'));

  try {
    await deleteFileFromSpace(key);
    res
      .status(200)
      .json(ApiResponse.success('File deleted successfully', null));
  } catch (error) {
    console.error(error);
    res.status(500).json(ApiResponse.error('Error deleting file.'));
  }
};
