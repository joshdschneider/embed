import { Collection, Sync, SyncRun, SyncSchedule } from '@prisma/client';
import { StringValue } from 'ms';
import ElasticClient from '../clients/elastic.client';
import TemporalClient from '../clients/temporal.client';
import { database } from '../utils/database';
import {
  LogAction,
  LogLevel,
  Resource,
  SyncRunStatus,
  SyncScheduleStatus,
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
    activityId: string | null;
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

      const syncSchedule = await this.createSyncSchedule(sync);
      if (!syncSchedule) {
        throw new Error('Failed to create sync schedule');
      }

      if (!collection.is_enabled || !collection.auto_start_sync) {
        return;
      }

      const newActivityId = await activityService.createActivity({
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

      await this.startSync(sync, newActivityId);
    } catch (err) {
      await errorService.reportError(err);

      await activityService.createActivityLog(activityId, {
        level: LogLevel.Error,
        message: 'Failed to initialize sync due to an internal error',
        timestamp: now(),
        payload: {
          linked_account: linkedAccountId,
          integration: collection.integration_key,
          collection: collection.unique_key,
        },
      });
    }
  }

  public async startSync(sync: Sync, activityId: string | null): Promise<Sync | null> {
    try {
      const syncSchedule = await this.unpauseSchedule(sync.linked_account_id, sync.collection_key);
      if (!syncSchedule) {
        throw new Error('Failed to unpause sync schedule');
      }

      const updatedSync = await this.updateSync(sync.linked_account_id, sync.collection_key, {
        status: SyncStatus.Running,
      });

      await activityService.createActivityLog(activityId, {
        level: LogLevel.Info,
        message: 'Sync started',
        timestamp: now(),
        payload: {
          linked_account: sync.linked_account_id,
          integration: sync.integration_key,
          collection: sync.collection_key,
        },
      });

      return updatedSync;
    } catch (err) {
      await errorService.reportError(err);

      await activityService.createActivityLog(activityId, {
        level: LogLevel.Error,
        message: 'Failed to start sync due to an internal error',
        timestamp: now(),
        payload: {
          linked_account: sync.linked_account_id,
          integration: sync.integration_key,
          collection: sync.collection_key,
        },
      });

      return null;
    }
  }

  public async stopSync(sync: Sync, activityId: string | null): Promise<Sync | null> {
    try {
      const syncRuns = await this.listSyncRuns(sync.linked_account_id, sync.collection_key);
      if (!syncRuns) {
        throw new Error('Failed to get sync runs');
      }

      const runningSyncRuns = syncRuns.filter((run) => run.status === SyncRunStatus.Running);
      if (runningSyncRuns.length > 0) {
        for (const run of runningSyncRuns) {
          await this.stopSyncRun(run);
        }
      }

      const syncSchedule = await this.pauseSchedule(sync.linked_account_id, sync.collection_key);
      if (!syncSchedule) {
        throw new Error('Failed to unpause sync schedule');
      }

      const updatedSync = await this.updateSync(sync.linked_account_id, sync.collection_key, {
        status: SyncStatus.Stopped,
      });

      await activityService.createActivityLog(activityId, {
        level: LogLevel.Info,
        message: 'Sync stopped',
        timestamp: now(),
        payload: {
          linked_account: sync.linked_account_id,
          integration: sync.integration_key,
          collection: sync.collection_key,
        },
      });

      return updatedSync;
    } catch (err) {
      await errorService.reportError(err);

      await activityService.createActivityLog(activityId, {
        level: LogLevel.Error,
        message: 'Failed to stop sync due to an internal error',
        timestamp: now(),
        payload: {
          linked_account: sync.linked_account_id,
          integration: sync.integration_key,
          collection: sync.collection_key,
        },
      });

      return null;
    }
  }

  public async triggerSync(sync: Sync, activityId: string | null): Promise<Sync | null> {
    try {
      const syncSchedule = await this.getSyncSchedule(sync.linked_account_id, sync.collection_key);
      if (!syncSchedule) {
        throw new Error('Sync schedule does not exist');
      }

      const temporal = await TemporalClient.getInstance();
      const temporalSyncScheduleId = TemporalClient.generateSyncScheduleId(
        sync.linked_account_id,
        sync.collection_key
      );

      const didTrigger = await temporal.triggerSyncSchedule(temporalSyncScheduleId);
      if (!didTrigger) {
        throw new Error('Failed to trigger sync schedule in Temporal');
      }

      await activityService.createActivityLog(activityId, {
        level: LogLevel.Info,
        message: 'Sync triggered',
        timestamp: now(),
        payload: {
          linked_account: sync.linked_account_id,
          integration: sync.integration_key,
          collection: sync.collection_key,
        },
      });

      return sync;
    } catch (err) {
      await errorService.reportError(err);

      await activityService.createActivityLog(activityId, {
        level: LogLevel.Error,
        message: 'Failed to trigger sync due to an internal error',
        timestamp: now(),
        payload: {
          linked_account: sync.linked_account_id,
          integration: sync.integration_key,
          collection: sync.collection_key,
        },
      });

      return null;
    }
  }

  public async updateSyncFrequency(
    linkedAccountId: string,
    collectionKey: string,
    frequency: StringValue
  ): Promise<Sync | null> {
    try {
      const syncSchedule = await this.getSyncSchedule(linkedAccountId, collectionKey);
      if (!syncSchedule) {
        throw new Error('Sync schedule not found');
      }

      const { interval, offset, error } = getFrequencyInterval(frequency, new Date());
      if (error !== null) {
        throw new Error(error);
      }

      const temporal = await TemporalClient.getInstance();
      const temporalSyncScheduleId = TemporalClient.generateSyncScheduleId(
        linkedAccountId,
        collectionKey
      );

      const didUpdate = await temporal.updateSyncSchedule(temporalSyncScheduleId, interval, offset);
      if (!didUpdate) {
        throw new Error('Failed to update sync schedule in Temporal');
      }

      const updatedSyncSchedule = await this.updateSyncSchedule(syncSchedule.id, {
        frequency: interval,
        offset,
      });

      if (!updatedSyncSchedule) {
        throw new Error('Failed to update sync schedule in database');
      }

      return await this.updateSync(linkedAccountId, collectionKey, {
        frequency: interval,
      });
    } catch (err) {
      await errorService.reportError(err);
      return null;
    }
  }

  public async handleSyncFailure(
    linkedAccountId: string,
    collectionKey: string
  ): Promise<Sync | null> {
    await this.pauseSchedule(linkedAccountId, collectionKey);

    return await this.updateSync(linkedAccountId, collectionKey, {
      status: SyncStatus.Error,
    });
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

  public async getLastSyncedAt(
    linkedAccountId: string,
    collectionKey: string
  ): Promise<number | null> {
    try {
      const sync = await database.sync.findUnique({
        where: {
          collection_key_linked_account_id: {
            linked_account_id: linkedAccountId,
            collection_key: collectionKey,
          },
          deleted_at: null,
        },
        select: { last_synced_at: true },
      });

      return sync ? sync.last_synced_at : null;
    } catch (err) {
      await errorService.reportError(err);
      return null;
    }
  }

  public async createSync(sync: Sync): Promise<Sync | null> {
    try {
      const existingSync = await database.sync.findUnique({
        where: {
          collection_key_linked_account_id: {
            collection_key: sync.collection_key,
            linked_account_id: sync.linked_account_id,
          },
        },
      });

      if (existingSync) {
        return await this.updateSync(sync.linked_account_id, sync.collection_key, { ...sync });
      }

      return await database.sync.create({ data: sync });
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

  public async stopSyncRun(syncRun: SyncRun): Promise<SyncRun | null> {
    try {
      if (syncRun.temporal_run_id) {
        const temporal = await TemporalClient.getInstance();
        await temporal.terminateSyncRun(syncRun.temporal_run_id);
      }

      return await this.updateSyncRun(syncRun.id, {
        status: SyncRunStatus.Stopped,
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

  public async createSyncSchedule(sync: Sync): Promise<SyncSchedule | null> {
    try {
      const existingSyncSchedule = await database.syncSchedule.findUnique({
        where: {
          collection_key_linked_account_id: {
            collection_key: sync.collection_key,
            linked_account_id: sync.linked_account_id,
          },
        },
      });

      let syncSchedule: SyncSchedule;

      const { interval, offset, error } = getFrequencyInterval(
        sync.frequency as StringValue,
        new Date()
      );

      if (error !== null) {
        throw new Error(error);
      }

      if (existingSyncSchedule) {
        syncSchedule = await database.syncSchedule.update({
          where: { id: existingSyncSchedule.id },
          data: {
            frequency: interval,
            offset,
            status: SyncScheduleStatus.Stopped,
            updated_at: now(),
            deleted_at: null,
          },
        });
      } else {
        syncSchedule = await database.syncSchedule.create({
          data: {
            id: generateId(Resource.SyncSchedule),
            linked_account_id: sync.linked_account_id,
            collection_key: sync.collection_key,
            frequency: interval,
            offset,
            status: SyncScheduleStatus.Stopped,
            created_at: now(),
            updated_at: now(),
            deleted_at: null,
          },
        });
      }

      const temporal = await TemporalClient.getInstance();
      const temporalSyncScheduleId = TemporalClient.generateSyncScheduleId(
        sync.linked_account_id,
        sync.collection_key
      );

      const scheduleHandle = await temporal.createSyncSchedule(
        temporalSyncScheduleId,
        syncSchedule.frequency as StringValue,
        syncSchedule.offset,
        {
          environmentId: sync.environment_id,
          linkedAccountId: sync.linked_account_id,
          integrationKey: sync.integration_key,
          collectionKey: sync.collection_key,
        }
      );

      if (!scheduleHandle) {
        return null;
      }

      return syncSchedule;
    } catch (err) {
      await errorService.reportError(err);
      return null;
    }
  }

  private async unpauseSchedule(
    linkedAccountId: string,
    collectionKey: string
  ): Promise<SyncSchedule | null> {
    try {
      const syncSchedule = await this.getSyncSchedule(linkedAccountId, collectionKey);
      if (!syncSchedule) {
        throw new Error('Sync schedule not found');
      }

      const temporal = await TemporalClient.getInstance();
      const temporalSyncScheduleId = TemporalClient.generateSyncScheduleId(
        linkedAccountId,
        collectionKey
      );

      const scheduleHandle = await temporal.getSyncScheduleHandle(temporalSyncScheduleId);
      if (!scheduleHandle) {
        throw new Error('Sync schedule not found in Temporal');
      }

      await scheduleHandle.unpause();
      await scheduleHandle.trigger();

      return await this.updateSyncSchedule(syncSchedule.id, {
        status: SyncScheduleStatus.Running,
      });
    } catch (err) {
      await errorService.reportError(err);
      return null;
    }
  }

  private async pauseSchedule(
    linkedAccountId: string,
    collectionKey: string
  ): Promise<SyncSchedule | null> {
    try {
      const syncSchedule = await this.getSyncSchedule(linkedAccountId, collectionKey);
      if (!syncSchedule) {
        throw new Error('Sync schedule not found');
      }

      const temporal = await TemporalClient.getInstance();
      const temporalSyncScheduleId = TemporalClient.generateSyncScheduleId(
        linkedAccountId,
        collectionKey
      );

      const scheduleHandle = await temporal.getSyncScheduleHandle(temporalSyncScheduleId);
      if (!scheduleHandle) {
        throw new Error('Sync schedule not found in Temporal');
      }

      await scheduleHandle.pause();

      return await this.updateSyncSchedule(syncSchedule.id, {
        status: SyncScheduleStatus.Stopped,
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
      return await database.syncSchedule.findUnique({
        where: {
          collection_key_linked_account_id: {
            collection_key: collectionKey,
            linked_account_id: linkedAccountId,
          },
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

  public async deleteSync(linkedAccountId: string, collectionKey: string): Promise<Sync | null> {
    try {
      const temporal = await TemporalClient.getInstance();
      const temporalSyncScheduleId = TemporalClient.generateSyncScheduleId(
        linkedAccountId,
        collectionKey
      );

      const syncSchedule = await this.getSyncSchedule(linkedAccountId, collectionKey);
      if (syncSchedule) {
        await temporal.deleteSyncSchedule(temporalSyncScheduleId);
        await this.updateSyncSchedule(syncSchedule.id, {
          status: SyncScheduleStatus.Stopped,
          deleted_at: now(),
        });
      }

      const syncRuns = await this.listSyncRuns(linkedAccountId, collectionKey);
      if (!syncRuns) {
        throw new Error('Failed to get sync runs');
      }

      for (const syncRun of syncRuns) {
        if (syncRun.status === SyncRunStatus.Running && syncRun.temporal_run_id) {
          await temporal.terminateSyncRun(syncRun.temporal_run_id);
        }
      }

      const elastic = ElasticClient.getInstance();
      await elastic.deleteIndex(linkedAccountId, collectionKey);

      return await this.updateSync(linkedAccountId, collectionKey, {
        status: SyncStatus.Stopped,
        deleted_at: now(),
      });
    } catch (err) {
      await errorService.reportError(err);
      return null;
    }
  }
}

export default new SyncService();
