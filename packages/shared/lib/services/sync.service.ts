import { Collection, Sync, SyncRun, SyncSchedule } from '@prisma/client';
import { StringValue } from 'ms';
import TemporalClient from '../clients/temporal.client';
import { database } from '../utils/database';
import {
  LogAction,
  LogLevel,
  Resource,
  SyncRunStatus,
  SyncRunType,
  SyncStatus,
} from '../utils/enums';
import { generateId, getFrequencyInterval, now } from '../utils/helpers';
import activityService from './activity.service';
import errorService from './error.service';

class SyncService {
  public async initializeSync({
    linkedAccountId,
    collection,
    activityId,
  }: {
    linkedAccountId: string;
    collection: Collection;
    activityId: string;
  }): Promise<void> {
    try {
      const sync = await this.createSync({
        linked_account_id: linkedAccountId,
        environment_id: collection.environment_id,
        integration_key: collection.integration_key,
        collection_key: collection.unique_key,
        status: SyncStatus.Stopped,
        frequency: collection.default_sync_frequency,
        last_synced_at: null,
        created_at: now(),
        updated_at: now(),
        deleted_at: null,
      });

      if (!sync) {
        throw new Error('Failed to create sync in database');
      }

      if (!collection.is_enabled) {
        return;
      }

      if (collection.auto_start_sync) {
        await this.startSync(sync);
      }
    } catch (err) {
      await errorService.reportError(err);

      await activityService.createActivityLog(activityId, {
        level: LogLevel.Error,
        message: 'Failed to initialize sync',
        timestamp: now(),
        payload: {
          linked_account: linkedAccountId,
          integration: collection.integration_key,
          collection: collection.unique_key,
        },
      });
    }
  }

  public async startSync(sync: Sync) {
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
      const temporal = await TemporalClient.getInstance();
      if (!temporal) {
        throw new Error('Failed to get Temporal client instance');
      }

      const syncRuns = await this.listSyncRuns(sync.linked_account_id, sync.collection_key);
      if (!syncRuns) {
        throw new Error('Failed to retrieve sync runs from database');
      }

      const initialSyncRun = syncRuns.find((run) => run.type === SyncRunType.Initial);

      if (
        !initialSyncRun ||
        initialSyncRun.status === SyncRunStatus.Failed ||
        initialSyncRun.status === SyncRunStatus.Stopped
      ) {
        const newSyncRun = await this.createSyncRun({
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

        if (!newSyncRun) {
          throw new Error('Failed to create sync run in the database');
        }

        const temporalRunId = await temporal.startInitialSync(newSyncRun.id, {
          environmentId: sync.environment_id,
          integrationKey: sync.integration_key,
          linkedAccountId: sync.linked_account_id,
          collectionKey: sync.collection_key,
          syncRunId: newSyncRun.id,
          activityId,
        });

        if (!temporalRunId) {
          await this.updateSyncRun(newSyncRun.id, { status: SyncRunStatus.Failed });
          throw new Error('Failed to start initial sync in Temporal');
        } else {
          await this.updateSyncRun(newSyncRun.id, { temporal_run_id: temporalRunId });
        }

        await activityService.createActivityLog(activityId, {
          level: LogLevel.Info,
          message: 'Running initial sync',
          timestamp: now(),
          payload: {
            integration: sync.integration_key,
            linked_account: sync.linked_account_id,
            collection: sync.collection_key,
          },
        });
      } else if (initialSyncRun.status === SyncRunStatus.Running) {
        throw new Error('Initial sync is still running');
      }

      const syncSchedule = await this.getSyncSchedule(sync.linked_account_id, sync.collection_key);
      if (!syncSchedule) {
        const { interval, offset, error } = getFrequencyInterval(
          sync.frequency as StringValue,
          new Date()
        );

        if (error !== null) {
          throw new Error(error);
        }

        const scheduleHandle = await temporal.createSyncSchedule(
          generateId(Resource.SyncSchedule),
          interval,
          offset,
          {
            environmentId: sync.environment_id,
            linkedAccountId: sync.environment_id,
            integrationKey: sync.integration_key,
            collectionKey: sync.collection_key,
          }
        );

        if (!scheduleHandle) {
          throw new Error('Failed to create sync schedule in Temporal');
        }

        await activityService.createActivityLog(activityId, {
          level: LogLevel.Info,
          message: 'Sync schedule created',
          timestamp: now(),
          payload: {
            integration: sync.integration_key,
            linked_account: sync.linked_account_id,
            collection: sync.collection_key,
            frequency: interval,
          },
        });
      } else {
        const scheduleHandle = await temporal.getSyncSchedule(syncSchedule.id);
        if (!scheduleHandle) {
          throw new Error('Failed to get sync schedule in Temporal');
        }

        const description = await scheduleHandle.describe();
        const schedulePaused = description.state.paused;
        if (schedulePaused) {
          await scheduleHandle.unpause();

          await activityService.createActivityLog(activityId, {
            level: LogLevel.Info,
            message: 'Sync schedule started',
            timestamp: now(),
            payload: {
              integration: sync.integration_key,
              linked_account: sync.linked_account_id,
              collection: sync.collection_key,
            },
          });
        }
      }
    } catch (err) {
      await errorService.reportError(err);

      await activityService.createActivityLog(activityId, {
        level: LogLevel.Error,
        message: 'Failed to start sync',
        timestamp: now(),
        payload: {
          integration: sync.integration_key,
          linked_account: sync.linked_account_id,
          collection: sync.collection_key,
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

  public async createSync(sync: Sync): Promise<Sync | null> {
    try {
      return await database.sync.create({ data: sync });
    } catch (err) {
      await errorService.reportError(err);
      return null;
    }
  }

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

  public async getSyncSchedule(
    linkedAccountId: string,
    collectionKey: string
  ): Promise<SyncSchedule | null> {
    try {
      return await database.syncSchedule.findFirst({
        where: {
          linked_account_id: linkedAccountId,
          collection_key: collectionKey,
          deleted_at: null,
        },
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
