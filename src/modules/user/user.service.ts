import bcrypt from 'bcryptjs';
import prisma from '../../utils/prisma.js';
import { Role } from '../../generated/prisma';
import { ApiError } from '../../utils/ApiError.js';
import { env } from '../../config/env';

interface ListUsersParams {
  search?: string;
  role?: Role;
  status?: string;
  gender?: string;
  nationality?: string;
  city?: string;
  country?: string;
  createdFrom?: string;
  createdTo?: string;
  page?: number;
  limit?: number;
  all?: boolean; // If true, return all records (limit=0/undefined effectively)
}

export const listUsers = async (params: ListUsersParams) => {
  const { search, role, status, gender, nationality, city, country, createdFrom, createdTo, all } = params;
  
  const page = Math.max(1, Number(params.page) || 1);
  const limitOptions = [25, 50, 75, 100, 200];
  let limit = limitOptions.includes(Number(params.limit))
    ? Number(params.limit)
    : 25;

  if (all) {
      limit = 10000; // Large number for 'all' or undefined to fetch all
  }
  
  const skip = all ? 0 : (page - 1) * limit;

  const where: any = {};

  if (search) {
    where.OR = [
      { name: { contains: search, mode: 'insensitive' } },
      { email: { contains: search, mode: 'insensitive' } },
      { phone: { contains: search, mode: 'insensitive' } },
      { userCode: { contains: search, mode: 'insensitive' } },
    ];
  }

  if (role) where.role = role;
  if (status) where.status = status;
  if (gender) where.gender = { equals: gender, mode: 'insensitive' };
  if (nationality) where.nationality = { contains: nationality, mode: 'insensitive' };
  if (city) where.city = { contains: city, mode: 'insensitive' };
  if (country) where.country = { contains: country, mode: 'insensitive' };

  if (createdFrom || createdTo) {
    where.createdAt = {};
    if (createdFrom) where.createdAt.gte = new Date(createdFrom);
    if (createdTo) {
      const to = new Date(createdTo);
      to.setHours(23, 59, 59, 999);
      where.createdAt.lte = to;
    }
  }

  const queryOptions: any = {
      where,
      orderBy: { createdAt: 'desc' },
      select: {
        id: true,
        email: true,
        name: true,
        phone: true,
        profileImage: true,
        role: true,
        status: true,
        userCode: true,
        gender: true,
        dateOfBirth: true,
        nationality: true,
        maritalStatus: true,
        personalEmail: true,
        city: true,
        country: true,
        nationalIdNumber: true,
        passportNumber: true,
        createdAt: true,
        updatedAt: true,
        pushToken: true,
        address: true, // Included address
      },
  };

  if (!all) {
      queryOptions.take = limit;
      queryOptions.skip = skip;
  }

  const [items, total] = await Promise.all([
    prisma.user.findMany(queryOptions),
    prisma.user.count({ where }),
  ]);

  const cdnPrefix = env.DO_SPACES_CDN_URL.replace(/\/\/+$/, '');
  const mapProfile = (p: string | null | undefined) =>
    !p ? null : p.startsWith('http') ? p : `${cdnPrefix}/${encodeURI(p)}`;

  const mappedItems = items.map((u) => ({
    ...u,
    profileImage: mapProfile(u.profileImage),
  }));

  return {
    items: mappedItems,
    total,
    page: all ? 1 : page,
    limit: all ? total : limit,
    totalPages: all ? 1 : Math.ceil(total / limit),
  };
};

export const getUserById = async (id: string) => {
  const user = await prisma.user.findUnique({
    where: { id },
    select: {
      id: true,
      email: true,
      name: true,
      phone: true,
      profileImage: true,
      role: true,
      status: true,
      userCode: true,
      gender: true,
      dateOfBirth: true,
      nationality: true,
      maritalStatus: true,
      personalEmail: true,
      city: true,
      country: true,
      nationalIdNumber: true,
      passportNumber: true,
      createdAt: true,
      updatedAt: true,
      pushToken: true,
    },
  });

  if (!user) throw new ApiError(404, 'User not found');
  const cdnPrefix = env.DO_SPACES_CDN_URL.replace(/\/\/+$/, '');
  const profileImage = !user.profileImage
    ? null
    : user.profileImage.startsWith('http')
    ? user.profileImage
    : `${cdnPrefix}/${encodeURI(user.profileImage)}`;
  return { ...user, profileImage };
};

