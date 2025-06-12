-- AlterTable
ALTER TABLE "UserSettings" ADD COLUMN     "derivDemoAccountId" TEXT,
ADD COLUMN     "derivDemoBalance" DOUBLE PRECISION,
ADD COLUMN     "derivRealAccountId" TEXT,
ADD COLUMN     "derivRealBalance" DOUBLE PRECISION,
ADD COLUMN     "lastBalanceSync" TIMESTAMP(3),
ADD COLUMN     "selectedDerivAccountType" TEXT DEFAULT 'demo';
