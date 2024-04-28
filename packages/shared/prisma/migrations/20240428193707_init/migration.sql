/*
  Warnings:

  - You are about to drop the column `credentials_hash` on the `Connection` table. All the data in the column will be lost.

*/
-- AlterTable
ALTER TABLE "Connection" DROP COLUMN "credentials_hash",
ADD COLUMN     "external_id" TEXT;