export const createUser = async (data: {
  name?: string;
  email: string;
  password?: string;
  role?: Role;
  phone?: string;
  address?: string;
  profileImage?: string;
  status?: string; // or Enum type if imported, assuming string/any from body
  userCode?: string;
  gender?: string;
  dateOfBirth?: string | Date; // string from JSON
  nationality?: string;
  maritalStatus?: string;
  personalEmail?: string;
  city?: string;
  country?: string;
  nationalIdNumber?: string;
  passportNumber?: string;
}) => {
  const existing = await prisma.user.findUnique({
    where: { email: data.email },
  });
  if (existing) {
    throw new ApiError(400, 'Email already exists');
  }

  // If phone is provided, ensure it's unique and prevent duplicate-phone errors
  if (data.phone) {
    const existingPhone = await prisma.user.findFirst({
      where: { phone: data.phone },
    });
    if (existingPhone) {
      throw new ApiError(400, 'Phone already exists');
    }
  }

  const hashedPassword = await bcrypt.hash(data.password || 'ChangeMe123!', 10);

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const createData: any = {
    email: data.email,
    password: hashedPassword,
    name: data.name ?? '',
    role: data.role || 'USER',
    status: (data.status as any) || 'ACTIVE',
  };
    
  // Helper to add if present
  if (data.userCode) createData.userCode = data.userCode;
  if (data.gender) createData.gender = data.gender;
  if (data.dateOfBirth) createData.dateOfBirth = new Date(data.dateOfBirth);
  if (data.nationality) createData.nationality = data.nationality;
  if (data.maritalStatus) createData.maritalStatus = data.maritalStatus;
  if (data.personalEmail) createData.personalEmail = data.personalEmail;
  if (data.city) createData.city = data.city;
  if (data.country) createData.country = data.country;
  if (data.nationalIdNumber) createData.nationalIdNumber = data.nationalIdNumber;
  if (data.passportNumber) createData.passportNumber = data.passportNumber;

  if (data.phone !== undefined) {
    createData.phone = data.phone === '' ? null : data.phone;
    if (createData.phone === null) delete createData.phone;
    // sanitize non-string phone values
    if (
      createData.phone !== undefined &&
      typeof createData.phone !== 'string'
    ) {
      delete createData.phone;
    }
  }
  if (data.address !== undefined) {
    createData.address = data.address === '' ? null : data.address;
    if (createData.address === null) delete createData.address;
  }
  if (data.profileImage !== undefined) {
    createData.profileImage =
      data.profileImage === '' ? null : data.profileImage;
    if (createData.profileImage === null) delete createData.profileImage;
  }

  try {
    // debug: log createData for troubleshooting
    // eslint-disable-next-line no-console
    console.debug('Creating user with', JSON.stringify(createData));

    const user = await prisma.user.create({
      data: createData,
      select: {
        id: true,
        email: true,
        name: true,
        phone: true,
        address: true,
        profileImage: true,
        role: true,
        status: true,
        userCode: true,
        gender: true,
        dateOfBirth: true,
        nationality: true,
        maritalStatus: true,
        personalEmail: true,
        city: true,
        country: true,
        nationalIdNumber: true,
        passportNumber: true,
        createdAt: true,
        updatedAt: true,
      },
    });

    const cdnPrefix = env.DO_SPACES_CDN_URL.replace(/\/\/+$/, '');
    const profileImage = !user.profileImage
      ? null
      : user.profileImage.startsWith('http')
      ? user.profileImage
      : `${cdnPrefix}/${encodeURI(user.profileImage)}`;

    return { ...user, profileImage };
  } catch (err: any) {
    // Prisma unique constraint error: surface which field caused the problem
    if (err?.code === 'P2002') {
      const target = err?.meta?.target;
      if (Array.isArray(target)) {
        if (target.includes('phone'))
          throw new ApiError(400, 'Phone already exists');
        if (target.includes('email'))
          throw new ApiError(400, 'Email already exists');
      }
      throw new ApiError(400, 'Duplicate field value');
    }
    throw err;
  }
};

