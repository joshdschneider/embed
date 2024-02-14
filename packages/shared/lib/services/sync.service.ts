import { Sync, SyncJob, SyncSchedule } from '@prisma/client';
import { Context } from '@temporalio/activity';
import { SyncContext } from '../context/sync.context';
import { database } from '../utils/database';
import { SyncType } from '../utils/enums';
import { unixToDate } from '../utils/helpers';
import apiKeyService from './apiKey.service';
import errorService from './error.service';

class SyncService {
  public async getSyncById(syncId: string): Promise<Sync | null> {
    try {
      return await database.sync.findUnique({
        where: { id: syncId, deleted_at: null },
      });
    } catch (err) {
      await errorService.reportError(err);
      return null;
    }
  }

  public async createSync(sync: Sync): Promise<Sync | null> {
    try {
      const existingSync = await database.sync.findUnique({
        where: {
          model_id_linked_account_id: {
            model_id: sync.model_id,
            linked_account_id: sync.linked_account_id,
          },
          deleted_at: null,
        },
      });

      if (existingSync) {
        return existingSync;
      }

      return await database.sync.create({ data: sync });
    } catch (err) {
      await errorService.reportError(err);
      return null;
    }
  }

  public async createSyncJob(syncJob: SyncJob): Promise<SyncJob | null> {
    try {
      return await database.syncJob.create({ data: syncJob });
    } catch (err) {
      await errorService.reportError(err);
      return null;
    }
  }

  public async updateSyncJob(syncJobId: string, data: Partial<SyncJob>): Promise<SyncJob | null> {
    try {
      return await database.syncJob.update({
        where: { id: syncJobId },
        data,
      });
    } catch (err) {
      await errorService.reportError(err);
      return null;
    }
  }

  public async createSyncSchedule(syncSchedule: SyncSchedule): Promise<SyncSchedule | null> {
    try {
      return await database.syncSchedule.create({ data: syncSchedule });
    } catch (err) {
      await errorService.reportError(err);
      return null;
    }
  }

  public async runSync({
    type,
    environmentId,
    linkedAccountId,
    integration,
    syncId,
    jobId,
    activityId,
    context,
  }: {
    type: SyncType;
    environmentId: string;
    linkedAccountId: string;
    integration: string;
    syncId: string;
    jobId: string;
    activityId: string | null;
    context: Context;
  }) {
    const apiKeys = await apiKeyService.listApiKeys(environmentId);
    if (!apiKeys || apiKeys.length === 0 || !apiKeys[0]) {
      throw new Error('No API keys found in environment');
    }

    const sync = await this.getSyncById(syncId);
    if (!sync) {
      throw new Error(`Failed to get sync ${syncId}`);
    }

    const apiKey = apiKeys[0].key;
    const lastSyncDate = sync.last_synced_at ? unixToDate(sync.last_synced_at) : null;

    const kit = new SyncContext({
      apiKey,
      integration,
      linkedAccountId,
      lastSyncDate,
    });

    //  await providerService.

    // call sync model on provider registry
    // pass in kit and model
  }

  public async reportSyncResults(syncResults: any) {
    return true;
  }
}

export default new SyncService();
