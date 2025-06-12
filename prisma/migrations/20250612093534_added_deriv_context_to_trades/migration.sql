-- AlterTable
ALTER TABLE "Trade" ADD COLUMN     "accountType" TEXT,
ADD COLUMN     "derivAccountId" TEXT,
ADD COLUMN     "derivContractId" TEXT;

-- CreateIndex
CREATE INDEX "Trade_derivContractId_idx" ON "Trade"("derivContractId");

-- CreateIndex
CREATE INDEX "Trade_derivAccountId_idx" ON "Trade"("derivAccountId");
