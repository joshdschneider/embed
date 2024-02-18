/*
  Warnings:

  - You are about to drop the column `sync_job_id` on the `SyncSchedule` table. All the data in the column will be lost.

*/
-- DropForeignKey
ALTER TABLE "SyncSchedule" DROP CONSTRAINT "SyncSchedule_sync_job_id_fkey";

-- AlterTable
ALTER TABLE "SyncSchedule" DROP COLUMN "sync_job_id";
