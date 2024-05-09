/*
  Warnings:

  - You are about to drop the column `connect_token_id` on the `Activity` table. All the data in the column will be lost.
  - You are about to drop the `ConnectToken` table. If the table is not empty, all the data it contains will be lost.

*/
-- DropForeignKey
ALTER TABLE "ConnectToken" DROP CONSTRAINT "ConnectToken_environment_id_fkey";

-- AlterTable
ALTER TABLE "Activity" DROP COLUMN "connect_token_id",
ADD COLUMN     "session_token_id" TEXT;

-- DropTable
DROP TABLE "ConnectToken";

-- CreateTable
CREATE TABLE "SessionToken" (
    "id" TEXT NOT NULL,
    "environment_id" TEXT NOT NULL,
    "integration_id" TEXT NOT NULL,
    "connection_id" TEXT,
    "expires_at" INTEGER NOT NULL,
    "language" TEXT NOT NULL,
    "redirect_url" TEXT,
    "type" TEXT,
    "display_name" TEXT,
    "configuration" JSONB,
    "inclusions" JSONB,
    "exclusions" JSONB,
    "metadata" JSONB,
    "websocket_client_id" TEXT,
    "connect_method" TEXT,
    "prefers_dark_mode" BOOLEAN NOT NULL DEFAULT false,
    "code_verifier" TEXT,
    "request_token_secret" TEXT,
    "created_at" INTEGER NOT NULL,
    "updated_at" INTEGER NOT NULL,
    "deleted_at" INTEGER,

    CONSTRAINT "SessionToken_pkey" PRIMARY KEY ("id")
);

-- AddForeignKey
ALTER TABLE "SessionToken" ADD CONSTRAINT "SessionToken_environment_id_fkey" FOREIGN KEY ("environment_id") REFERENCES "Environment"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
