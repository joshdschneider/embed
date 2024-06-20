import { Record as DataRecord } from '@prisma/client';
import { database } from '../utils/database';
import { now } from '../utils/helpers';
import encryptionService from './encryption.service';
import errorService from './error.service';

class RecordService {
  public async batchSave({
    integrationId,
    connectionId,
    collectionKey,
    records,
  }: {
    integrationId: string;
    connectionId: string;
    collectionKey: string;
    records: DataRecord[];
  }): Promise<{ addedKeys: string[]; updatedKeys: string[] } | null> {
    try {
      const existingRecords = await database.record.findMany({
        where: {
          integration_id: integrationId,
          connection_id: connectionId,
          collection_key: collectionKey,
          external_id: { in: records.map((rec) => rec.external_id) },
          deleted_at: null,
        },
        select: { external_id: true, hash: true },
      });

      const existingExternalIds = new Set(existingRecords.map((rec) => rec.external_id));
      const existingHashes = new Set(existingRecords.map((rec) => rec.hash));

      const recordsToCreate = records.filter((rec) => !existingExternalIds.has(rec.external_id));
      const recordsToUpdate = records.filter(
        (rec) => existingExternalIds.has(rec.external_id) && !existingHashes.has(rec.hash)
      );

      let addedKeys: string[] = [];
      let updatedKeys: string[] = [];

      if (recordsToCreate.length > 0) {
        const encryptedRecordsToCreate = recordsToCreate.map((rec) => {
          return encryptionService.encryptRecord(rec);
        });

        await database.record.createMany({ data: encryptedRecordsToCreate });
        addedKeys = encryptedRecordsToCreate.map((rec) => rec.external_id);
      }

      if (recordsToUpdate.length > 0) {
        for (const rec of recordsToUpdate) {
          const encryptedRecord = encryptionService.encryptRecord(rec);
          const updatedRecord = await database.record.update({
            where: {
              external_id_collection_key_connection_id_integration_id: {
                external_id: rec.external_id,
                collection_key: collectionKey,
                connection_id: connectionId,
                integration_id: integrationId,
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
            select: { external_id: true },
          });

          updatedKeys.push(updatedRecord.external_id);
        }
      }

      return { addedKeys, updatedKeys };
    } catch (err) {
      await errorService.reportError(err);
      return null;
    }
  }

  public async pruneDeleted({
    integrationId,
    connectionId,
    collectionKey,
    crawledExternalIds,
  }: {
    integrationId: string;
    connectionId: string;
    collectionKey: string;
    crawledExternalIds: string[];
  }): Promise<{ deletedKeys: string[] } | null> {
    try {
      const recordsToDelete = await database.record.findMany({
        where: {
          integration_id: integrationId,
          connection_id: connectionId,
          collection_key: collectionKey,
          external_id: { notIn: crawledExternalIds },
          deleted_at: null,
        },
        select: { id: true, external_id: true, hash: true },
      });

      const deletedSuffix = '_deleted_' + now().toString();
      const updatePromises = recordsToDelete.map((rec) => {
        return database.record.update({
          where: { id: rec.id, deleted_at: null },
          data: {
            external_id: rec.external_id + deletedSuffix,
            hash: rec.hash + deletedSuffix,
            deleted_at: now(),
          },
          select: { external_id: true },
        });
      });

      const deletedRecords = await Promise.all(updatePromises);
      return { deletedKeys: deletedRecords.map((rec) => rec.external_id) };
    } catch (err) {
      await errorService.reportError(err);
      return null;
    }
  }

  public async deleteRecordsByIds({
    integrationId,
    connectionId,
    collectionKey,
    externalIds,
  }: {
    integrationId: string;
    connectionId: string;
    collectionKey: string;
    externalIds: string[];
  }): Promise<{ deletedKeys: string[] } | null> {
    try {
      const recordsToDelete = await database.record.findMany({
        where: {
          integration_id: integrationId,
          connection_id: connectionId,
          collection_key: collectionKey,
          external_id: { in: externalIds },
          deleted_at: null,
        },
        select: { id: true, external_id: true, hash: true },
      });

      const deletedSuffix = '_deleted_' + now().toString();
      const deletedRecords = await database.$transaction(
        recordsToDelete.map((rec) => {
          return database.record.update({
            where: { id: rec.id },
            data: {
              external_id: rec.external_id + deletedSuffix,
              hash: rec.hash + deletedSuffix,
              deleted_at: now(),
            },
            select: { external_id: true },
          });
        })
      );

      return { deletedKeys: deletedRecords.map((rec) => rec.external_id) };
    } catch (err) {
      await errorService.reportError(err);
      return null;
    }
  }

  public async deleteRecordsForCollection({
    environmentId,
    integrationId,
    collectionKey,
  }: {
    environmentId: string;
    integrationId: string;
    collectionKey: string;
  }): Promise<boolean> {
    try {
      const recordsToDelete = await database.record.findMany({
        where: {
          environment_id: environmentId,
          integration_id: integrationId,
          collection_key: collectionKey,
          deleted_at: null,
        },
        select: { id: true, external_id: true, hash: true },
      });

      const deletedSuffix = '_deleted_' + now().toString();
      await database.$transaction(
        recordsToDelete.map((rec) => {
          return database.record.update({
            where: { id: rec.id },
            data: {
              external_id: rec.external_id + deletedSuffix,
              hash: rec.hash + deletedSuffix,
              deleted_at: now(),
            },
            select: { external_id: true },
          });
        })
      );

      return true;
    } catch (err) {
      await errorService.reportError(err);
      return false;
    }
  }

  public async deleteRecordsForConnection({
    connectionId,
    integrationId,
  }: {
    connectionId: string;
    integrationId: string;
  }): Promise<boolean> {
    try {
      const recordsToDelete = await database.record.findMany({
        where: {
          connection_id: connectionId,
          integration_id: integrationId,
          deleted_at: null,
        },
        select: { id: true, external_id: true, hash: true },
      });

      const deletedSuffix = '_deleted_' + now().toString();
      await database.$transaction(
        recordsToDelete.map((rec) => {
          return database.record.update({
            where: { id: rec.id },
            data: {
              external_id: rec.external_id + deletedSuffix,
              hash: rec.hash + deletedSuffix,
              deleted_at: now(),
            },
            select: { external_id: true },
          });
        })
      );

      return true;
    } catch (err) {
      await errorService.reportError(err);
      return false;
    }
  }
}

export default new RecordService();
