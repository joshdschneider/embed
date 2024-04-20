import { SourceObject } from '@embed/providers';
import { Record as DataRecord } from '@prisma/client';
import { Context } from '@temporalio/activity';
import md5 from 'md5';
import ElasticClient from '../clients/elastic.client';
import activityService from '../services/activity.service';
import providerService from '../services/provider.service';
import recordService from '../services/record.service';
import { LogLevel, Resource } from '../utils/enums';
import { generateId, hashObjects, now } from '../utils/helpers';
import { BaseContext, BaseContextOptions } from './base.context';

export type SyncContextOptions = BaseContextOptions & {
  collectionKey: string;
  multimodalEnabled: boolean;
  syncRunId: string;
  lastSyncedAt: number | null;
  temporalContext: Context;
};

export class SyncContext extends BaseContext {
  public collectionKey: string;
  public multimodalEnabled: boolean;
  public syncRunId: string;
  public lastSyncedAt: number | null;

  private addedKeys: string[];
  private updatedKeys: string[];
  private deletedKeys: string[];
  private interval?: NodeJS.Timeout;

  constructor(options: SyncContextOptions) {
    super(options);
    this.collectionKey = options.collectionKey;
    this.multimodalEnabled = options.multimodalEnabled;
    this.syncRunId = options.syncRunId;
    this.activityId = options.activityId;
    this.lastSyncedAt = options.lastSyncedAt;
    this.addedKeys = [];
    this.updatedKeys = [];
    this.deletedKeys = [];

    const temporal = options.temporalContext;
    const heartbeat = 1000 * 60 * 5;
    this.interval = setInterval(() => {
      temporal.heartbeat();
    }, heartbeat);
  }

