import { Sync, SyncRun, SyncSchedule } from '@prisma/client';
import { StringValue } from 'ms';
import TemporalClient from '../clients/temporal.client';
import { database } from '../utils/database';
import {
  LogAction,
  LogLevel,
  Resource,
  SyncRunStatus,
  SyncRunType,
  SyncScheduleStatus,
  SyncStatus,
} from '../utils/enums';
import { generateId, getFrequencyInterval, now } from '../utils/helpers';
import activityService from './activity.service';
import errorService from './error.service';

class SyncService {
  public async initializeSync(sync: Sync, autoStart: boolean, activityId: string): Promise<void> {
    try {
      const { interval, offset, error } = getFrequencyInterval(
        sync.frequency as StringValue,
        new Date()
      );

      if (error !== null) {
        throw new Error('Failed to initialize sync because of an invalid frequency');
      }

      const temporal = await TemporalClient.getInstance();

      if (autoStart) {
        await this.startSync(sync);
      }

      const scheduleId = generateId(Resource.SyncSchedule);

      const syncScheduleCreated = await temporal.createSyncSchedule(
        scheduleId,
        interval,
        offset,
        autoStart,
        {
          environmentId: sync.environment_id,
          linkedAccountId: sync.environment_id,
          integrationKey: sync.integration_key,
          collectionKey: sync.collection_key,
        }
      );

      if (!syncScheduleCreated) {
        throw new Error('Failed to create sync schedule in temporal during sync initialization');
      }

      const syncStatus = autoStart ? SyncScheduleStatus.Running : SyncScheduleStatus.Stopped;

      const syncSchedule = await this.createSyncSchedule({
        id: scheduleId,
        linked_account_id: sync.linked_account_id,
        collection_key: sync.collection_key,
        status: syncStatus,
        frequency: interval,
        offset: offset,
        created_at: now(),
        updated_at: now(),
        deleted_at: null,
      });

      if (!syncSchedule) {
        throw new Error('Failed to create sync schedule in the database');
      }

      await activityService.createActivityLog(activityId, {
        level: LogLevel.Info,
        message: 'Sync schedule created',
        timestamp: now(),
        payload: {
          linked_account_id: sync.linked_account_id,
          integration_key: sync.integration_key,
          collection_key: sync.collection_key,
          status: syncStatus,
          frequency: interval,
        },
      });
    } catch (err) {
      await errorService.reportError(err);

      await activityService.createActivityLog(activityId, {
        level: LogLevel.Error,
        message: 'Failed to initialize sync',
        timestamp: now(),
        payload: {
          integrationKey: sync.integration_key,
          linkedAccountId: sync.linked_account_id,
          collectionKey: sync.collection_key,
        },
      });
    }
  }

  public async startSync(sync: Sync) {
    try {
      // * - initial sync doesnt exist? Create and start initial sync
      // * - initial sync never finished? Start initial sync
      // * - initial sync done? Start and trigger schedule
    } catch (err) {
      //..
    }

    const activityId = await activityService.createActivity({
      id: generateId(Resource.Activity),
      environment_id: sync.environment_id,
      integration_key: sync.integration_key,
      linked_account_id: sync.linked_account_id,
      collection_key: sync.collection_key,
      link_token_id: null,
      action_key: null,
      level: LogLevel.Info,
      action: LogAction.Sync,
      timestamp: now(),
    });

    try {
      const syncRun = await this.createSyncRun({
        id: generateId(Resource.SyncRun),
        linked_account_id: sync.linked_account_id,
        collection_key: sync.collection_key,
        temporal_run_id: null,
        status: SyncRunStatus.Running,
        type: SyncRunType.Initial,
        records_added: null,
        records_updated: null,
        records_deleted: null,
        created_at: now(),
        updated_at: now(),
      });

      if (!syncRun) {
        throw new Error('Failed to create sync run in the database');
      }

      const temporal = await TemporalClient.getInstance();

      const temporalRunId = await temporal.startInitialSync(syncRun.id, {
        environmentId: sync.environment_id,
        integrationKey: sync.integration_key,
        linkedAccountId: sync.linked_account_id,
        collectionKey: sync.collection_key,
        syncRunId: syncRun.id,
        activityId: activityId,
      });

      if (!temporalRunId) {
        await this.updateSyncRun(syncRun.id, {
          status: SyncRunStatus.Failed,
        });

        throw new Error('Failed to start initial sync in temporal');
      } else {
        await this.updateSyncRun(syncRun.id, {
          temporal_run_id: temporalRunId,
        });
      }
    } catch (err) {
      await errorService.reportError(err);

      await activityService.createActivityLog(activityId, {
        level: LogLevel.Error,
        message: 'Failed to start sync',
        timestamp: now(),
        payload: {
          integrationKey: sync.integration_key,
          linkedAccountId: sync.linked_account_id,
          collectionKey: sync.collection_key,
        },
      });
    }
  }

