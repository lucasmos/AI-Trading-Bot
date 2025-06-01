-- AlterTable
ALTER TABLE "User" ADD COLUMN     "authMethod" TEXT,
ALTER COLUMN "email" DROP NOT NULL;
