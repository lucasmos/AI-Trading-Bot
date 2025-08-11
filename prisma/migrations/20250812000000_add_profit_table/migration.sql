-- CreateTable
CREATE TABLE "ProfitTableEntry" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "derivAccountId" TEXT NOT NULL,
    "accountType" TEXT NOT NULL,
    "appId" INTEGER NOT NULL,
    "buyPrice" INTEGER NOT NULL,
    "contractId" BIGINT NOT NULL,
    "longcode" TEXT NOT NULL,
    "payout" INTEGER NOT NULL,
    "purchaseTime" BIGINT NOT NULL,
    "sellPrice" INTEGER,
    "sellTime" BIGINT,
    "shortcode" TEXT NOT NULL,
    "transactionId" BIGINT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ProfitTableEntry_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "ProfitTableEntry_userId_idx" ON "ProfitTableEntry"("userId");

-- CreateIndex
CREATE INDEX "ProfitTableEntry_derivAccountId_idx" ON "ProfitTableEntry"("derivAccountId");

-- CreateIndex
CREATE INDEX "ProfitTableEntry_contractId_idx" ON "ProfitTableEntry"("contractId");

-- CreateIndex
CREATE INDEX "ProfitTableEntry_purchaseTime_idx" ON "ProfitTableEntry"("purchaseTime");

-- AddForeignKey
ALTER TABLE "ProfitTableEntry" ADD CONSTRAINT "ProfitTableEntry_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
