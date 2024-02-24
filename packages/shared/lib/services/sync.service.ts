import { SyncSchedule } from '@prisma/client';
import { database } from '../utils/database';
import { now } from '../utils/helpers';
import errorService from './error.service';

class SyncService {
  // public async getSyncById(syncId: string): Promise<(Sync & { model_name: string }) | null> {
  //   try {
  //     const sync = await database.sync.findUnique({
  //       where: { id: syncId, deleted_at: null },
  //       include: { model: { select: { name: true } } },
  //     });

  //     if (!sync) {
  //       return null;
  //     } else {
  //       const { model, ...rest } = sync;
  //       return { ...rest, model_name: model.name };
  //     }
  //   } catch (err) {
  //     await errorService.reportError(err);
  //     return null;
  //   }
  // }

  // public async getSyncByModelId(
  //   modelId: string,
  //   linkedAccountId: string
  // ): Promise<(Sync & { model_name: string }) | null> {
  //   try {
  //     const sync = await database.sync.findUnique({
  //       where: {
  //         model_id_linked_account_id: {
  //           model_id: modelId,
  //           linked_account_id: linkedAccountId,
  //         },
  //         deleted_at: null,
  //       },
  //       include: { model: { select: { name: true } } },
  //     });

  //     if (!sync) {
  //       return null;
  //     } else {
  //       const { model, ...rest } = sync;
  //       return { ...rest, model_name: model.name };
  //     }
  //   } catch (err) {
  //     await errorService.reportError(err);
  //     return null;
  //   }
  // }

  // public async createSync(sync: Sync): Promise<Sync | null> {
  //   try {
  //     const existingSync = await database.sync.findUnique({
  //       where: {
  //         model_id_linked_account_id: {
  //           model_id: sync.model_id,
  //           linked_account_id: sync.linked_account_id,
  //         },
  //         deleted_at: null,
  //       },
  //     });

  //     if (existingSync) {
  //       return existingSync;
  //     }

  //     return await database.sync.create({ data: sync });
  //   } catch (err) {
  //     await errorService.reportError(err);
  //     return null;
  //   }
  // }

  // public async createSyncJob(syncJob: SyncJob): Promise<SyncJob | null> {
  //   try {
  //     return await database.syncJob.create({ data: syncJob });
  //   } catch (err) {
  //     await errorService.reportError(err);
  //     return null;
  //   }
  // }

  // public async updateSyncJob(syncJobId: string, data: Partial<SyncJob>): Promise<SyncJob | null> {
  //   try {
  //     const { id, sync_id, created_at, deleted_at, ...rest } = data;
  //     return await database.syncJob.update({
  //       where: { id: syncJobId },
  //       data: { ...rest, updated_at: now() },
  //     });
  //   } catch (err) {
  //     await errorService.reportError(err);
  //     return null;
  //   }
  // }

  // public async getSyncJobById(syncJobId: string): Promise<SyncJob | null> {
  //   try {
  //     return await database.syncJob.findUnique({
  //       where: { id: syncJobId, deleted_at: null },
  //     });
  //   } catch (err) {
  //     await errorService.reportError(err);
  //     return null;
  //   }
  // }

  // public async listSyncJobs(syncId: string): Promise<SyncJob[] | null> {
  //   try {
  //     return await database.syncJob.findMany({
  //       where: { sync_id: syncId, deleted_at: null },
  //     });
  //   } catch (err) {
  //     await errorService.reportError(err);
  //     return null;
  //   }
  // }

  public async createSyncSchedule(syncSchedule: SyncSchedule): Promise<SyncSchedule | null> {
    try {
      return await database.syncSchedule.create({ data: syncSchedule });
    } catch (err) {
      await errorService.reportError(err);
      return null;
    }
  }

  public async updateSyncSchedule(
    syncScheduleId: string,
    { status, frequency, offset }: Partial<SyncSchedule>
  ): Promise<SyncSchedule | null> {
    try {
      return await database.syncSchedule.update({
        where: { id: syncScheduleId },
        data: { status, frequency, offset, updated_at: now() },
      });
    } catch (err) {
      await errorService.reportError(err);
      return null;
    }
  }

  public async getSyncScheduleById(syncScheduleId: string): Promise<SyncSchedule | null> {
    try {
      return await database.syncSchedule.findUnique({
        where: { id: syncScheduleId, deleted_at: null },
      });
    } catch (err) {
      await errorService.reportError(err);
      return null;
    }
  }

  // public async listSyncSchedules(syncId: string): Promise<SyncSchedule[] | null> {
  //   try {
  //     return await database.syncSchedule.findMany({
  //       where: { sync_id: syncId, deleted_at: null },
  //     });
  //   } catch (err) {
  //     await errorService.reportError(err);
  //     return null;
  //   }
  // }

  // public async runSync({
  //   type,
  //   environmentId,
  //   linkedAccountId,
  //   integration,
  //   syncId,
  //   jobId,
  //   activityId,
  //   context,
  // }: {
  //   type: SyncType;
  //   environmentId: string;
  //   linkedAccountId: string;
  //   integration: string;
  //   syncId: string;
  //   jobId: string;
  //   activityId: string | null;
  //   context: Context;
  // }) {
  //   const sync = await this.getSyncById(syncId);
  //   if (!sync) {
  //     const err = new Error(`Sync failed: Failed to fetch sync by ID ${syncId}`);
  //     await errorService.reportError(err);

  //     await activityService.createActivityLog(activityId, {
  //       message: err.message,
  //       level: LogLevel.Error,
  //       timestamp: now(),
  //       payload: { environmentId, linkedAccountId, integration, syncId, jobId, context },
  //     });

  //     return false;
  //   }

  //   const lastSyncDate = sync.last_synced_at ? unixToDate(sync.last_synced_at) : null;

  //   const syncContext = new SyncContext({
  //     integration,
  //     linkedAccountId,
  //     lastSyncDate,
  //     syncId,
  //     jobId,
  //     activityId,
  //     context,
  //   });

  //   await providerService.syncProviderModel(integration, sync.model_name, syncContext);

  //   const results = await syncContext.finish();
  //   // Update sync job
  //   // Send webhook
  //   return true;
  // }
}

export default new SyncService();
