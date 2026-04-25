import prisma from '../src/utils/prisma';
import { Role } from '../src/generated/prisma';
import bcrypt from 'bcryptjs';

async function main() {
  console.log('Start seeding...');

  // Create Admin User
  const adminPassword = await bcrypt.hash('123', 10);
  const admin = await prisma.user.upsert({
    where: { email: 'admin@example.com' },
    update: {},
    create: {
      email: 'admin@example.com',
      name: 'Admin User',
      password: adminPassword,
      phone: '1234567890',
      role: Role.ADMIN,
    },
  });
  console.log(`Created admin user: ${admin.email}`);

  // Create Regular User
  const userPassword = await bcrypt.hash('123', 10);
  const user = await prisma.user.upsert({
    where: { email: 'user@example.com' },
    update: {},
    create: {
      email: 'user@example.com',
      name: 'Regular User',
      password: userPassword,
      phone: '0987654321',
      role: Role.USER,
    },
  });
  console.log(`Created regular user: ${user.email}`);

  console.log('Seeding finished.');
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
