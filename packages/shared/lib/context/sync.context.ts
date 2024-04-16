import { SourceObject } from '@embed/providers';
import { Record as DataRecord } from '@prisma/client';
import { Context } from '@temporalio/activity';
import md5 from 'md5';
import ElasticClient from '../clients/elastic.client';
import activityService from '../services/activity.service';
import providerService from '../services/provider.service';
import recordService from '../services/record.service';
import { LogLevel, Resource, SyncRunType } from '../utils/enums';
import { generateId, hashObjects, now } from '../utils/helpers';
import { BaseContext, BaseContextOptions } from './base.context';

export type SyncContextOptions = BaseContextOptions & {
  collectionKey: string;
  multimodalEnabled: boolean;
  syncRunId: string;
  lastSyncedAt: number | null;
  syncRunType: SyncRunType;
  temporalContext: Context;
};

export class SyncContext extends BaseContext {
  public collectionKey: string;
  public multimodalEnabled: boolean;
  public syncRunId: string;
  public lastSyncedAt: number | null;
  public syncRunType: SyncRunType;

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
    this.syncRunType = options.syncRunType;
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

    const providerCollection = await providerService.getProviderCollection(
      this.integrationKey,
      this.collectionKey
    );

    if (!providerCollection) {
      throw new Error(`Failed to get collection schema for ${this.collectionKey}`);
    }

    const collectionSchema = providerCollection.schema;

    const records: DataRecord[] = objects.map((obj) => {
      const hash = md5(JSON.stringify(obj));

      Object.entries(collectionSchema.properties).forEach(([k, v]) => {
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
        timestamp: now(),
        message: `Failed to batch save records for collection ${this.collectionKey}`,
        payload: {
          linked_account: this.linkedAccountId,
          integration: this.integrationKey,
          collection: this.collectionKey,
          batch_count: objects.length,
        },
      });

      return false;
    }

    const { addedKeys, updatedKeys } = batchSaveResult;
    this.addedKeys.push(...addedKeys);
    this.updatedKeys.push(...updatedKeys);

    const elastic = ElasticClient.getInstance();

    const objectsToCreate = objects.filter((obj) => addedKeys.includes(obj.id));
    const hashedObjectsToCreate = hashObjects(objectsToCreate, collectionSchema.properties);
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
        timestamp: now(),
        message: `Failed to create vectors for ${this.collectionKey} during sync run`,
        payload: {
          linked_account: this.linkedAccountId,
          integration: this.integrationKey,
          collection: this.collectionKey,
          sync_run: this.syncRunId,
          count: objectsToCreate.length,
        },
      });
    }

    const objectsToUpdate = objects.filter((obj) => updatedKeys.includes(obj.id));
    const hashedObjectsToUpdate = hashObjects(objectsToUpdate, collectionSchema.properties);
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
        timestamp: now(),
        message: `Failed to update vectors for ${this.collectionKey} during sync run`,
        payload: {
          linked_account: this.linkedAccountId,
          integration: this.integrationKey,
          collection: this.collectionKey,
          sync_run: this.syncRunId,
          count: objectsToUpdate.length,
        },
      });
    }

    return true;
  }

  public async pruneDeleted(allIds: string[]): Promise<boolean> {
    const result = await recordService.pruneDeleted(
      this.linkedAccountId,
      this.collectionKey,
      allIds
    );

    if (!result) {
      return false;
    }

    const { deletedKeys } = result;
    this.deletedKeys.push(...deletedKeys);

    const elastic = ElasticClient.getInstance();
    const didPruneDeleted = await elastic.deleteObjects({
      collectionKey: this.collectionKey,
      linkedAccountId: this.linkedAccountId,
      objectIds: deletedKeys,
    });

    return didPruneDeleted;
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
