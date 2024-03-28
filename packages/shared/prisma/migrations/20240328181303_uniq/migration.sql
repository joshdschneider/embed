/*
  Warnings:

  - A unique constraint covering the columns `[external_id,linked_account_id,collection_key]` on the table `Record` will be added. If there are existing duplicate values, this will fail.
  - A unique constraint covering the columns `[hash,linked_account_id,collection_key]` on the table `Record` will be added. If there are existing duplicate values, this will fail.

*/
-- CreateIndex
CREATE UNIQUE INDEX "Record_external_id_linked_account_id_collection_key_key" ON "Record"("external_id", "linked_account_id", "collection_key");

-- CreateIndex
CREATE UNIQUE INDEX "Record_hash_linked_account_id_collection_key_key" ON "Record"("hash", "linked_account_id", "collection_key");
