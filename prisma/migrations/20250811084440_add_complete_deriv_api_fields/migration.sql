-- AlterTable
ALTER TABLE "public"."Trade" ADD COLUMN     "buyPrice" DOUBLE PRECISION,
ADD COLUMN     "derivAppId" INTEGER,
ADD COLUMN     "derivBuyPrice" DOUBLE PRECISION,
ADD COLUMN     "derivContractIdNew" TEXT,
ADD COLUMN     "derivContractType" TEXT,
ADD COLUMN     "derivDurationType" TEXT,
ADD COLUMN     "derivLongcode" TEXT,
ADD COLUMN     "derivPayout" DOUBLE PRECISION,
ADD COLUMN     "derivPurchaseTime" BIGINT,
ADD COLUMN     "derivSellPrice" DOUBLE PRECISION,
ADD COLUMN     "derivSellTime" BIGINT,
ADD COLUMN     "derivShortcode" TEXT,
ADD COLUMN     "derivTransactionId" TEXT,
ADD COLUMN     "derivUnderlyingSymbol" TEXT,
ADD COLUMN     "entryPrice" DOUBLE PRECISION,
ADD COLUMN     "exitPrice" DOUBLE PRECISION,
ADD COLUMN     "profitLoss" DOUBLE PRECISION,
ADD COLUMN     "tradeType" TEXT;

-- AlterTable
ALTER TABLE "public"."UserSettings" ADD COLUMN     "derivDemoApiToken" TEXT,
ADD COLUMN     "derivRealApiToken" TEXT;

-- CreateIndex
CREATE INDEX "Trade_derivContractIdNew_idx" ON "public"."Trade"("derivContractIdNew");

-- CreateIndex
CREATE INDEX "Trade_derivContractType_idx" ON "public"."Trade"("derivContractType");

-- CreateIndex
CREATE INDEX "Trade_derivUnderlyingSymbol_idx" ON "public"."Trade"("derivUnderlyingSymbol");

-- CreateIndex
CREATE INDEX "Trade_derivPurchaseTime_idx" ON "public"."Trade"("derivPurchaseTime");
