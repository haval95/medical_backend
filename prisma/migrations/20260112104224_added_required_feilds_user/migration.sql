/*
  Warnings:

  - A unique constraint covering the columns `[userCode]` on the table `User` will be added. If there are existing duplicate values, this will fail.

*/
-- CreateEnum
CREATE TYPE "UserStatus" AS ENUM ('ACTIVE', 'ON_LEAVE', 'TERMINATED', 'SUSPENDED');

-- AlterTable
ALTER TABLE "User" ADD COLUMN     "city" TEXT,
ADD COLUMN     "country" TEXT,
ADD COLUMN     "dateOfBirth" TIMESTAMP(3),
ADD COLUMN     "gender" TEXT,
ADD COLUMN     "maritalStatus" TEXT,
ADD COLUMN     "nationalIdNumber" TEXT,
ADD COLUMN     "nationality" TEXT,
ADD COLUMN     "passportNumber" TEXT,
ADD COLUMN     "personalEmail" TEXT,
ADD COLUMN     "status" "UserStatus" NOT NULL DEFAULT 'ACTIVE',
ADD COLUMN     "userCode" TEXT;

-- CreateIndex
CREATE UNIQUE INDEX "User_userCode_key" ON "User"("userCode");
