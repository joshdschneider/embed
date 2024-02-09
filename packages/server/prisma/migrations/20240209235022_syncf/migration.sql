-- AlterTable
ALTER TABLE "Integration" ADD COLUMN     "sync_frequency" TEXT;

-- AlterTable
ALTER TABLE "SyncModel" ADD COLUMN     "sync_frequency" TEXT;
