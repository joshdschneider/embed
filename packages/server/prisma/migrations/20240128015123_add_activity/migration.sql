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

-- AddForeignKey
ALTER TABLE "Activity" ADD CONSTRAINT "Activity_environment_id_fkey" FOREIGN KEY ("environment_id") REFERENCES "Environment"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Activity" ADD CONSTRAINT "Activity_linked_account_id_fkey" FOREIGN KEY ("linked_account_id") REFERENCES "LinkedAccount"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Activity" ADD CONSTRAINT "Activity_link_token_id_fkey" FOREIGN KEY ("link_token_id") REFERENCES "LinkToken"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ActivityLog" ADD CONSTRAINT "ActivityLog_activity_id_fkey" FOREIGN KEY ("activity_id") REFERENCES "Activity"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
