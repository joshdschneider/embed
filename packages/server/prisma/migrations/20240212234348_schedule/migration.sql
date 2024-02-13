-- CreateTable
CREATE TABLE "SyncSchedule" (
    "id" TEXT NOT NULL,
    "sync_id" TEXT NOT NULL,
    "sync_job_id" TEXT NOT NULL,
    "status" TEXT NOT NULL,
    "frequency" TEXT NOT NULL,
    "offset" INTEGER NOT NULL,

    CONSTRAINT "SyncSchedule_pkey" PRIMARY KEY ("id")
);

-- AddForeignKey
ALTER TABLE "SyncSchedule" ADD CONSTRAINT "SyncSchedule_sync_id_fkey" FOREIGN KEY ("sync_id") REFERENCES "Sync"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SyncSchedule" ADD CONSTRAINT "SyncSchedule_sync_job_id_fkey" FOREIGN KEY ("sync_job_id") REFERENCES "SyncJob"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
