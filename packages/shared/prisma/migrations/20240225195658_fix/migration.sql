-- AddForeignKey
ALTER TABLE "SyncRun" ADD CONSTRAINT "SyncRun_linked_account_id_fkey" FOREIGN KEY ("linked_account_id") REFERENCES "LinkedAccount"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SyncSchedule" ADD CONSTRAINT "SyncSchedule_linked_account_id_fkey" FOREIGN KEY ("linked_account_id") REFERENCES "LinkedAccount"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ActionRun" ADD CONSTRAINT "ActionRun_linked_account_id_fkey" FOREIGN KEY ("linked_account_id") REFERENCES "LinkedAccount"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
