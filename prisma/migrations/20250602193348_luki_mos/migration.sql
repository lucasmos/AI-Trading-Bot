/*
  Warnings:

  - A unique constraint covering the columns `[derivAccountId]` on the table `User` will be added. If there are existing duplicate values, this will fail.

*/
-- AlterTable
ALTER TABLE "User" ADD COLUMN     "derivAccountId" TEXT,
ADD COLUMN     "provider" TEXT;

-- CreateIndex
CREATE UNIQUE INDEX "User_derivAccountId_key" ON "User"("derivAccountId");
