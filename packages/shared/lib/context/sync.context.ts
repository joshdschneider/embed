import { FileProcessor, SourceObject } from '@embed/providers';
import { Record as DataRecord } from '@prisma/client';
import { Context } from '@temporalio/activity';
import md5 from 'md5';
import ElasticClient from '../clients/elastic.client';
import activityService from '../services/activity.service';
import collectionService from '../services/collection.service';
import ingestService from '../services/ingest.service';
import providerService from '../services/provider.service';
import recordService from '../services/record.service';
import usageService from '../services/usage.service';
import { LogLevel, Resource, UsageType } from '../utils/enums';
import { generateId, now } from '../utils/helpers';
import { BaseContext, BaseContextOptions } from './base.context';

export type SyncContextOptions = BaseContextOptions & {
  providerKey: string;
  collectionKey: string;
  syncRunId: string;
  lastSyncedAt: number | null;
  temporalContext: Context;
};

export class SyncContext extends BaseContext {
  public providerKey: string;
  public collectionKey: string;
  public syncRunId: string;
  public lastSyncedAt: number | null;
  private addedKeys: string[];
  private updatedKeys: string[];
  private deletedKeys: string[];
  private syncedWords: number;
  private syncedImages: number;
  private syncedAudioSeconds: number;
  private syncedVideoSeconds: number;
  public processor: FileProcessor;
  private interval?: NodeJS.Timeout;

  constructor(options: SyncContextOptions) {
    super(options);
    this.providerKey = options.providerKey;
    this.collectionKey = options.collectionKey;
    this.syncRunId = options.syncRunId;
    this.activityId = options.activityId;
    this.lastSyncedAt = options.lastSyncedAt;
    this.addedKeys = [];
    this.updatedKeys = [];
    this.deletedKeys = [];
    this.syncedWords = 0;
    this.syncedImages = 0;
    this.syncedAudioSeconds = 0;
    this.syncedVideoSeconds = 0;
    this.processor = this.mountFileProcessor();
    const temporal = options.temporalContext;
    const heartbeat = 1000 * 60 * 5;
    this.interval = setInterval(() => {
      temporal.heartbeat();
    }, heartbeat);
  }

  private mountFileProcessor() {
    return {
      processText: ingestService.processText,
      processJson: ingestService.processJson,
      processPdf: ingestService.processPdf,
      processDocx: ingestService.processDocx,
      processPptx: ingestService.processPptx,
      processImage: ingestService.processImage,
      processAudio: async (buffer: Buffer) => {
        const { chunks, duration } = await ingestService.processAudio(buffer);
        this.syncedAudioSeconds += duration;
        return chunks;
      },
      processVideo: async (buffer: Buffer) => {
        const { chunks, duration } = await ingestService.processVideo(buffer);
        this.syncedVideoSeconds += duration;
        return chunks;
      },
    };
  }

