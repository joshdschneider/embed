/*
  Warnings:

  - Added the required column `multimodal_enabled` to the `Environment` table without a default value. This is not possible if the table is not empty.

*/
-- AlterTable
ALTER TABLE "Environment" ADD COLUMN     "multimodal_enabled" BOOLEAN NOT NULL;
