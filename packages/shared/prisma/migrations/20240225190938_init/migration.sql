/*
  Warnings:

  - You are about to drop the column `consent_date` on the `LinkedAccount` table. All the data in the column will be lost.

*/
-- AlterTable
ALTER TABLE "LinkedAccount" DROP COLUMN "consent_date",
ADD COLUMN     "consent_timestamp" INTEGER;
