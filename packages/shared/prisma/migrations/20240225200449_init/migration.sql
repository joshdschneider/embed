/*
  Warnings:

  - You are about to drop the column `deleted_at` on the `ActionRun` table. All the data in the column will be lost.
  - You are about to drop the column `deleted_at` on the `SyncRun` table. All the data in the column will be lost.

*/
-- AlterTable
ALTER TABLE "ActionRun" DROP COLUMN "deleted_at";

-- AlterTable
ALTER TABLE "SyncRun" DROP COLUMN "deleted_at";