  public async batchSave(objects: SourceObject[]): Promise<boolean> {
    if (!objects || objects.length === 0) {
      return true;
    }

    try {
      const collection = await providerService.getProviderCollection(
        this.integrationKey,
        this.collectionKey
      );

      if (!collection) {
        throw new Error(`Failed to get collection schema for ${this.collectionKey}`);
      }

      const records: DataRecord[] = objects.map((originalObj) => {
        const obj = { ...originalObj };
        const hash = md5(JSON.stringify(obj));

        Object.entries(collection.schema.properties).forEach(([k, v]) => {
          if (v.hidden) {
            delete obj[k];
          }

          if (v.return_by_default === false) {
            delete obj[k];
          }

          if (v.type === 'nested' && v.properties) {
            Object.entries(v.properties).forEach(([nestedKey, nestedValue]) => {
              const nestedObjOrArray = obj[k];
              if (Array.isArray(nestedObjOrArray) && nestedObjOrArray.length > 0) {
                nestedObjOrArray.forEach((nestedObj) => {
                  if (nestedValue.hidden) {
                    delete nestedObj[nestedKey];
                  }

                  if (nestedValue.return_by_default === false) {
                    delete nestedObj[nestedKey];
                  }
                });
                obj[k] = nestedObjOrArray;
              } else if (nestedObjOrArray && typeof nestedObjOrArray === 'object') {
                if (nestedValue.hidden) {
                  delete obj[k][nestedKey];
                }

                if (nestedValue.return_by_default === false) {
                  delete obj[k][nestedKey];
                }
              }
            });
          }
        });

        return {
          id: generateId(Resource.Record),
          external_id: obj.id,
          environment_id: this.environmentId,
          linked_account_id: this.linkedAccountId,
          integration_key: this.integrationKey,
          collection_key: this.collectionKey,
          object: JSON.stringify(obj),
          object_iv: null,
          object_tag: null,
          hash,
          created_at: now(),
          updated_at: now(),
          deleted_at: null,
        };
      });

      const batchSaveResult = await recordService.batchSave(
        this.linkedAccountId,
        this.collectionKey,
        records
      );

      if (!batchSaveResult) {
        await activityService.createActivityLog(this.activityId, {
          level: LogLevel.Error,
          message: 'Failed to batch save records',
          timestamp: now(),
          payload: { count: records.length },
        });
        return false;
      }

      const { addedKeys, updatedKeys } = batchSaveResult;
      this.addedKeys.push(...addedKeys);
      this.updatedKeys.push(...updatedKeys);

      const elastic = ElasticClient.getInstance();
      const objectsToCreate = objects.filter((obj) => addedKeys.includes(obj.id));
      const hashedObjectsToCreate = hashObjects(objectsToCreate, collection.schema.properties);

      const didCreate = await elastic.batchUpsertObjects({
        environmentId: this.environmentId,
        collectionKey: this.collectionKey,
        integrationKey: this.integrationKey,
        linkedAccountId: this.linkedAccountId,
        objects: hashedObjectsToCreate,
      });

      if (!didCreate) {
        await activityService.createActivityLog(this.activityId, {
          level: LogLevel.Error,
          message: `Failed to create ${addedKeys.length} objects`,
          timestamp: now(),
          payload: { error: 'Internal server error' },
        });

        await recordService.deleteRecords(this.linkedAccountId, this.collectionKey, addedKeys);
        this.addedKeys = this.addedKeys.filter((key) => !addedKeys.includes(key));
      }

      const objectsToUpdate = objects.filter((obj) => updatedKeys.includes(obj.id));
      const hashedObjectsToUpdate = hashObjects(objectsToUpdate, collection.schema.properties);

      const didUpdate = await elastic.updateObjects({
        environmentId: this.environmentId,
        collectionKey: this.collectionKey,
        integrationKey: this.integrationKey,
        linkedAccountId: this.linkedAccountId,
        objects: hashedObjectsToUpdate,
      });

      if (!didUpdate) {
        await activityService.createActivityLog(this.activityId, {
          level: LogLevel.Error,
          message: `Failed to update ${updatedKeys.length} objects`,
          timestamp: now(),
          payload: { error: 'Internal server error' },
        });

        await recordService.deleteRecords(this.linkedAccountId, this.collectionKey, updatedKeys);
        this.updatedKeys = this.updatedKeys.filter((key) => !updatedKeys.includes(key));
      }

      return true;
    } catch (err) {
      await activityService.createActivityLog(this.activityId, {
        level: LogLevel.Error,
        message: 'Failed to batch save objects',
        timestamp: now(),
      });

      await this.reportError(err);
      return false;
    }
  }

  public async pruneDeleted(allIds: string[]): Promise<boolean> {
    try {
      const result = await recordService.pruneDeleted(
        this.linkedAccountId,
        this.collectionKey,
        allIds
      );

      if (!result) {
        await activityService.createActivityLog(this.activityId, {
          level: LogLevel.Error,
          message: 'Failed to prune deleted records',
          timestamp: now(),
        });
        return false;
      }

      const { deletedKeys } = result;
      this.deletedKeys.push(...deletedKeys);

      if (deletedKeys.length > 0) {
        const elastic = ElasticClient.getInstance();
        const didPruneDeleted = await elastic.deleteObjects({
          collectionKey: this.collectionKey,
          linkedAccountId: this.linkedAccountId,
          objectIds: deletedKeys,
        });

        if (!didPruneDeleted) {
          await activityService.createActivityLog(this.activityId, {
            level: LogLevel.Error,
            message: `Failed to prune ${deletedKeys.length} deleted objects`,
            timestamp: now(),
          });
          return false;
        }
      }

      return true;
    } catch (err) {
      await activityService.createActivityLog(this.activityId, {
        level: LogLevel.Error,
        message: 'Failed to prune deleted objects',
        timestamp: now(),
      });

      await this.reportError(err);
      return false;
    }
  }

  public async reportResults(): Promise<{
    records_added: number;
    records_updated: number;
    records_deleted: number;
  }> {
    return {
      records_added: this.addedKeys.length,
      records_updated: this.updatedKeys.length,
      records_deleted: this.deletedKeys.length,
    };
  }

  public finish(): boolean {
    clearInterval(this.interval);
    this.interval = undefined;
    return true;
  }
}
