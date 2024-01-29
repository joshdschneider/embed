-- CreateTable
CREATE TABLE "Account" (
    "id" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "name" TEXT,
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
    "name" TEXT,
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
    "deleted_at" INTEGER
);

-- CreateTable
CREATE TABLE "LinkedAccount" (
    "id" TEXT NOT NULL,
    "environment_id" TEXT NOT NULL,
    "integration_provider" TEXT NOT NULL,
    "credentials" TEXT NOT NULL,
    "credentials_iv" TEXT,
    "credentials_tag" TEXT,
    "configuration" JSONB NOT NULL,
    "metadata" JSONB,
    "consent_given" BOOLEAN NOT NULL DEFAULT false,
    "consent_ip" TEXT,
    "consent_date" INTEGER,
    "created_at" INTEGER NOT NULL,
    "updated_at" INTEGER,
    "deleted_at" INTEGER,

    CONSTRAINT "LinkedAccount_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "LinkToken" (
    "id" TEXT NOT NULL,
    "environment_id" TEXT NOT NULL,
    "integration_provider" TEXT,
    "linked_account_id" TEXT,
    "expires_at" INTEGER NOT NULL,
    "language" TEXT,
    "redirect_url" TEXT,
    "metadata" JSONB,
    "can_choose_integration" BOOLEAN NOT NULL,
    "consent_given" BOOLEAN NOT NULL DEFAULT false,
    "consent_ip" TEXT,
    "consent_date" INTEGER,
    "configuration" JSONB,
    "websocket_client_id" TEXT,
    "code_verifier" TEXT,
    "request_token_secret" TEXT,
    "created_at" INTEGER NOT NULL,
    "updated_at" INTEGER,

    CONSTRAINT "LinkToken_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Webhook" (
    "id" TEXT NOT NULL,
    "environment_id" TEXT NOT NULL,
    "url" TEXT NOT NULL,
    "events" TEXT[],
    "is_enabled" BOOLEAN NOT NULL,
    "secret" TEXT NOT NULL,
    "secret_iv" TEXT,
    "secret_tag" TEXT,
    "created_at" INTEGER NOT NULL,
    "updated_at" INTEGER,
    "deleted_at" INTEGER,

    CONSTRAINT "Webhook_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Activity" (
    "id" TEXT NOT NULL,
    "environment_id" TEXT NOT NULL,
    "integration_provider" TEXT,
    "linked_account_id" TEXT,
    "link_token_id" TEXT,
    "level" TEXT NOT NULL,
    "action" TEXT NOT NULL,
    "timestamp" INTEGER NOT NULL,

    CONSTRAINT "Activity_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ActivityLog" (
    "id" TEXT NOT NULL,
    "activity_id" TEXT NOT NULL,
    "level" TEXT NOT NULL,
    "message" TEXT NOT NULL,
    "payload" JSONB,
    "timestamp" INTEGER NOT NULL,

    CONSTRAINT "ActivityLog_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "ApiKey_key_key" ON "ApiKey"("key");

-- CreateIndex
CREATE UNIQUE INDEX "Integration_provider_environment_id_key" ON "Integration"("provider", "environment_id");

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
ALTER TABLE "LinkToken" ADD CONSTRAINT "LinkToken_environment_id_fkey" FOREIGN KEY ("environment_id") REFERENCES "Environment"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Webhook" ADD CONSTRAINT "Webhook_environment_id_fkey" FOREIGN KEY ("environment_id") REFERENCES "Environment"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Activity" ADD CONSTRAINT "Activity_environment_id_fkey" FOREIGN KEY ("environment_id") REFERENCES "Environment"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Activity" ADD CONSTRAINT "Activity_linked_account_id_fkey" FOREIGN KEY ("linked_account_id") REFERENCES "LinkedAccount"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Activity" ADD CONSTRAINT "Activity_link_token_id_fkey" FOREIGN KEY ("link_token_id") REFERENCES "LinkToken"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ActivityLog" ADD CONSTRAINT "ActivityLog_activity_id_fkey" FOREIGN KEY ("activity_id") REFERENCES "Activity"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
