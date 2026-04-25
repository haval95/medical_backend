import type { Permission, Role } from '@prisma/client';

export interface AuthenticatedUser {
  id: string;
  phoneNumber: string;
  role: Role;
  permissions: Permission[];
  status: 'ACTIVE' | 'DISABLED' | 'SUSPENDED';
}
