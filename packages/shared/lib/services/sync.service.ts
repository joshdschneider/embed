import { Collection, Sync, SyncRun, SyncSchedule } from '@prisma/client';
import { StringValue } from 'ms';
import TemporalClient from '../clients/temporal.client';
import { database } from '../utils/database';
import {
  LogLevel,
  Resource,
  SyncFrequency,
  SyncRunStatus,
  SyncScheduleStatus,
  SyncStatus,
} from '../utils/enums';
import { generateId, getFrequencyInterval, now } from '../utils/helpers';
import activityService from './activity.service';
import errorService from './error.service';
import webhookService from './webhook.service';

class SyncService {
  public async initializeSync({
    connectionId,
    collection,
    activityId,
  }: {
    connectionId: string;
    collection: Collection;
    activityId: string | null;
  }): Promise<void> {
    try {
      const sync = await this.createSync({
        connection_id: connectionId,
        environment_id: collection.environment_id,
        integration_id: collection.integration_id,
        provider_key: collection.provider_key,
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

      if (!collection.is_enabled || !collection.auto_start_syncs) {
        return;
      }

      await this.startSync(sync);
    } catch (err) {
      await errorService.reportError(err);

      await activityService.createActivityLog(activityId, {
        level: LogLevel.Error,
        message: 'Failed to initialize sync due to an internal error',
        timestamp: now(),
        payload: {
          connection_id: connectionId,
          integration_id: collection.integration_id,
          collection_key: collection.unique_key,
        },
      });
    }
  }

  public async startSync(sync: Sync): Promise<Sync | null> {
    try {
      const syncSchedule = await this.unpauseSchedule({
        connectionId: sync.connection_id,
        integrationId: sync.integration_id,
        collectionKey: sync.collection_key,
      });

      if (!syncSchedule) {
        throw new Error('Failed to unpause sync schedule');
      }

      return await this.updateSync({
        integrationId: sync.integration_id,
        connectionId: sync.connection_id,
        collectionKey: sync.collection_key,
        data: { status: SyncStatus.Running },
      });
    } catch (err) {
      await errorService.reportError(err);
      return null;
    }
  }

  public async stopSync(sync: Sync): Promise<Sync | null> {
    try {
      const syncRuns = await this.listSyncRuns({
        integrationId: sync.integration_id,
        connectionId: sync.connection_id,
        collectionKey: sync.collection_key,
      });

      if (!syncRuns) {
        throw new Error('Failed to get sync runs');
      }

      const runningSyncRuns = syncRuns.filter((run) => run.status === SyncRunStatus.Running);
      if (runningSyncRuns.length > 0) {
        for (const run of runningSyncRuns) {
          await this.stopSyncRun(run);
        }
      }

      const syncSchedule = await this.pauseSchedule({
        integrationId: sync.integration_id,
        connectionId: sync.connection_id,
        collectionKey: sync.collection_key,
      });

      if (!syncSchedule) {
        throw new Error('Failed to unpause sync schedule');
      }

      return await this.updateSync({
        integrationId: sync.integration_id,
        connectionId: sync.connection_id,
        collectionKey: sync.collection_key,
        data: { status: SyncStatus.Stopped },
      });
    } catch (err) {
      await errorService.reportError(err);
      return null;
    }
  }

  public async triggerSync(sync: Sync): Promise<Sync | null> {
    try {
      const syncSchedule = await this.getSyncSchedule({
        connectionId: sync.connection_id,
        integrationId: sync.integration_id,
        collectionKey: sync.collection_key,
      });

      if (!syncSchedule) {
        throw new Error('Sync schedule does not exist');
      }

      const temporal = await TemporalClient.getInstance();
      const temporalSyncScheduleId = TemporalClient.generateSyncScheduleId({
        integrationId: sync.integration_id,
        connectionId: sync.connection_id,
        collectionKey: sync.collection_key,
      });

      const didTrigger = await temporal.triggerSyncSchedule(temporalSyncScheduleId);
      if (!didTrigger) {
        throw new Error('Failed to trigger sync schedule in Temporal');
      }

      return sync;
    } catch (err) {
      await errorService.reportError(err);
      return null;
    }
  }

  public async updateSyncFrequency({
    integrationId,
    connectionId,
    collectionKey,
    frequency,
  }: {
    integrationId: string;
    connectionId: string;
    collectionKey: string;
    frequency: SyncFrequency;
  }): Promise<Sync | null> {
    try {
      const syncSchedule = await this.getSyncSchedule({
        connectionId,
        collectionKey,
        integrationId,
      });

      if (!syncSchedule) {
        throw new Error('Sync schedule not found');
      }

      const { interval, offset } = getFrequencyInterval(frequency, new Date());

      const temporal = await TemporalClient.getInstance();
      const temporalSyncScheduleId = TemporalClient.generateSyncScheduleId({
        integrationId,
        connectionId,
        collectionKey,
      });

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

      return await this.updateSync({
        integrationId,
        connectionId,
        collectionKey,
        data: { frequency },
      });
    } catch (err) {
      await errorService.reportError(err);
      return null;
    }
  }

  public async handleSyncSuccess({
    sync,
    results,
    activityId,
  }: {
    sync: Sync;
    results: { records_added: number; records_updated: number; records_deleted: number };
    activityId: string | null;
  }): Promise<void> {
    await this.updateSync({
      integrationId: sync.integration_id,
      connectionId: sync.connection_id,
      collectionKey: sync.collection_key,
      data: { last_synced_at: now() },
    });

    webhookService.sendSyncWebhook({
      action: 'succeeded',
      sync,
      activityId,
      results,
    });
  }

  public async handleSyncFailure({
    sync,
    activityId,
    reason,
  }: {
    sync: Sync;
    activityId: string | null;
    reason?: string;
  }): Promise<void> {
    await this.pauseSchedule({
      integrationId: sync.integration_id,
      connectionId: sync.connection_id,
      collectionKey: sync.collection_key,
    });

    await this.updateSync({
      integrationId: sync.integration_id,
      connectionId: sync.connection_id,
      collectionKey: sync.collection_key,
      data: { status: SyncStatus.Error },
    });

    webhookService.sendSyncWebhook({
      action: 'failed',
      sync,
      activityId,
      reason,
    });
  }

  public async updateSync({
    integrationId,
    connectionId,
    collectionKey,
    data,
  }: {
    integrationId: string;
    connectionId: string;
    collectionKey: string;
    data: Partial<Sync>;
  }): Promise<Sync | null> {
    try {
      return await database.sync.update({
        where: {
          collection_key_connection_id_integration_id: {
            collection_key: collectionKey,
            connection_id: connectionId,
            integration_id: integrationId,
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

  public async listSyncs({
    integrationId,
    connectionId,
  }: {
    integrationId: string;
    connectionId: string;
  }): Promise<Sync[] | null> {
    try {
      return await database.sync.findMany({
        where: { integration_id: integrationId, connection_id: connectionId, deleted_at: null },
      });
    } catch (err) {
      await errorService.reportError(err);
      return null;
    }
  }

  public async listSyncsForCollection({
    integrationId,
    collectionKey,
  }: {
    integrationId: string;
    collectionKey: string;
  }): Promise<Sync[] | null> {
    try {
      return await database.sync.findMany({
        where: {
          integration_id: integrationId,
          collection_key: collectionKey,
          deleted_at: null,
        },
      });
    } catch (err) {
      await errorService.reportError(err);
      return null;
    }
  }

  public async retrieveSync({
    integrationId,
    connectionId,
    collectionKey,
  }: {
    integrationId: string;
    connectionId: string;
    collectionKey: string;
  }): Promise<Sync | null> {
    try {
      return await database.sync.findUnique({
        where: {
          collection_key_connection_id_integration_id: {
            connection_id: connectionId,
            collection_key: collectionKey,
            integration_id: integrationId,
          },
          deleted_at: null,
        },
      });
    } catch (err) {
      await errorService.reportError(err);
      return null;
    }
  }

  public async getLastSyncedAt({
    integrationId,
    connectionId,
    collectionKey,
  }: {
    integrationId: string;
    connectionId: string;
    collectionKey: string;
  }): Promise<number | null> {
    try {
      const sync = await database.sync.findUnique({
        where: {
          collection_key_connection_id_integration_id: {
            connection_id: connectionId,
            collection_key: collectionKey,
            integration_id: integrationId,
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
          collection_key_connection_id_integration_id: {
            collection_key: sync.collection_key,
            connection_id: sync.connection_id,
            integration_id: sync.integration_id,
          },
        },
      });

      if (existingSync) {
        return await this.updateSync({
          integrationId: sync.integration_id,
          connectionId: sync.connection_id,
          collectionKey: sync.collection_key,
          data: { ...sync },
        });
      }

      return await database.sync.create({ data: sync });
    } catch (err) {
      await errorService.reportError(err);
      return null;
    }
  }

  public async listSyncRuns({
    integrationId,
    connectionId,
    collectionKey,
  }: {
    integrationId: string;
    connectionId: string;
    collectionKey: string;
  }): Promise<(SyncRun & { integration_id: string })[] | null> {
    try {
      const syncRuns = await database.syncRun.findMany({
        where: {
          integration_id: integrationId,
          connection_id: connectionId,
          collection_key: collectionKey,
        },
      });

      if (!syncRuns) {
        return null;
      }

      return syncRuns;
    } catch (err) {
      await errorService.reportError(err);
      return null;
    }
  }

  public async retrieveSyncRun(syncRunId: string): Promise<SyncRun | null> {
    try {
      const syncRun = await database.syncRun.findUnique({
        where: { id: syncRunId },
      });

      if (!syncRun) {
        return null;
      }

      return syncRun;
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
          collection_key_connection_id_integration_id: {
            collection_key: sync.collection_key,
            connection_id: sync.connection_id,
            integration_id: sync.integration_id,
          },
        },
      });

      let syncSchedule: SyncSchedule;

      const { interval, offset } = getFrequencyInterval(
        sync.frequency as SyncFrequency,
        new Date()
      );

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
            integration_id: sync.integration_id,
            connection_id: sync.connection_id,
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
      const temporalSyncScheduleId = TemporalClient.generateSyncScheduleId({
        integrationId: sync.integration_id,
        connectionId: sync.connection_id,
        collectionKey: sync.collection_key,
      });

      const scheduleHandle = await temporal.createSyncSchedule(
        temporalSyncScheduleId,
        syncSchedule.frequency as StringValue,
        syncSchedule.offset,
        {
          environmentId: sync.environment_id,
          connectionId: sync.connection_id,
          integrationId: sync.integration_id,
          providerKey: sync.provider_key,
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

  private async unpauseSchedule({
    connectionId,
    integrationId,
    collectionKey,
  }: {
    connectionId: string;
    integrationId: string;
    collectionKey: string;
  }): Promise<SyncSchedule | null> {
    try {
      const syncSchedule = await this.getSyncSchedule({
        integrationId,
        connectionId,
        collectionKey,
      });

      if (!syncSchedule) {
        throw new Error('Sync schedule not found');
      }

      const temporal = await TemporalClient.getInstance();
      const temporalSyncScheduleId = TemporalClient.generateSyncScheduleId({
        integrationId,
        connectionId,
        collectionKey,
      });

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

  private async pauseSchedule({
    integrationId,
    connectionId,
    collectionKey,
  }: {
    integrationId: string;
    connectionId: string;
    collectionKey: string;
  }): Promise<SyncSchedule | null> {
    try {
      const syncSchedule = await this.getSyncSchedule({
        integrationId,
        connectionId,
        collectionKey,
      });

      if (!syncSchedule) {
        throw new Error('Sync schedule not found');
      }

      const temporal = await TemporalClient.getInstance();
      const temporalSyncScheduleId = TemporalClient.generateSyncScheduleId({
        integrationId,
        connectionId,
        collectionKey,
      });

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

  public async getSyncSchedule({
    integrationId,
    connectionId,
    collectionKey,
  }: {
    integrationId: string;
    connectionId: string;
    collectionKey: string;
  }): Promise<SyncSchedule | null> {
    try {
      return await database.syncSchedule.findUnique({
        where: {
          collection_key_connection_id_integration_id: {
            collection_key: collectionKey,
            connection_id: connectionId,
            integration_id: integrationId,
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

  public async deleteSync(sync: Sync): Promise<Sync | null> {
    try {
      const integrationId = sync.integration_id;
      const connectionId = sync.connection_id;
      const collectionKey = sync.collection_key;
      const temporal = await TemporalClient.getInstance();
      const temporalSyncScheduleId = TemporalClient.generateSyncScheduleId({
        connectionId,
        collectionKey,
        integrationId,
      });

      const syncSchedule = await this.getSyncSchedule({
        connectionId,
        collectionKey,
        integrationId,
      });

      if (syncSchedule) {
        await temporal.deleteSyncSchedule(temporalSyncScheduleId);
        await this.updateSyncSchedule(syncSchedule.id, {
          status: SyncScheduleStatus.Stopped,
          deleted_at: now(),
        });
      }

      const syncRuns = await this.listSyncRuns({
        integrationId,
        connectionId,
        collectionKey,
      });

      if (!syncRuns) {
        throw new Error('Failed to get sync runs');
      }

      for (const syncRun of syncRuns) {
        if (syncRun.status === SyncRunStatus.Running && syncRun.temporal_run_id) {
          await temporal.terminateSyncRun(syncRun.temporal_run_id);
        }
      }

      return await this.updateSync({
        integrationId,
        connectionId,
        collectionKey,
        data: { status: SyncStatus.Stopped, deleted_at: now() },
      });
    } catch (err) {
      await errorService.reportError(err);
      return null;
    }
  }
}

export default new SyncService();
