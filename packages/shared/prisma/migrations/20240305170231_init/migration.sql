-- CreateTable
CREATE TABLE "Account" (
    "id" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "name" TEXT,
    "organization_id" TEXT,
    "created_at" INTEGER NOT NULL,
    "updated_at" INTEGER NOT NULL,
    "deleted_at" INTEGER,

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
    "updated_at" INTEGER NOT NULL,
    "deleted_at" INTEGER,

    CONSTRAINT "User_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Environment" (
    "id" TEXT NOT NULL,
    "account_id" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "enable_new_integrations" BOOLEAN NOT NULL,
    "default_text_embedding_model" TEXT NOT NULL,
    "default_multimodal_embedding_model" TEXT NOT NULL,
    "branding" JSONB NOT NULL,
    "created_at" INTEGER NOT NULL,
    "updated_at" INTEGER NOT NULL,
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
    "updated_at" INTEGER NOT NULL,
    "deleted_at" INTEGER,

    CONSTRAINT "ApiKey_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "LinkToken" (
    "id" TEXT NOT NULL,
    "environment_id" TEXT NOT NULL,
    "integration_key" TEXT,
    "linked_account_id" TEXT,
    "expires_at" INTEGER NOT NULL,
    "language" TEXT NOT NULL,
    "redirect_url" TEXT,
    "metadata" JSONB,
    "can_choose_integration" BOOLEAN NOT NULL,
    "consent_given" BOOLEAN NOT NULL DEFAULT false,
    "consent_timestamp" INTEGER,
    "configuration" JSONB,
    "websocket_client_id" TEXT,
    "link_method" TEXT,
    "prefers_dark_mode" BOOLEAN NOT NULL DEFAULT false,
    "code_verifier" TEXT,
    "request_token_secret" TEXT,
    "created_at" INTEGER NOT NULL,
    "updated_at" INTEGER NOT NULL,
    "deleted_at" INTEGER,

    CONSTRAINT "LinkToken_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "LinkedAccount" (
    "id" TEXT NOT NULL,
    "environment_id" TEXT NOT NULL,
    "integration_key" TEXT NOT NULL,
    "credentials" TEXT NOT NULL,
    "credentials_iv" TEXT,
    "credentials_tag" TEXT,
    "configuration" JSONB NOT NULL,
    "metadata" JSONB,
    "consent_given" BOOLEAN NOT NULL DEFAULT false,
    "consent_timestamp" INTEGER,
    "created_at" INTEGER NOT NULL,
    "updated_at" INTEGER NOT NULL,
    "deleted_at" INTEGER,

    CONSTRAINT "LinkedAccount_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Integration" (
    "unique_key" TEXT NOT NULL,
    "environment_id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "is_enabled" BOOLEAN NOT NULL,
    "use_oauth_credentials" BOOLEAN NOT NULL,
    "oauth_client_id" TEXT,
    "oauth_client_secret" TEXT,
    "oauth_client_secret_iv" TEXT,
    "oauth_client_secret_tag" TEXT,
    "additional_scopes" TEXT,
    "rank" INTEGER,
    "created_at" INTEGER NOT NULL,
    "updated_at" INTEGER NOT NULL,
    "deleted_at" INTEGER
);

-- CreateTable
CREATE TABLE "Collection" (
    "unique_key" TEXT NOT NULL,
    "integration_key" TEXT NOT NULL,
    "environment_id" TEXT NOT NULL,
    "is_enabled" BOOLEAN NOT NULL,
    "default_sync_frequency" TEXT NOT NULL,
    "auto_start_sync" BOOLEAN NOT NULL,
    "exclude_properties_from_sync" TEXT[],
    "text_embedding_model" TEXT NOT NULL,
    "multimodal_embedding_model" TEXT NOT NULL,
    "is_multimodal" BOOLEAN NOT NULL,
    "created_at" INTEGER NOT NULL,
    "updated_at" INTEGER NOT NULL,
    "deleted_at" INTEGER
);

-- CreateTable
CREATE TABLE "Action" (
    "unique_key" TEXT NOT NULL,
    "integration_key" TEXT NOT NULL,
    "environment_id" TEXT NOT NULL,
    "is_enabled" BOOLEAN NOT NULL,
    "created_at" INTEGER NOT NULL,
    "updated_at" INTEGER NOT NULL,
    "deleted_at" INTEGER
);

-- CreateTable
CREATE TABLE "Sync" (
    "collection_key" TEXT NOT NULL,
    "integration_key" TEXT NOT NULL,
    "environment_id" TEXT NOT NULL,
    "linked_account_id" TEXT NOT NULL,
    "status" TEXT NOT NULL,
    "frequency" TEXT NOT NULL,
    "last_synced_at" INTEGER,
    "created_at" INTEGER NOT NULL,
    "updated_at" INTEGER NOT NULL,
    "deleted_at" INTEGER
);

-- CreateTable
CREATE TABLE "SyncRun" (
    "id" TEXT NOT NULL,
    "collection_key" TEXT NOT NULL,
    "linked_account_id" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "status" TEXT NOT NULL,
    "temporal_run_id" TEXT,
    "records_added" INTEGER,
    "records_updated" INTEGER,
    "records_deleted" INTEGER,
    "created_at" INTEGER NOT NULL,
    "updated_at" INTEGER NOT NULL,

    CONSTRAINT "SyncRun_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "SyncSchedule" (
    "id" TEXT NOT NULL,
    "collection_key" TEXT NOT NULL,
    "linked_account_id" TEXT NOT NULL,
    "status" TEXT NOT NULL,
    "frequency" TEXT NOT NULL,
    "offset" INTEGER NOT NULL,
    "created_at" INTEGER NOT NULL,
    "updated_at" INTEGER NOT NULL,
    "deleted_at" INTEGER,

    CONSTRAINT "SyncSchedule_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ActionRun" (
    "id" TEXT NOT NULL,
    "action_key" TEXT NOT NULL,
    "integration_key" TEXT NOT NULL,
    "environment_id" TEXT NOT NULL,
    "linked_account_id" TEXT NOT NULL,
    "created_at" INTEGER NOT NULL,
    "updated_at" INTEGER NOT NULL,

    CONSTRAINT "ActionRun_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Record" (
    "id" TEXT NOT NULL,
    "collection_key" TEXT NOT NULL,
    "integration_key" TEXT NOT NULL,
    "environment_id" TEXT NOT NULL,
    "linked_account_id" TEXT NOT NULL,
    "external_id" TEXT NOT NULL,
    "object" TEXT NOT NULL,
    "object_iv" TEXT,
    "object_tag" TEXT,
    "hash" TEXT NOT NULL,
    "created_at" INTEGER NOT NULL,
    "updated_at" INTEGER NOT NULL,
    "deleted_at" INTEGER,

    CONSTRAINT "Record_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Webhook" (
    "id" TEXT NOT NULL,
    "environment_id" TEXT NOT NULL,
    "url" TEXT NOT NULL,
    "event_subscriptions" TEXT[],
    "is_enabled" BOOLEAN NOT NULL,
    "secret" TEXT NOT NULL,
    "secret_iv" TEXT,
    "secret_tag" TEXT,
    "created_at" INTEGER NOT NULL,
    "updated_at" INTEGER NOT NULL,
    "deleted_at" INTEGER,

    CONSTRAINT "Webhook_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "WebhookEvent" (
    "id" TEXT NOT NULL,
    "webhook_id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "payload" JSONB NOT NULL,
    "delivered" BOOLEAN NOT NULL,
    "timestamp" INTEGER NOT NULL,

    CONSTRAINT "WebhookEvent_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Activity" (
    "id" TEXT NOT NULL,
    "environment_id" TEXT NOT NULL,
    "integration_key" TEXT,
    "linked_account_id" TEXT,
    "link_token_id" TEXT,
    "collection_key" TEXT,
    "action_key" TEXT,
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
CREATE UNIQUE INDEX "Integration_unique_key_environment_id_key" ON "Integration"("unique_key", "environment_id");

-- CreateIndex
CREATE UNIQUE INDEX "Collection_unique_key_integration_key_environment_id_key" ON "Collection"("unique_key", "integration_key", "environment_id");

-- CreateIndex
CREATE UNIQUE INDEX "Action_unique_key_integration_key_environment_id_key" ON "Action"("unique_key", "integration_key", "environment_id");

-- CreateIndex
CREATE UNIQUE INDEX "Sync_collection_key_linked_account_id_key" ON "Sync"("collection_key", "linked_account_id");

-- CreateIndex
CREATE UNIQUE INDEX "ActionRun_action_key_linked_account_id_key" ON "ActionRun"("action_key", "linked_account_id");

-- AddForeignKey
ALTER TABLE "User" ADD CONSTRAINT "User_account_id_fkey" FOREIGN KEY ("account_id") REFERENCES "Account"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Environment" ADD CONSTRAINT "Environment_account_id_fkey" FOREIGN KEY ("account_id") REFERENCES "Account"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ApiKey" ADD CONSTRAINT "ApiKey_environment_id_fkey" FOREIGN KEY ("environment_id") REFERENCES "Environment"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "LinkToken" ADD CONSTRAINT "LinkToken_environment_id_fkey" FOREIGN KEY ("environment_id") REFERENCES "Environment"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "LinkedAccount" ADD CONSTRAINT "LinkedAccount_environment_id_fkey" FOREIGN KEY ("environment_id") REFERENCES "Environment"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "LinkedAccount" ADD CONSTRAINT "LinkedAccount_integration_key_environment_id_fkey" FOREIGN KEY ("integration_key", "environment_id") REFERENCES "Integration"("unique_key", "environment_id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Integration" ADD CONSTRAINT "Integration_environment_id_fkey" FOREIGN KEY ("environment_id") REFERENCES "Environment"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Collection" ADD CONSTRAINT "Collection_integration_key_environment_id_fkey" FOREIGN KEY ("integration_key", "environment_id") REFERENCES "Integration"("unique_key", "environment_id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Action" ADD CONSTRAINT "Action_integration_key_environment_id_fkey" FOREIGN KEY ("integration_key", "environment_id") REFERENCES "Integration"("unique_key", "environment_id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Sync" ADD CONSTRAINT "Sync_collection_key_integration_key_environment_id_fkey" FOREIGN KEY ("collection_key", "integration_key", "environment_id") REFERENCES "Collection"("unique_key", "integration_key", "environment_id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Sync" ADD CONSTRAINT "Sync_linked_account_id_fkey" FOREIGN KEY ("linked_account_id") REFERENCES "LinkedAccount"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Sync" ADD CONSTRAINT "Sync_integration_key_environment_id_fkey" FOREIGN KEY ("integration_key", "environment_id") REFERENCES "Integration"("unique_key", "environment_id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SyncRun" ADD CONSTRAINT "SyncRun_collection_key_linked_account_id_fkey" FOREIGN KEY ("collection_key", "linked_account_id") REFERENCES "Sync"("collection_key", "linked_account_id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SyncRun" ADD CONSTRAINT "SyncRun_linked_account_id_fkey" FOREIGN KEY ("linked_account_id") REFERENCES "LinkedAccount"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SyncSchedule" ADD CONSTRAINT "SyncSchedule_collection_key_linked_account_id_fkey" FOREIGN KEY ("collection_key", "linked_account_id") REFERENCES "Sync"("collection_key", "linked_account_id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SyncSchedule" ADD CONSTRAINT "SyncSchedule_linked_account_id_fkey" FOREIGN KEY ("linked_account_id") REFERENCES "LinkedAccount"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ActionRun" ADD CONSTRAINT "ActionRun_action_key_integration_key_environment_id_fkey" FOREIGN KEY ("action_key", "integration_key", "environment_id") REFERENCES "Action"("unique_key", "integration_key", "environment_id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ActionRun" ADD CONSTRAINT "ActionRun_linked_account_id_fkey" FOREIGN KEY ("linked_account_id") REFERENCES "LinkedAccount"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Record" ADD CONSTRAINT "Record_collection_key_integration_key_environment_id_fkey" FOREIGN KEY ("collection_key", "integration_key", "environment_id") REFERENCES "Collection"("unique_key", "integration_key", "environment_id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Record" ADD CONSTRAINT "Record_linked_account_id_fkey" FOREIGN KEY ("linked_account_id") REFERENCES "LinkedAccount"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Webhook" ADD CONSTRAINT "Webhook_environment_id_fkey" FOREIGN KEY ("environment_id") REFERENCES "Environment"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "WebhookEvent" ADD CONSTRAINT "WebhookEvent_webhook_id_fkey" FOREIGN KEY ("webhook_id") REFERENCES "Webhook"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Activity" ADD CONSTRAINT "Activity_environment_id_fkey" FOREIGN KEY ("environment_id") REFERENCES "Environment"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ActivityLog" ADD CONSTRAINT "ActivityLog_activity_id_fkey" FOREIGN KEY ("activity_id") REFERENCES "Activity"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
