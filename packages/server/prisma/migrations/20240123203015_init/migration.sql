-- CreateTable
CREATE TABLE "Account" (
    "id" TEXT NOT NULL,
    "cloud_organization_id" TEXT,

    CONSTRAINT "Account_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "User" (
    "id" TEXT NOT NULL,
    "account_id" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "first_name" TEXT,
    "last_name" TEXT,
    "created_at" INTEGER NOT NULL,
    "updated_at" INTEGER,
    "deleted_at" INTEGER,

    CONSTRAINT "User_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Environment" (
    "id" TEXT NOT NULL,
    "account_id" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "enable_new_integrations" BOOLEAN NOT NULL,
    "duplicate_account_behavior" TEXT NOT NULL,
    "created_at" INTEGER NOT NULL,
    "updated_at" INTEGER,
    "deleted_at" INTEGER,

    CONSTRAINT "Environment_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ApiKey" (
    "id" TEXT NOT NULL,
    "environment_id" TEXT NOT NULL,
    "key" TEXT NOT NULL,
    "key_iv" TEXT,
    "key_tag" TEXT,
    "created_at" INTEGER NOT NULL,
    "updated_at" INTEGER,
    "deleted_at" INTEGER,

    CONSTRAINT "ApiKey_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Integration" (
    "provider" TEXT NOT NULL,
    "environment_id" TEXT NOT NULL,
    "is_enabled" BOOLEAN NOT NULL,
    "use_client_credentials" BOOLEAN NOT NULL,
    "oauth_client_id" TEXT,
    "oauth_client_secret" TEXT,
    "oauth_scopes" TEXT,
    "rank" INTEGER,
    "created_at" INTEGER NOT NULL,
    "updated_at" INTEGER,
    "deleted_at" INTEGER,

    CONSTRAINT "Integration_pkey" PRIMARY KEY ("provider")
);

-- CreateTable
CREATE TABLE "LinkedAccount" (
    "id" TEXT NOT NULL,
    "environment_id" TEXT NOT NULL,
    "integration_provider" TEXT NOT NULL,
    "credentials" JSONB NOT NULL,
    "credentials_iv" TEXT,
    "credentials_tag" TEXT,
    "configuration" JSONB NOT NULL,
    "metadata" JSONB,
    "created_at" INTEGER NOT NULL,
    "updated_at" INTEGER,
    "deleted_at" INTEGER,

    CONSTRAINT "LinkedAccount_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "ApiKey_key_key" ON "ApiKey"("key");

-- AddForeignKey
ALTER TABLE "User" ADD CONSTRAINT "User_account_id_fkey" FOREIGN KEY ("account_id") REFERENCES "Account"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Environment" ADD CONSTRAINT "Environment_account_id_fkey" FOREIGN KEY ("account_id") REFERENCES "Account"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ApiKey" ADD CONSTRAINT "ApiKey_environment_id_fkey" FOREIGN KEY ("environment_id") REFERENCES "Environment"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Integration" ADD CONSTRAINT "Integration_environment_id_fkey" FOREIGN KEY ("environment_id") REFERENCES "Environment"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "LinkedAccount" ADD CONSTRAINT "LinkedAccount_environment_id_fkey" FOREIGN KEY ("environment_id") REFERENCES "Environment"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "LinkedAccount" ADD CONSTRAINT "LinkedAccount_integration_provider_fkey" FOREIGN KEY ("integration_provider") REFERENCES "Integration"("provider") ON DELETE RESTRICT ON UPDATE CASCADE;