  public async batchSave(objects: SourceObject[]): Promise<boolean> {
    if (!objects || objects.length === 0) {
      return true;
    }

    try {
      const collection = await providerService.getProviderCollection(
        this.providerKey,
        this.collectionKey
      );

      if (!collection) {
        throw new Error(`Failed to get collection schema for ${this.collectionKey}`);
      }

      const records: DataRecord[] = objects.map((originalObj) => {
        const obj = { ...originalObj };
        const hash = md5(JSON.stringify(obj));

        return {
          id: generateId(Resource.Record),
          external_id: obj.id,
          environment_id: this.environmentId,
          connection_id: this.connectionId,
          integration_id: this.integrationId,
          collection_key: this.collectionKey,
          hash,
          created_at: now(),
          updated_at: now(),
          deleted_at: null,
        };
      });

      const batchSaveResult = await recordService.batchSave({
        integrationId: this.integrationId,
        connectionId: this.connectionId,
        collectionKey: this.collectionKey,
        records,
      });

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

      const collectionModelSettings = await collectionService.getCollectionModelSettings({
        environmentId: this.environmentId,
        integrationId: this.integrationId,
        collectionKey: this.collectionKey,
      });

      if (!collectionModelSettings) {
        throw new Error(`Failed to get collection model settings for ${this.collectionKey}`);
      }

      const { textEmbeddingModel, multimodalEmbeddingModel } = collectionModelSettings;
      const objectsToCreate = objects.filter((obj) => addedKeys.includes(obj.id));
      const hashedObjectsToCreate = ingestService.hashSourceObjects({
        objects: objectsToCreate,
        schemaProperties: collection.schema.properties,
      });

      const vectorizedObjectsToCreate = await ingestService.vectorizeSourceObjects({
        objects: hashedObjectsToCreate,
        schemaProperties: collection.schema.properties,
        textEmbeddingModel,
        multimodalEmbeddingModel,
      });

      this.syncedWords += vectorizedObjectsToCreate.wordCount;
      this.syncedImages += vectorizedObjectsToCreate.imageCount;

      const elastic = ElasticClient.getInstance();
      const didCreate = await elastic.batchUpsertObjects({
        environmentId: this.environmentId,
        collectionKey: this.collectionKey,
        integrationId: this.integrationId,
        connectionId: this.connectionId,
        objects: vectorizedObjectsToCreate.objects,
      });

      if (!didCreate) {
        await activityService.createActivityLog(this.activityId, {
          level: LogLevel.Error,
          message: `Failed to create ${addedKeys.length} objects`,
          timestamp: now(),
          payload: { error: 'Internal server error' },
        });

        await recordService.deleteRecordsByIds({
          integrationId: this.integrationId,
          connectionId: this.connectionId,
          collectionKey: this.collectionKey,
          externalIds: addedKeys,
        });

        this.addedKeys = this.addedKeys.filter((key) => !addedKeys.includes(key));
      }

      const objectsToUpdate = objects.filter((obj) => updatedKeys.includes(obj.id));
      const hashedObjectsToUpdate = ingestService.hashSourceObjects({
        objects: objectsToUpdate,
        schemaProperties: collection.schema.properties,
      });

      const vectorizedObjectsToUpdate = await ingestService.vectorizeSourceObjects({
        objects: hashedObjectsToUpdate,
        schemaProperties: collection.schema.properties,
        textEmbeddingModel,
        multimodalEmbeddingModel,
      });

      this.syncedWords += vectorizedObjectsToUpdate.wordCount;
      this.syncedImages += vectorizedObjectsToUpdate.imageCount;

      const didUpdate = await elastic.updateObjects({
        environmentId: this.environmentId,
        collectionKey: this.collectionKey,
        integrationId: this.integrationId,
        providerKey: this.providerKey,
        connectionId: this.connectionId,
        objects: vectorizedObjectsToUpdate.objects,
      });

      if (!didUpdate) {
        await activityService.createActivityLog(this.activityId, {
          level: LogLevel.Error,
          message: `Failed to update ${updatedKeys.length} objects`,
          timestamp: now(),
          payload: { error: 'Internal server error' },
        });

        await recordService.deleteRecordsByIds({
          integrationId: this.integrationId,
          connectionId: this.connectionId,
          collectionKey: this.collectionKey,
          externalIds: updatedKeys,
        });

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
      const result = await recordService.pruneDeleted({
        integrationId: this.integrationId,
        connectionId: this.connectionId,
        collectionKey: this.collectionKey,
        crawledExternalIds: allIds,
      });

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
          environmentId: this.environmentId,
          integrationId: this.integrationId,
          collectionKey: this.collectionKey,
          connectionId: this.connectionId,
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
    usage_words: number;
    usage_images: number;
    usage_audio_seconds: number;
    usage_video_seconds: number;
  }> {
    usageService.reportUsage({
      usageType: UsageType.Sync,
      environmentId: this.environmentId,
      integrationId: this.integrationId,
      connectionId: this.connectionId,
      syncedWords: this.syncedWords,
      syncedImages: this.syncedImages,
      syncedAudioSeconds: this.syncedAudioSeconds,
      syncedVideoSeconds: this.syncedVideoSeconds,
      syncRunId: this.syncRunId,
    });

    return {
      records_added: this.addedKeys.length,
      records_updated: this.updatedKeys.length,
      records_deleted: this.deletedKeys.length,
      usage_words: this.syncedWords,
      usage_images: this.syncedImages,
      usage_audio_seconds: this.syncedAudioSeconds,
      usage_video_seconds: this.syncedVideoSeconds,
    };
  }

  public finish(): boolean {
    clearInterval(this.interval);
    this.interval = undefined;
    return true;
  }
}
