import { Request, Response, NextFunction } from 'express';
import * as userService from './user.service';
import { ApiResponse } from '../../utils/ApiResponse';
import { uploadFile as uploadFileToSpace } from '../../utils/upload';
import { env } from '../../config/env';
import { ApiError } from '../../utils/ApiError';

export const updateProfileImage = async (
  req: Request,
  res: Response,
  next: NextFunction
) => {
  try {
    const currentUser = req.user;
    if (!currentUser) {
      throw new ApiError(401, 'Unauthorized');
    }

    if (!req.file) {
      throw new ApiError(400, 'No file uploaded.');
    }

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    let targetUser: any = currentUser;
    
    // If admin and userId is provided, fetch target user
    if (req.body.userId && currentUser.role === 'ADMIN' && req.body.userId !== currentUser.id) {
         try {
            targetUser = await userService.getUserById(req.body.userId);
         } catch (error) {
             throw new ApiError(404, 'Target user not found');
         }
    }

    const sanitizedUserName = encodeURIComponent(
      String(targetUser.name || '').replace(/^\/+|\/+$/g, '')
    );
    const folderName = `${targetUser.id}_${sanitizedUserName}/profile-images`;

    if (!req.file.mimetype.startsWith('image/')) {
      throw new ApiError(400, 'Invalid file type for profile image');
    }

    const profileMaxBytes = Number(
      env.PROFILE_IMAGE_MAX_BYTES || 1 * 1024 * 1024
    );
    if (req.file.size > profileMaxBytes) {
      throw new ApiError(
        400,
        `Profile image must be under ${
          Math.round((profileMaxBytes / 1024 / 1024) * 100) / 100
        } MB`
      );
    }

    const result = await uploadFileToSpace(
      req.file.buffer,
      folderName,
      req.file.originalname,
      req.file.mimetype
    );

    // debug log to verify result
    // eslint-disable-next-line no-console
    console.debug('Uploaded profile image result:', result);

    const updatedUser = await userService.updateUser(targetUser.id, {
      profileImage: result.key,
    });

    // eslint-disable-next-line no-console
    console.debug('Updated user.profileImage:', updatedUser.profileImage);

    res.json(ApiResponse.success('Profile image updated', updatedUser));
  } catch (error) {
    next(error);
  }
};

export const listUsers = async (
  req: Request,
  res: Response,
  next: NextFunction
) => {
  try {
    const users = await userService.listUsers({
      search: req.query.search as string | undefined,
      role: req.query.role as any,
      status: req.query.status as string | undefined,
      gender: req.query.gender as string | undefined,
      nationality: req.query.nationality as string | undefined,
      city: req.query.city as string | undefined,
      country: req.query.country as string | undefined,
      createdFrom: req.query.createdFrom as string | undefined,
      createdTo: req.query.createdTo as string | undefined,
      page: req.query.page ? Number(req.query.page) : undefined,
      limit: req.query.limit ? Number(req.query.limit) : undefined,
      all: req.query.all === 'true',
    });
    res.json(ApiResponse.success('Users fetched', users));
  } catch (error) {
    next(error);
  }
};

export const getUser = async (
  req: Request,
  res: Response,
  next: NextFunction
) => {
  try {
    const user = await userService.getUserById(req.params.id);
    res.json(ApiResponse.success('User fetched', user));
  } catch (error) {
    next(error);
  }
};

export const createUser = async (
  req: Request,
  res: Response,
  next: NextFunction
) => {
  try {
    // 1. Create user first locally (without profile image)
    // Note: req.body will contain text fields from FormData
    const user = await userService.createUser(req.body);

    // 2. If a file was uploaded, process it
    if (req.file) {
      try {
        const sanitizedUserName = String(user.name || '').replace(
          /^\/+|\/+$/g,
          ''
        );
        const folderName = `${user.id}_${sanitizedUserName}/profile-images`;

        if (!req.file.mimetype.startsWith('image/')) {
          console.warn('Invalid file type uploaded during user creation');
        } else {
          const profileMaxBytes = Number(
            env.PROFILE_IMAGE_MAX_BYTES || 1 * 1024 * 1024
          );

          if (req.file.size > profileMaxBytes) {
            console.warn('Profile image too large');
          } else {
            const result = await uploadFileToSpace(
              req.file.buffer,
              folderName,
              req.file.originalname,
              req.file.mimetype
            );

            // Update the user with the new profile image key
            const updatedUser = await userService.updateUser(user.id, {
              profileImage: result.key,
            });

            // Return the updated user
            return res.status(201).json(ApiResponse.success('User created', updatedUser));
          }
        }
      } catch (uploadError) {
        console.error(`Failed to upload profile image for user ${user.id}:`, uploadError);
        // Return user without profile image, with a note
        return res.status(201).json(ApiResponse.success('User created (Image upload failed)', user));
      }
    }

    res.status(201).json(ApiResponse.success('User created', user));
  } catch (error) {
    next(error);
  }
};

export const updateUser = async (
  req: Request,
  res: Response,
  next: NextFunction
) => {
  try {
    const user = await userService.updateUser(req.params.id, req.body);
    res.json(ApiResponse.success('User updated', user));
  } catch (error) {
    next(error);
  }
};

export const deleteUser = async (
  req: Request,
  res: Response,
  next: NextFunction
) => {
  try {
    await userService.deleteUser(req.params.id);
    res.json(ApiResponse.success('User deleted', { id: req.params.id }));
  } catch (error) {
    next(error);
  }
};

export const deleteProfileImage = async (
  req: Request,
  res: Response,
  next: NextFunction
) => {
  try {
    const id = req.params.id;
    const user = await userService.getUserById(id);
    if (!user)
      return res.status(404).json(ApiResponse.error('User not found'));
    if (!user.profileImage)
      return res
        .status(400)
        .json(ApiResponse.error('No profile image to delete'));

    // Extract key from URL
    const { env } = require('../../config/env');
    const prefix = `${env.DO_SPACES_CDN_URL}/`;
    const key = user.profileImage.startsWith(prefix)
      ? decodeURI(user.profileImage.substring(prefix.length))
      : user.profileImage;

    // delete from storage
    const { deleteFile } = require('../../utils/upload');
    await deleteFile(key);

    // unset from user
    await userService.updateUser(id, { profileImage: '' });

    res.json(ApiResponse.success('Profile image deleted', null));
  } catch (error) {
    next(error);
  }
};

export const bulkDelete = async (
  req: Request,
  res: Response,
  next: NextFunction
) => {
  try {
    const ids = (req.body?.ids as string[]) || [];
    const result = await userService.bulkDeleteUsers(ids);
    res.json(ApiResponse.success('Users deleted', result));
  } catch (error) {
    next(error);
  }
};
