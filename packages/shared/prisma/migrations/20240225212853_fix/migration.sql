/*
  Warnings:

  - You are about to drop the column `added` on the `SyncRun` table. All the data in the column will be lost.
  - You are about to drop the column `deleted` on the `SyncRun` table. All the data in the column will be lost.
  - You are about to drop the column `run_id` on the `SyncRun` table. All the data in the column will be lost.
  - You are about to drop the column `updated` on the `SyncRun` table. All the data in the column will be lost.
  - Added the required column `status` to the `Sync` table without a default value. This is not possible if the table is not empty.

*/
-- AlterTable
ALTER TABLE "Sync" ADD COLUMN     "status" TEXT NOT NULL;

-- AlterTable
ALTER TABLE "SyncRun" DROP COLUMN "added",
DROP COLUMN "deleted",
DROP COLUMN "run_id",
DROP COLUMN "updated",
ADD COLUMN     "records_added" INTEGER,
ADD COLUMN     "records_deleted" INTEGER,
ADD COLUMN     "records_updated" INTEGER,
ADD COLUMN     "temporal_run_id" TEXT;
