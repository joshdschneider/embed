/*
  Warnings:

  - Added the required column `provider_key` to the `Integration` table without a default value. This is not possible if the table is not empty.

*/
-- AlterTable
ALTER TABLE "Integration" ADD COLUMN     "provider_key" TEXT NOT NULL;
