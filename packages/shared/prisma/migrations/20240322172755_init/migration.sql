/*
  Warnings:

  - A unique constraint covering the columns `[key_hash]` on the table `ApiKey` will be added. If there are existing duplicate values, this will fail.
  - Made the column `key_hash` on table `ApiKey` required. This step will fail if there are existing NULL values in that column.

*/
-- DropIndex
DROP INDEX "ApiKey_key_key";

-- AlterTable
ALTER TABLE "ApiKey" ALTER COLUMN "key_hash" SET NOT NULL;

-- CreateIndex
CREATE UNIQUE INDEX "ApiKey_key_hash_key" ON "ApiKey"("key_hash");
