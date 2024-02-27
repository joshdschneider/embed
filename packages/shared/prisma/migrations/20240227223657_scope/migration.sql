/*
  Warnings:

  - You are about to drop the column `oauth_scopes` on the `Integration` table. All the data in the column will be lost.

*/
-- AlterTable
ALTER TABLE "Integration" DROP COLUMN "oauth_scopes",
ADD COLUMN     "proxy_scopes" TEXT;
