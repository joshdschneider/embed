/*
  Warnings:

  - Made the column `prefers_dark_mode` on table `LinkToken` required. This step will fail if there are existing NULL values in that column.

*/
-- AlterTable
ALTER TABLE "LinkToken" ALTER COLUMN "prefers_dark_mode" SET NOT NULL,
ALTER COLUMN "prefers_dark_mode" SET DEFAULT false;
