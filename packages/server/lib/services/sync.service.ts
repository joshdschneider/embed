import type { Sync, SyncJob, SyncSchedule } from '@kit/shared';
import { database } from '@kit/shared';
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
}

export default new SyncService();
