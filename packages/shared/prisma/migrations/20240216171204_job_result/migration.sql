-- AlterTable
ALTER TABLE "SyncJob" ADD COLUMN     "added" INTEGER,
ADD COLUMN     "deleted" INTEGER,
ADD COLUMN     "updated" INTEGER;
