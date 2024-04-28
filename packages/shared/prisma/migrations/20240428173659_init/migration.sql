/*
  Warnings:

  - You are about to drop the column `type` on the `Integration` table. All the data in the column will be lost.
  - Added the required column `auth_scheme` to the `Integration` table without a default value. This is not possible if the table is not empty.

*/
-- AlterTable
ALTER TABLE "Integration" DROP COLUMN "type",
ADD COLUMN     "auth_scheme" TEXT NOT NULL;
