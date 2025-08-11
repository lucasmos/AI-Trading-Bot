/*
  Warnings:

  - The `derivContractId` column on the `Trade` table would be dropped and recreated. This will lead to data loss if there is data in the column.
  - You are about to alter the column `derivBuyPrice` on the `Trade` table. The data in that column could be lost. The data in that column will be cast from `DoublePrecision` to `Integer`.
  - The `derivTransactionId` column on the `Trade` table would be dropped and recreated. This will lead to data loss if there is data in the column.
  - A unique constraint covering the columns `[contractId,derivAccountId]` on the table `ProfitTableEntry` will be added. If there are existing duplicate values, this will fail.

*/
-- AlterTable
ALTER TABLE "public"."Trade" DROP COLUMN "derivContractId",
ADD COLUMN     "derivContractId" BIGINT,
ALTER COLUMN "derivBuyPrice" SET DATA TYPE INTEGER,
DROP COLUMN "derivTransactionId",
ADD COLUMN     "derivTransactionId" BIGINT;

-- CreateIndex
CREATE UNIQUE INDEX "ProfitTableEntry_contractId_derivAccountId_key" ON "public"."ProfitTableEntry"("contractId", "derivAccountId");

-- CreateIndex
CREATE INDEX "Trade_derivContractId_idx" ON "public"."Trade"("derivContractId");
