-- CreateTable
CREATE TABLE "LinkToken" (
    "id" TEXT NOT NULL,
    "environment_id" TEXT NOT NULL,
    "integration_provider" TEXT,
    "expires_at" INTEGER NOT NULL,
    "language" TEXT,
    "redirect_url" TEXT,
    "metadata" JSONB,
    "created_at" INTEGER NOT NULL,
    "updated_at" INTEGER,

    CONSTRAINT "LinkToken_pkey" PRIMARY KEY ("id")
);

-- AddForeignKey
ALTER TABLE "LinkToken" ADD CONSTRAINT "LinkToken_environment_id_fkey" FOREIGN KEY ("environment_id") REFERENCES "Environment"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "LinkToken" ADD CONSTRAINT "LinkToken_integration_provider_fkey" FOREIGN KEY ("integration_provider") REFERENCES "Integration"("provider") ON DELETE SET NULL ON UPDATE CASCADE;
