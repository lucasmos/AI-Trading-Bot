/*
  Warnings:

  - You are about to drop the column `amount` on the `Trade` table. All the data in the column will be lost.
  - You are about to drop the column `buyPrice` on the `Trade` table. All the data in the column will be lost.
  - You are about to drop the column `derivContractIdNew` on the `Trade` table. All the data in the column will be lost.
  - You are about to drop the column `entryPrice` on the `Trade` table. All the data in the column will be lost.
  - You are about to drop the column `exitPrice` on the `Trade` table. All the data in the column will be lost.
  - You are about to drop the column `price` on the `Trade` table. All the data in the column will be lost.
  - You are about to drop the column `profit` on the `Trade` table. All the data in the column will be lost.
  - You are about to drop the column `profitLoss` on the `Trade` table. All the data in the column will be lost.
  - You are about to drop the column `totalValue` on the `Trade` table. All the data in the column will be lost.
  - You are about to drop the column `tradeType` on the `Trade` table. All the data in the column will be lost.
  - You are about to drop the column `type` on the `Trade` table. All the data in the column will be lost.

*/
-- DropIndex
DROP INDEX "public"."Trade_derivContractIdNew_idx";

-- AlterTable
ALTER TABLE "public"."Trade" DROP COLUMN "amount",
DROP COLUMN "buyPrice",
DROP COLUMN "derivContractIdNew",
DROP COLUMN "entryPrice",
DROP COLUMN "exitPrice",
DROP COLUMN "price",
DROP COLUMN "profit",
DROP COLUMN "profitLoss",
DROP COLUMN "totalValue",
DROP COLUMN "tradeType",
DROP COLUMN "type";