  public async listSyncs(linkedAccountId: string): Promise<Sync[] | null> {
    try {
      return await database.sync.findMany({
        where: { linked_account_id: linkedAccountId, deleted_at: null },
      });
    } catch (err) {
      await errorService.reportError(err);
      return null;
    }
  }

  public async retrieveSync(linkedAccountId: string, collectionKey: string): Promise<Sync | null> {
    try {
      return await database.sync.findUnique({
        where: {
          collection_key_linked_account_id: {
            linked_account_id: linkedAccountId,
            collection_key: collectionKey,
          },
          deleted_at: null,
        },
      });
    } catch (err) {
      await errorService.reportError(err);
      return null;
    }
  }

  public async updateSync(
    linkedAccountId: string,
    collectionKey: string,
    data: Partial<Sync>
  ): Promise<Sync | null> {
    try {
      return await database.sync.update({
        where: {
          collection_key_linked_account_id: {
            linked_account_id: linkedAccountId,
            collection_key: collectionKey,
          },
          deleted_at: null,
        },
        data: { ...data, updated_at: now() },
      });
    } catch (err) {
      await errorService.reportError(err);
      return null;
    }
  }

  // public async startSync(linkedAccountId: string, collectionKey: string): Promise<Sync | null> {
  //   try {
  //     /**
  //      * Handle start
  //      */

  //     return await database.sync.update({
  //       where: {
  //         collection_key_linked_account_id: {
  //           linked_account_id: linkedAccountId,
  //           collection_key: collectionKey,
  //         },
  //         deleted_at: null,
  //       },
  //       data: {
  //         status: SyncStatus.Running,
  //         last_synced_at: now(), // ??
  //         updated_at: now(),
  //       },
  //     });
  //   } catch (err) {
  //     await errorService.reportError(err);
  //     return null;
  //   }
  // }

  public async stopSync(linkedAccountId: string, collectionKey: string): Promise<Sync | null> {
    try {
      return await database.sync.update({
        where: {
          collection_key_linked_account_id: {
            linked_account_id: linkedAccountId,
            collection_key: collectionKey,
          },
          deleted_at: null,
        },
        data: { status: SyncStatus.Stopped, updated_at: now() },
      });
    } catch (err) {
      await errorService.reportError(err);
      return null;
    }
  }

  public async triggerSync(linkedAccountId: string, collectionKey: string): Promise<Sync | null> {
    try {
      return await database.sync.update({
        where: {
          collection_key_linked_account_id: {
            linked_account_id: linkedAccountId,
            collection_key: collectionKey,
          },
          deleted_at: null,
        },
        data: { last_synced_at: now(), updated_at: now() },
      });
    } catch (err) {
      await errorService.reportError(err);
      return null;
    }
  }

  public async listSyncRuns(
    linkedAccountId: string,
    collectionKey: string
  ): Promise<(SyncRun & { integration_key: string })[] | null> {
    try {
      const syncRuns = await database.syncRun.findMany({
        where: {
          linked_account_id: linkedAccountId,
          collection_key: collectionKey,
        },
        include: { linked_account: { select: { integration_key: true } } },
      });

      if (!syncRuns) {
        return null;
      }

      return syncRuns.map((run) => {
        const { linked_account, ...rest } = run;
        return { ...rest, integration_key: linked_account.integration_key };
      });
    } catch (err) {
      await errorService.reportError(err);
      return null;
    }
  }

  public async retrieveSyncRun(
    syncRunId: string
  ): Promise<(SyncRun & { integration_key: string }) | null> {
    try {
      const syncRun = await database.syncRun.findUnique({
        where: { id: syncRunId },
        include: { linked_account: { select: { integration_key: true } } },
      });

      if (!syncRun) {
        return null;
      }

      const { linked_account, ...rest } = syncRun;
      return { ...rest, integration_key: linked_account.integration_key };
    } catch (err) {
      await errorService.reportError(err);
      return null;
    }
  }

  public async createSyncRun(syncRun: SyncRun): Promise<SyncRun | null> {
    try {
      return await database.syncRun.create({
        data: syncRun,
      });
    } catch (err) {
      await errorService.reportError(err);
      return null;
    }
  }

  public async updateSyncRun(syncRunId: string, data: Partial<SyncRun>): Promise<SyncRun | null> {
    try {
      return await database.syncRun.update({ where: { id: syncRunId }, data });
    } catch (err) {
      await errorService.reportError(err);
      return null;
    }
  }

  public async createSyncSchedule(syncSchedule: SyncSchedule): Promise<SyncSchedule | null> {
    try {
      return await database.syncSchedule.create({
        data: syncSchedule,
      });
    } catch (err) {
      await errorService.reportError(err);
      return null;
    }
  }

  public async updateSyncSchedule(
    syncScheduleId: string,
    data: Partial<SyncSchedule>
  ): Promise<SyncSchedule | null> {
    try {
      return await database.syncSchedule.update({
        where: { id: syncScheduleId, deleted_at: null },
        data: { ...data, updated_at: now() },
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
}

export default new SyncService();
