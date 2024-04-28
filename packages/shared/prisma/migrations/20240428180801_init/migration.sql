/*
  Warnings:

  - You are about to drop the column `token_id` on the `Activity` table. All the data in the column will be lost.

*/
-- AlterTable
ALTER TABLE "Activity" DROP COLUMN "token_id",
ADD COLUMN     "connect_token_id" TEXT;
