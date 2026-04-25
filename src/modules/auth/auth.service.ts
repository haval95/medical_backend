import prisma from '../../utils/prisma.js';
import bcrypt from 'bcryptjs';
import { RegisterInput, LoginInput, AuthResponse } from './auth.types.js';
import { ApiError } from '../../utils/ApiError.js';
import { generateToken } from '../../utils/token.js';
import { env } from '../../config/env';

// Helper to format profile image URL
const formatProfileImage = (image: string | null) => {
  if (!image) return null;
  if (image.startsWith('http')) return image;
  const cdnPrefix = env.DO_SPACES_CDN_URL.replace(/\/\/+$/, '');
  return `${cdnPrefix}/${encodeURI(image)}`;
};

export const register = async (input: RegisterInput): Promise<AuthResponse> => {
  const existingEmail = await prisma.user.findUnique({
    where: { email: input.email },
  });
  if (existingEmail) {
    throw new ApiError(400, 'Email already exists');
  }

  if (input.phone) {
    const existingPhone = await prisma.user.findFirst({
      where: { phone: input.phone },
    });

    if (existingPhone) {
      throw new ApiError(400, 'Phone already exists');
    }
  }

  const hashedPassword = await bcrypt.hash(input.password, 10);

  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  const { password, ...rest } = input;

  const user = await prisma.user.create({
    data: {
      ...rest,
      password: hashedPassword,
    },
  });

  const token = generateToken(user.id, user.role);

  return {
    user: {
      id: user.id,
      email: user.email,
      name: user.name,
      phone: user.phone,
      role: user.role,
      profileImage: formatProfileImage(user.profileImage),
    },
    token,
  };
};

export const login = async (input: LoginInput): Promise<AuthResponse> => {
// ... (skip login, no change needed)
  const user = await prisma.user.findUnique({
    where: { email: input.email },
  });

  if (!user) {
    throw new ApiError(401, 'Invalid credentials');
  }

  const isValid = await bcrypt.compare(input.password, user.password);

  if (!isValid) {
    throw new ApiError(401, 'Invalid credentials');
  }

  const token = generateToken(user.id, user.role);

  return {
    user: {
      id: user.id,
      email: user.email,
      name: user.name,
      phone: user.phone,
      role: user.role,
      profileImage: formatProfileImage(user.profileImage),
    },
    token,
  };
};

export const getMe = async (userId: string) => {
  const user = await prisma.user.findUnique({
    where: { id: userId },
    // Select all fields or omit sensitive
    // Prisma returns all by default if select is missing, but here it is explicit.
    // I should remove explicit select to return full profile or update it.
    // Let's remove select to return full object (except password? No Prisma returns password by default).
    // I must exclude password.
  });

  if (!user) {
    throw new ApiError(404, 'User not found');
  }

  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  const { password, ...start } = user;
  return {
    ...start,
    profileImage: formatProfileImage(user.profileImage),
  };
};

export const updateProfile = async (
  userId: string,
  data: Partial<RegisterInput> & { password?: string }
) => {
  if (data.phone) {
    const exists = await prisma.user.findFirst({
      where: {
        phone: data.phone,
        id: { not: userId },
      },
    });
    if (exists) {
      throw new ApiError(400, 'Phone number already in use');
    }
  }
  
  const updateData: Record<string, any> = { ...data };
  
  if (data.password) {
    updateData.password = await bcrypt.hash(data.password, 10);
  } else {
    delete updateData.password;
  }

  const user = await prisma.user.update({
    where: { id: userId },
    data: updateData,
  });
  
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  const { password, ...result } = user;
  return {
    ...result,
    profileImage: formatProfileImage(user.profileImage),
  };
};

export const changePassword = async (
  userId: string,
  data: { currentPassword: string; newPassword: string }
) => {
  const user = await prisma.user.findUnique({
    where: { id: userId },
  });

  if (!user) {
    throw new ApiError(404, 'User not found');
  }

  const isMatch = await bcrypt.compare(data.currentPassword, user.password);
  if (!isMatch) {
    throw new ApiError(400, 'Incorrect current password');
  }

  const hashedPassword = await bcrypt.hash(data.newPassword, 10);

  await prisma.user.update({
    where: { id: userId },
    data: { password: hashedPassword },
  });

  return { success: true };
};


export const savePushToken = async (userId: string, token: string) => {
  await prisma.user.update({
    where: { id: userId },
    data: { pushToken: token },
  });

  return { success: true };
};

export const removePushToken = async (userId: string) => {
  await prisma.user.update({
    where: { id: userId },
    data: { pushToken: null },
  });

  return { success: true };
};
