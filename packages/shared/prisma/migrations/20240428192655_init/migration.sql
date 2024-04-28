-- AlterTable
ALTER TABLE "ApiKey" ALTER COLUMN "key_hash" DROP NOT NULL;

-- AlterTable
ALTER TABLE "Connection" ALTER COLUMN "credentials_hash" DROP NOT NULL;
