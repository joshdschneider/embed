import { Record as DataRecord } from '@prisma/client';
import { Context } from '@temporalio/activity';
import { now } from 'lodash';
import md5 from 'md5';
import WeaviateClient from '../clients/weaviate.client';
import activityService from '../services/activity.service';
import recordService from '../services/record.service';
import { LogLevel, Resource, SyncRunType } from '../utils/enums';
import { generateId } from '../utils/helpers';
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

  public async batchSave<T extends { [key: string]: unknown }>(
    objects: T[],
    options?: { metadata_collection_key?: string }
  ): Promise<boolean> {
    if (!objects || objects.length === 0) {
      return true;
    }

    const isMetaCollection = options && options.metadata_collection_key;

    if (!isMetaCollection) {
      const records: DataRecord[] = objects.map((obj: any) => {
        const hash = md5(JSON.stringify(obj));
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

      if (batchSaveResult) {
        const { addedKeys, updatedKeys } = batchSaveResult;
        this.addedKeys.push(...addedKeys);
        this.updatedKeys.push(...updatedKeys);
      } else {
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
      }
    }

    const weaviate = WeaviateClient.getInstance();
    const didSave = await weaviate.batchSave<T>(this.linkedAccountId, this.collectionKey, objects, {
      metadataCollectionKey: isMetaCollection ? options.metadata_collection_key : undefined,
    });

    if (!didSave) {
      await activityService.createActivityLog(this.activityId, {
        level: LogLevel.Error,
        timestamp: now(),
        message: `Failed to batch save vectors for collection ${this.collectionKey}`,
        payload: {
          linked_account: this.linkedAccountId,
          integration: this.integrationKey,
          collection: this.collectionKey,
          batch_count: objects.length,
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

    if (result) {
      const { deletedKeys } = result;
      this.deletedKeys.push(...deletedKeys);
      return true;
    }

    return false;
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
