/*
  Warnings:

  - You are about to drop the column `aiStrategyId` on the `Trade` table. All the data in the column will be lost.
  - You are about to drop the column `closeTime` on the `Trade` table. All the data in the column will be lost.
  - You are about to drop the column `createdAt` on the `Trade` table. All the data in the column will be lost.
  - You are about to drop the column `exchange` on the `Trade` table. All the data in the column will be lost.
  - You are about to drop the column `fees` on the `Trade` table. All the data in the column will be lost.
  - You are about to drop the column `leverage` on the `Trade` table. All the data in the column will be lost.
  - You are about to drop the column `metadata` on the `Trade` table. All the data in the column will be lost.
  - You are about to drop the column `openTime` on the `Trade` table. All the data in the column will be lost.
  - You are about to drop the column `orderType` on the `Trade` table. All the data in the column will be lost.
  - You are about to drop the column `stopLoss` on the `Trade` table. All the data in the column will be lost.
  - You are about to drop the column `takeProfit` on the `Trade` table. All the data in the column will be lost.
  - You are about to drop the column `updatedAt` on the `Trade` table. All the data in the column will be lost.

*/
-- DropIndex
DROP INDEX "public"."Trade_openTime_idx";

-- AlterTable
ALTER TABLE "public"."Trade" DROP COLUMN "aiStrategyId",
DROP COLUMN "closeTime",
DROP COLUMN "createdAt",
DROP COLUMN "exchange",
DROP COLUMN "fees",
DROP COLUMN "leverage",
DROP COLUMN "metadata",
DROP COLUMN "openTime",
DROP COLUMN "orderType",
DROP COLUMN "stopLoss",
DROP COLUMN "takeProfit",
DROP COLUMN "updatedAt";
