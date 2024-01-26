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

-- AddForeignKey
ALTER TABLE "Webhook" ADD CONSTRAINT "Webhook_environment_id_fkey" FOREIGN KEY ("environment_id") REFERENCES "Environment"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
