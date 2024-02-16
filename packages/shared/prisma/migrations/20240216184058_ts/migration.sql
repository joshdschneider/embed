/*
  Warnings:

  - Added the required column `created_at` to the `SyncJob` table without a default value. This is not possible if the table is not empty.
  - Added the required column `created_at` to the `SyncSchedule` table without a default value. This is not possible if the table is not empty.

*/
-- AlterTable
ALTER TABLE "SyncJob" ADD COLUMN     "created_at" INTEGER NOT NULL,
ADD COLUMN     "deleted_at" INTEGER,
ADD COLUMN     "updated_at" INTEGER;

-- AlterTable
ALTER TABLE "SyncSchedule" ADD COLUMN     "created_at" INTEGER NOT NULL,
ADD COLUMN     "deleted_at" INTEGER,
ADD COLUMN     "updated_at" INTEGER;
