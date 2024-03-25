import { Context } from '@temporalio/activity';
import { BaseContext, BaseContextOptions } from './base.context';

export type SyncContextOptions = BaseContextOptions & {
  collectionKey: string;
  multimodalEnabled: boolean;
  syncRunId: string;
  lastSyncedAt: number | null;
  syncType: 'initial' | 'incremental';
  temporalContext: Context;
};

export class SyncContext extends BaseContext {
  public collectionKey: string;
  public multimodalEnabled: boolean;
  public syncRunId: string;
  public lastSyncedAt: number | null;
  public syncType: 'initial' | 'incremental';

  private batchSize = 1000;
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
    this.syncType = options.syncType;
    this.addedKeys = [];
    this.updatedKeys = [];
    this.deletedKeys = [];

    const temporal = options.temporalContext;
    const heartbeat = 1000 * 60 * 5;
    this.interval = setInterval(() => {
      temporal.heartbeat();
    }, heartbeat);
  }

  public async batchSave<T = any>(results: T[], model: string): Promise<boolean | null> {
    if (!results || results.length === 0) {
      return true;
    }

    // format data
    // save data
    // update keys

    return true;
  }

  public async reportResults() {
    return {
      records_added: this.addedKeys.length,
      records_updated: this.updatedKeys.length,
      records_deleted: this.deletedKeys.length,
    };
  }

  public async finish() {
    clearInterval(this.interval);
    this.interval = undefined;
  }
}
