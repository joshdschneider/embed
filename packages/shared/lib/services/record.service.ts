import { Record as DataRecord } from '@prisma/client';
import { now } from 'lodash';
import { database } from '../utils/database';
import encryptionService from './encryption.service';
import errorService from './error.service';

class RecordService {
  public async batchSave(
    linkedAccountId: string,
    collectionKey: string,
    records: DataRecord[]
  ): Promise<{ addedKeys: string[]; updatedKeys: string[] } | null> {
    try {
      const existingRecords = await database.record.findMany({
        where: {
          linked_account_id: linkedAccountId,
          collection_key: collectionKey,
          external_id: { in: records.map((rec) => rec.external_id) },
          deleted_at: null,
        },
        select: { external_id: true, hash: true },
      });

      const existingExternalIds = new Set(existingRecords.map((rec) => rec.external_id));
      const existingHashes = new Set(existingRecords.map((rec) => rec.hash));

      const recordsToCreate = records.filter((rec) => !existingExternalIds.has(rec.external_id));
      const recordsToUpdate = records.filter((rec) => !existingHashes.has(rec.hash));

      let addedKeys: string[] = [];
      let updatedKeys: string[] = [];

      if (recordsToCreate.length > 0) {
        const encryptedRecordsToCreate = recordsToCreate.map((rec) => {
          return encryptionService.encryptRecord(rec);
        });

        await database.record.createMany({ data: encryptedRecordsToCreate });
        addedKeys = encryptedRecordsToCreate.map((rec) => rec.id);
      }

      if (recordsToUpdate.length > 0) {
        const updatePromises = recordsToUpdate.map((rec) => {
          const encryptedRecord = encryptionService.encryptRecord(rec);
          return database.record.update({
            where: {
              external_id_linked_account_id_collection_key: {
                linked_account_id: linkedAccountId,
                collection_key: collectionKey,
                external_id: rec.external_id,
              },
              deleted_at: null,
            },
            data: {
              hash: encryptedRecord.hash,
              object: encryptedRecord.object,
              object_iv: encryptedRecord.object_iv,
              object_tag: encryptedRecord.object_tag,
              updated_at: now(),
            },
            select: { id: true },
          });
        });

        const updatedRecords = await Promise.all(updatePromises);
        updatedKeys = updatedRecords.map((rec) => rec.id);
      }

      return { addedKeys, updatedKeys };
    } catch (err) {
      await errorService.reportError(err);
      return null;
    }
  }

  public async pruneDeleted(
    linkedAccountId: string,
    collectionKey: string,
    crawledExternalIds: string[]
  ): Promise<{ deletedKeys: string[] } | null> {
    try {
      const recordsToDelete = await database.record.findMany({
        where: {
          linked_account_id: linkedAccountId,
          collection_key: collectionKey,
          external_id: { notIn: crawledExternalIds },
          deleted_at: null,
        },
        select: { id: true },
      });

      const updatePromises = recordsToDelete.map((rec) => {
        return database.record.update({
          where: { id: rec.id, deleted_at: null },
          data: { deleted_at: now() },
          select: { id: true },
        });
      });

      const deletedRecords = await Promise.all(updatePromises);
      return { deletedKeys: deletedRecords.map((rec) => rec.id) };
    } catch (err) {
      await errorService.reportError(err);
      return null;
    }
  }
}

export default new RecordService();
