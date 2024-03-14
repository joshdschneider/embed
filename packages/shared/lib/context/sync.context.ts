import { Context } from '@temporalio/activity';
import { BaseContext, BaseContextOptions } from './base.context';

export type SyncContextOptions = BaseContextOptions & {
  syncId: string;
  jobId: string;
  activityId: string | null;
  lastSyncDate: Date | null;
  context: Context;
};

export class SyncContext extends BaseContext {
  public syncId: string;
  public jobId: string;
  public activityId: string | null;
  public lastSyncDate: Date | null;

  private batchSize = 1000;
  private addedKeys: string[];
  private updatedKeys: string[];
  private deletedKeys: string[];
  private interval?: NodeJS.Timeout;

  constructor(options: SyncContextOptions) {
    super(options);
    this.syncId = options.syncId;
    this.jobId = options.jobId;
    this.activityId = options.activityId;
    this.lastSyncDate = options.lastSyncDate;
    this.addedKeys = [];
    this.updatedKeys = [];
    this.deletedKeys = [];

    const temporal = options.context;
    const heartbeat = 1000 * 60 * 5;
    this.interval = setInterval(() => {
      temporal.heartbeat();
    }, heartbeat);
  }

  public async processFile() {
    //..
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

  public async finish() {
    clearInterval(this.interval);
    this.interval = undefined;
  }
}