export const updateUser = async (
  id: string,
  data: {
    name?: string;
    email?: string;
    password?: string;
    role?: Role;
    phone?: string;
    address?: string;
    profileImage?: string;
    status?: string;
    userCode?: string;
    gender?: string;
    dateOfBirth?: string | Date;
    nationality?: string;
    maritalStatus?: string;
    personalEmail?: string;
    city?: string;
    country?: string;
    nationalIdNumber?: string;
    passportNumber?: string;
  }
) => {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const toUpdate: any = {};
  if (data.name !== undefined) toUpdate.name = data.name;
  if (data.email !== undefined) toUpdate.email = data.email;
  
  if (data.status !== undefined) toUpdate.status = data.status;
  if (data.userCode !== undefined) toUpdate.userCode = data.userCode;
  if (data.gender !== undefined) toUpdate.gender = data.gender;
  if (data.dateOfBirth !== undefined) toUpdate.dateOfBirth = data.dateOfBirth ? new Date(data.dateOfBirth) : null;
  if (data.nationality !== undefined) toUpdate.nationality = data.nationality;
  if (data.maritalStatus !== undefined) toUpdate.maritalStatus = data.maritalStatus;
  if (data.personalEmail !== undefined) toUpdate.personalEmail = data.personalEmail;
  if (data.city !== undefined) toUpdate.city = data.city;
  if (data.country !== undefined) toUpdate.country = data.country;
  if (data.nationalIdNumber !== undefined) toUpdate.nationalIdNumber = data.nationalIdNumber;
  if (data.passportNumber !== undefined) toUpdate.passportNumber = data.passportNumber;

  if (data.phone !== undefined) {
    toUpdate.phone = data.phone === '' ? null : data.phone;
    if (toUpdate.phone !== null && typeof toUpdate.phone !== 'string') {
      // ignore invalid types
      delete toUpdate.phone;
    }
  }
  if (data.address !== undefined)
    toUpdate.address = data.address === '' ? null : data.address;
  if (data.profileImage !== undefined) {
    let val =
      data.profileImage === '' ? null : (data.profileImage as string | null);
    if (val && typeof val === 'string') {
      const cdnPrefix = env.DO_SPACES_CDN_URL.replace(/\/\/+$/, '');
      if (val.startsWith(cdnPrefix + '/')) {
        val = decodeURI(val.substring(cdnPrefix.length + 1));
      }
    }
    toUpdate.profileImage = val;

    // Check if we need to delete the old image
    // validation: if id is valid
    if (id) {
       const currentUser = await prisma.user.findUnique({ where: { id }, select: { profileImage: true } });
       if (currentUser?.profileImage && currentUser.profileImage !== val) {
         try {
           // eslint-disable-next-line @typescript-eslint/no-var-requires
           const { deleteFile } = require('../../utils/upload');
           await deleteFile(currentUser.profileImage);
         } catch (e) {
             console.error('Failed to delete old profile image during update', e);
         }
       }
    }
  }
  if (data.role !== undefined) toUpdate.role = data.role;
  if (data.password) {
    toUpdate.password = await bcrypt.hash(data.password, 10);
  }

  try {
    // debug: log profileImage being updated
    // eslint-disable-next-line no-console
    console.debug(
      'Updating user',
      id,
      'with profileImage:',
      toUpdate.profileImage
    );

    const user = await prisma.user.update({
      where: { id },
      data: toUpdate,
      select: {
        id: true,
        email: true,
        name: true,
        phone: true,
        address: true,
        profileImage: true,
        role: true,
        status: true,
        userCode: true,
        gender: true,
        dateOfBirth: true,
        nationality: true,
        maritalStatus: true,
        personalEmail: true,
        city: true,
        country: true,
        nationalIdNumber: true,
        passportNumber: true,
        createdAt: true,
        updatedAt: true,
      },
    });

    // eslint-disable-next-line no-console
    console.debug('Updated user profileImage:', user.profileImage);

    const cdnPrefix = env.DO_SPACES_CDN_URL.replace(/\/\/+$/, '');
    const profileImage = !user.profileImage
      ? null
      : user.profileImage.startsWith('http')
      ? user.profileImage
      : `${cdnPrefix}/${encodeURI(user.profileImage)}`;

    return { ...user, profileImage };
  } catch (err: any) {
    if (err.code === 'P2025') throw new ApiError(404, 'User not found');
    if (err.code === 'P2002') {
      const target = err?.meta?.target;
      if (Array.isArray(target)) {
        if (target.includes('phone'))
          throw new ApiError(400, 'Phone already exists');
        if (target.includes('email'))
          throw new ApiError(400, 'Email already exists');
      }
      throw new ApiError(400, 'Duplicate field value');
    }
    throw err;
  }
};

export const deleteUser = async (id: string) => {
  try {
    await prisma.user.delete({ where: { id } });
    return { success: true };
  } catch (err: any) {
    if (err.code === 'P2025') throw new ApiError(404, 'User not found');
    throw err;
  }
};

export const bulkDeleteUsers = async (ids: string[]) => {
  if (!ids.length) return { deleted: 0 };
  const result = await prisma.user.deleteMany({
    where: { id: { in: ids } },
  });
  return { deleted: result.count };
};
