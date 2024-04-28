/*
  Warnings:

  - You are about to drop the `Token` table. If the table is not empty, all the data it contains will be lost.

*/
-- DropForeignKey
ALTER TABLE "Token" DROP CONSTRAINT "Token_environment_id_fkey";

-- DropTable
DROP TABLE "Token";

-- CreateTable
CREATE TABLE "ConnectToken" (
    "id" TEXT NOT NULL,
    "environment_id" TEXT NOT NULL,
    "integration_id" TEXT NOT NULL,
    "connection_id" TEXT,
    "expires_at" INTEGER NOT NULL,
    "language" TEXT NOT NULL,
    "redirect_url" TEXT,
    "metadata" JSONB,
    "configuration" JSONB,
    "websocket_client_id" TEXT,
    "link_method" TEXT,
    "prefers_dark_mode" BOOLEAN NOT NULL DEFAULT false,
    "code_verifier" TEXT,
    "request_token_secret" TEXT,
    "created_at" INTEGER NOT NULL,
    "updated_at" INTEGER NOT NULL,
    "deleted_at" INTEGER,

    CONSTRAINT "ConnectToken_pkey" PRIMARY KEY ("id")
);

-- AddForeignKey
ALTER TABLE "ConnectToken" ADD CONSTRAINT "ConnectToken_environment_id_fkey" FOREIGN KEY ("environment_id") REFERENCES "Environment"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
