-- CreateTable
CREATE TABLE "User" (
    "id" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "first_name" TEXT,
    "last_name" TEXT,
    "email_subscriptions" TEXT[],
    "created_at" INTEGER NOT NULL,
    "updated_at" INTEGER NOT NULL,
    "deleted_at" INTEGER,

    CONSTRAINT "User_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Organization" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "stripe_id" TEXT NOT NULL,
    "created_at" INTEGER NOT NULL,
    "updated_at" INTEGER NOT NULL,
    "deleted_at" INTEGER,

    CONSTRAINT "Organization_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "OrganizationMembership" (
    "id" TEXT NOT NULL,
    "organization_id" TEXT NOT NULL,
    "user_id" TEXT NOT NULL,
    "role" TEXT,
    "created_at" INTEGER NOT NULL,
    "updated_at" INTEGER NOT NULL,

    CONSTRAINT "OrganizationMembership_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Subscription" (
    "id" TEXT NOT NULL,
    "organization_id" TEXT NOT NULL,
    "stripe_id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "status" TEXT NOT NULL,
    "plan" TEXT NOT NULL,
    "price_ids" JSONB NOT NULL,
    "created_at" INTEGER NOT NULL,
    "updated_at" INTEGER NOT NULL,
    "deleted_at" INTEGER,

    CONSTRAINT "Subscription_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PaymentMethod" (
    "id" TEXT NOT NULL,
    "organization_id" TEXT NOT NULL,
    "stripe_id" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "card_brand" TEXT,
    "card_last4" TEXT,
    "card_exp_month" INTEGER,
    "card_exp_year" INTEGER,
    "created_at" INTEGER NOT NULL,
    "updated_at" INTEGER NOT NULL,
    "deleted_at" INTEGER,

    CONSTRAINT "PaymentMethod_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Environment" (
    "id" TEXT NOT NULL,
    "organization_id" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "auto_enable_collections" BOOLEAN NOT NULL,
    "auto_enable_actions" BOOLEAN NOT NULL,
    "auto_start_syncs" BOOLEAN NOT NULL,
    "default_sync_frequency" TEXT NOT NULL,
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
    "key_hash" TEXT,
    "key_iv" TEXT,
    "key_tag" TEXT,
    "display_name" TEXT,
    "created_at" INTEGER NOT NULL,
    "updated_at" INTEGER NOT NULL,
    "deleted_at" INTEGER,

    CONSTRAINT "ApiKey_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "SessionToken" (
    "id" TEXT NOT NULL,
    "environment_id" TEXT NOT NULL,
    "integration_id" TEXT NOT NULL,
    "connection_id" TEXT,
    "expires_at" INTEGER NOT NULL,
    "auth_scheme" TEXT NOT NULL,
    "language" TEXT,
    "redirect_url" TEXT,
    "configuration" JSONB,
    "inclusions" JSONB,
    "exclusions" JSONB,
    "metadata" JSONB,
    "websocket_client_id" TEXT,
    "flow" TEXT,
    "prefers_dark_mode" BOOLEAN NOT NULL DEFAULT false,
    "code_verifier" TEXT,
    "request_token_secret" TEXT,
    "created_at" INTEGER NOT NULL,
    "updated_at" INTEGER NOT NULL,
    "deleted_at" INTEGER,

    CONSTRAINT "SessionToken_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Integration" (
    "id" TEXT NOT NULL,
    "provider_key" TEXT NOT NULL,
    "environment_id" TEXT NOT NULL,
    "is_enabled" BOOLEAN NOT NULL,
    "auth_schemes" TEXT[],
    "is_using_test_credentials" BOOLEAN NOT NULL,
    "oauth_client_id" TEXT,
    "oauth_client_secret" TEXT,
    "oauth_client_secret_iv" TEXT,
    "oauth_client_secret_tag" TEXT,
    "oauth_scopes" TEXT,
    "created_at" INTEGER NOT NULL,
    "updated_at" INTEGER NOT NULL,
    "deleted_at" INTEGER
);

-- CreateTable
CREATE TABLE "Connection" (
    "id" TEXT NOT NULL,
    "environment_id" TEXT NOT NULL,
    "integration_id" TEXT NOT NULL,
    "auth_scheme" TEXT NOT NULL,
    "credentials" TEXT NOT NULL,
    "credentials_iv" TEXT,
    "credentials_tag" TEXT,
    "configuration" JSONB,
    "inclusions" JSONB,
    "exclusions" JSONB,
    "metadata" JSONB,
    "created_at" INTEGER NOT NULL,
    "updated_at" INTEGER NOT NULL,
    "deleted_at" INTEGER
);

-- CreateTable
CREATE TABLE "Collection" (
    "unique_key" TEXT NOT NULL,
    "integration_id" TEXT NOT NULL,
    "provider_key" TEXT NOT NULL,
    "environment_id" TEXT NOT NULL,
    "is_enabled" BOOLEAN NOT NULL,
    "default_sync_frequency" TEXT NOT NULL,
    "auto_start_syncs" BOOLEAN NOT NULL,
    "exclude_properties_from_syncs" TEXT[],
    "text_embedding_model" TEXT NOT NULL,
    "multimodal_embedding_model" TEXT NOT NULL,
    "configuration" JSONB,
    "created_at" INTEGER NOT NULL,
    "updated_at" INTEGER NOT NULL,
    "deleted_at" INTEGER
);

-- CreateTable
CREATE TABLE "Action" (
    "unique_key" TEXT NOT NULL,
    "integration_id" TEXT NOT NULL,
    "provider_key" TEXT NOT NULL,
    "environment_id" TEXT NOT NULL,
    "is_enabled" BOOLEAN NOT NULL,
    "configuration" JSONB,
    "created_at" INTEGER NOT NULL,
    "updated_at" INTEGER NOT NULL,
    "deleted_at" INTEGER
);

-- CreateTable
CREATE TABLE "Sync" (
    "collection_key" TEXT NOT NULL,
    "integration_id" TEXT NOT NULL,
    "provider_key" TEXT NOT NULL,
    "environment_id" TEXT NOT NULL,
    "connection_id" TEXT NOT NULL,
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
    "connection_id" TEXT NOT NULL,
    "integration_id" TEXT NOT NULL,
    "status" TEXT NOT NULL,
    "temporal_run_id" TEXT,
    "records_added" INTEGER,
    "records_updated" INTEGER,
    "records_deleted" INTEGER,
    "usage_words" INTEGER,
    "usage_images" INTEGER,
    "usage_video_seconds" INTEGER,
    "usage_audio_seconds" INTEGER,
    "timestamp" INTEGER NOT NULL,
    "duration" INTEGER,

    CONSTRAINT "SyncRun_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "SyncSchedule" (
    "id" TEXT NOT NULL,
    "collection_key" TEXT NOT NULL,
    "connection_id" TEXT NOT NULL,
    "integration_id" TEXT NOT NULL,
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
    "integration_id" TEXT NOT NULL,
    "connection_id" TEXT NOT NULL,
    "environment_id" TEXT NOT NULL,
    "status" TEXT NOT NULL,
    "input" JSONB NOT NULL,
    "output" JSONB NOT NULL,
    "timestamp" INTEGER NOT NULL,
    "duration" INTEGER NOT NULL,

    CONSTRAINT "ActionRun_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Record" (
    "id" TEXT NOT NULL,
    "collection_key" TEXT NOT NULL,
    "integration_id" TEXT NOT NULL,
    "connection_id" TEXT NOT NULL,
    "environment_id" TEXT NOT NULL,
    "external_id" TEXT NOT NULL,
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
    "integration_id" TEXT,
    "connection_id" TEXT,
    "session_token_id" TEXT,
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
CREATE UNIQUE INDEX "ApiKey_key_hash_key" ON "ApiKey"("key_hash");

-- CreateIndex
CREATE UNIQUE INDEX "Integration_id_environment_id_key" ON "Integration"("id", "environment_id");

-- CreateIndex
CREATE UNIQUE INDEX "Connection_id_integration_id_key" ON "Connection"("id", "integration_id");

-- CreateIndex
CREATE UNIQUE INDEX "Collection_unique_key_integration_id_environment_id_key" ON "Collection"("unique_key", "integration_id", "environment_id");

-- CreateIndex
CREATE UNIQUE INDEX "Action_unique_key_integration_id_environment_id_key" ON "Action"("unique_key", "integration_id", "environment_id");

-- CreateIndex
CREATE UNIQUE INDEX "Sync_collection_key_connection_id_integration_id_key" ON "Sync"("collection_key", "connection_id", "integration_id");

-- CreateIndex
CREATE UNIQUE INDEX "SyncSchedule_collection_key_connection_id_integration_id_key" ON "SyncSchedule"("collection_key", "connection_id", "integration_id");

-- CreateIndex
CREATE UNIQUE INDEX "Record_external_id_collection_key_connection_id_integration_key" ON "Record"("external_id", "collection_key", "connection_id", "integration_id");

-- CreateIndex
CREATE UNIQUE INDEX "Record_hash_collection_key_connection_id_integration_id_key" ON "Record"("hash", "collection_key", "connection_id", "integration_id");

-- AddForeignKey
ALTER TABLE "OrganizationMembership" ADD CONSTRAINT "OrganizationMembership_organization_id_fkey" FOREIGN KEY ("organization_id") REFERENCES "Organization"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "OrganizationMembership" ADD CONSTRAINT "OrganizationMembership_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Subscription" ADD CONSTRAINT "Subscription_organization_id_fkey" FOREIGN KEY ("organization_id") REFERENCES "Organization"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PaymentMethod" ADD CONSTRAINT "PaymentMethod_organization_id_fkey" FOREIGN KEY ("organization_id") REFERENCES "Organization"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Environment" ADD CONSTRAINT "Environment_organization_id_fkey" FOREIGN KEY ("organization_id") REFERENCES "Organization"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ApiKey" ADD CONSTRAINT "ApiKey_environment_id_fkey" FOREIGN KEY ("environment_id") REFERENCES "Environment"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SessionToken" ADD CONSTRAINT "SessionToken_environment_id_fkey" FOREIGN KEY ("environment_id") REFERENCES "Environment"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Integration" ADD CONSTRAINT "Integration_environment_id_fkey" FOREIGN KEY ("environment_id") REFERENCES "Environment"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Connection" ADD CONSTRAINT "Connection_environment_id_fkey" FOREIGN KEY ("environment_id") REFERENCES "Environment"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Connection" ADD CONSTRAINT "Connection_integration_id_environment_id_fkey" FOREIGN KEY ("integration_id", "environment_id") REFERENCES "Integration"("id", "environment_id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Collection" ADD CONSTRAINT "Collection_integration_id_environment_id_fkey" FOREIGN KEY ("integration_id", "environment_id") REFERENCES "Integration"("id", "environment_id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Action" ADD CONSTRAINT "Action_integration_id_environment_id_fkey" FOREIGN KEY ("integration_id", "environment_id") REFERENCES "Integration"("id", "environment_id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Sync" ADD CONSTRAINT "Sync_collection_key_integration_id_environment_id_fkey" FOREIGN KEY ("collection_key", "integration_id", "environment_id") REFERENCES "Collection"("unique_key", "integration_id", "environment_id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Sync" ADD CONSTRAINT "Sync_connection_id_integration_id_fkey" FOREIGN KEY ("connection_id", "integration_id") REFERENCES "Connection"("id", "integration_id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Sync" ADD CONSTRAINT "Sync_integration_id_environment_id_fkey" FOREIGN KEY ("integration_id", "environment_id") REFERENCES "Integration"("id", "environment_id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SyncRun" ADD CONSTRAINT "SyncRun_collection_key_connection_id_integration_id_fkey" FOREIGN KEY ("collection_key", "connection_id", "integration_id") REFERENCES "Sync"("collection_key", "connection_id", "integration_id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SyncSchedule" ADD CONSTRAINT "SyncSchedule_collection_key_connection_id_integration_id_fkey" FOREIGN KEY ("collection_key", "connection_id", "integration_id") REFERENCES "Sync"("collection_key", "connection_id", "integration_id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ActionRun" ADD CONSTRAINT "ActionRun_action_key_integration_id_environment_id_fkey" FOREIGN KEY ("action_key", "integration_id", "environment_id") REFERENCES "Action"("unique_key", "integration_id", "environment_id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ActionRun" ADD CONSTRAINT "ActionRun_connection_id_integration_id_fkey" FOREIGN KEY ("connection_id", "integration_id") REFERENCES "Connection"("id", "integration_id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Record" ADD CONSTRAINT "Record_connection_id_integration_id_fkey" FOREIGN KEY ("connection_id", "integration_id") REFERENCES "Connection"("id", "integration_id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Webhook" ADD CONSTRAINT "Webhook_environment_id_fkey" FOREIGN KEY ("environment_id") REFERENCES "Environment"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "WebhookEvent" ADD CONSTRAINT "WebhookEvent_webhook_id_fkey" FOREIGN KEY ("webhook_id") REFERENCES "Webhook"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Activity" ADD CONSTRAINT "Activity_environment_id_fkey" FOREIGN KEY ("environment_id") REFERENCES "Environment"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ActivityLog" ADD CONSTRAINT "ActivityLog_activity_id_fkey" FOREIGN KEY ("activity_id") REFERENCES "Activity"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
