-- AlterTable
ALTER TABLE "LinkToken" ADD COLUMN     "code_verifier" TEXT,
ADD COLUMN     "request_token_secret" TEXT,
ADD COLUMN     "websocket_client_id" TEXT;
