-- CreateTable
CREATE TABLE "SyncModel" (
    "id" TEXT NOT NULL,
    "integration_provider" TEXT NOT NULL,
    "environment_id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "is_enabled" BOOLEAN NOT NULL,
    "required_scopes" TEXT[],
    "excluded_fields" TEXT[],
    "created_at" INTEGER NOT NULL,
    "updated_at" INTEGER,
    "deleted_at" INTEGER,

    CONSTRAINT "SyncModel_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Sync" (
    "id" TEXT NOT NULL,
    "linked_account_id" TEXT NOT NULL,
    "model_id" TEXT NOT NULL,
    "frequency" TEXT NOT NULL,
    "created_at" INTEGER NOT NULL,
    "updated_at" INTEGER,
    "deleted_at" INTEGER,

    CONSTRAINT "Sync_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "SyncJob" (
    "id" TEXT NOT NULL,
    "sync_id" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "status" TEXT NOT NULL,

    CONSTRAINT "SyncJob_pkey" PRIMARY KEY ("id")
);

-- AddForeignKey
ALTER TABLE "SyncModel" ADD CONSTRAINT "SyncModel_integration_provider_environment_id_fkey" FOREIGN KEY ("integration_provider", "environment_id") REFERENCES "Integration"("provider", "environment_id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Sync" ADD CONSTRAINT "Sync_linked_account_id_fkey" FOREIGN KEY ("linked_account_id") REFERENCES "LinkedAccount"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Sync" ADD CONSTRAINT "Sync_model_id_fkey" FOREIGN KEY ("model_id") REFERENCES "SyncModel"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SyncJob" ADD CONSTRAINT "SyncJob_sync_id_fkey" FOREIGN KEY ("sync_id") REFERENCES "Sync"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
