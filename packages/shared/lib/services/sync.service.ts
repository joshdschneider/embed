import { Collection, Sync, SyncRun, SyncSchedule } from '@prisma/client';
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
        message: 'Failed to initialize sync for linked account',
        timestamp: now(),
      });
    }
  }

  public async startSync(sync: Sync, activityId: string | null): Promise<Sync | null> {
    try {
      const temporal = await TemporalClient.getInstance();
      if (!temporal) {
        throw new Error('Failed to get Temporal client instance');
      }

      const syncRuns = await this.listSyncRuns(sync.linked_account_id, sync.collection_key);
      if (syncRuns == null) {
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
          status: SyncRunStatus.Stopped,
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
          lastSyncedAt: sync.last_synced_at,
          activityId,
        });

        if (!temporalRunId) {
          await this.updateSyncRun(newSyncRun.id, {
            status: SyncRunStatus.Failed,
          });

          throw new Error('Failed to start initial sync in Temporal');
        } else {
          await this.updateSyncRun(newSyncRun.id, {
            status: SyncRunStatus.Running,
            temporal_run_id: temporalRunId,
          });
        }
      }

      const syncSchedule = await this.getSyncSchedule(sync.linked_account_id, sync.collection_key);
      const { interval, offset, error } = getFrequencyInterval(sync.frequency, new Date());

      if (error !== null) {
        throw new Error(error);
      }

      if (!syncSchedule) {
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
        let scheduleHandle = await temporal.getSyncSchedule(syncSchedule.id);

        if (!scheduleHandle) {
          scheduleHandle = await temporal.createSyncSchedule(syncSchedule.id, interval, offset, {
            environmentId: sync.environment_id,
            linkedAccountId: sync.environment_id,
            integrationKey: sync.integration_key,
            collectionKey: sync.collection_key,
          });

          if (!scheduleHandle) {
            throw new Error('Failed to create sync schedule in Temporal');
          }
        }

        const description = await scheduleHandle.describe();
        const schedulePaused = description.state.paused;

        if (schedulePaused) {
          await scheduleHandle.unpause();
          await activityService.createActivityLog(activityId, {
            level: LogLevel.Info,
            message: 'Sync schedule started',
            timestamp: now(),
          });
        }
      }

      return await this.updateSync(sync.linked_account_id, sync.collection_key, {
        status: SyncStatus.Running,
      });
    } catch (err) {
      await errorService.reportError(err);
      return null;
    }
  }

  public async stopSync(sync: Sync): Promise<Sync | null> {
    try {
      const temporal = await TemporalClient.getInstance();
      if (!temporal) {
        throw new Error('Failed to get Temporal client instance');
      }

      const syncSchedule = await this.getSyncSchedule(sync.linked_account_id, sync.collection_key);
      if (syncSchedule) {
        const scheduleDidPause = await temporal.pauseSyncSchedule(syncSchedule.id);
        if (scheduleDidPause) {
          await this.updateSyncSchedule(syncSchedule.id, {
            status: SyncScheduleStatus.Stopped,
          });
        }
      }

      const syncRuns = await this.listSyncRuns(sync.linked_account_id, sync.collection_key);
      if (!syncRuns) {
        throw new Error('Failed to get sync runs');
      }

      const runningSyncRuns = syncRuns.filter((run) => run.status === SyncRunStatus.Running);
      if (runningSyncRuns.length > 0) {
        for (const run of runningSyncRuns) {
          if (run.temporal_run_id) {
            await temporal.terminateSyncRun(run.temporal_run_id);
          }

          await this.updateSyncRun(run.id, { status: SyncRunStatus.Stopped });
        }
      }

      return await this.updateSync(sync.linked_account_id, sync.collection_key, {
        status: SyncStatus.Stopped,
      });
    } catch (err) {
      await errorService.reportError(err);
      return null;
    }
  }

  public async triggerSync(sync: Sync, activityId: string | null): Promise<Sync | null> {
    try {
      const syncRuns = await this.listSyncRuns(sync.linked_account_id, sync.collection_key);
      if (!syncRuns) {
        throw new Error('Failed to get sync runs');
      }

      const stillRunning = syncRuns.find((run) => run.status === SyncRunStatus.Running);
      if (stillRunning) {
        throw new Error('Sync still running');
      }

      const temporal = await TemporalClient.getInstance();
      if (!temporal) {
        throw new Error('Failed to get Temporal client instance');
      }

      const initialSuccessfulRuns = syncRuns.filter(
        (run) => run.type === SyncRunType.Initial && run.status === SyncRunStatus.Succeeded
      );

      if (initialSuccessfulRuns.length === 0) {
        const initialSyncRunId = generateId(Resource.SyncRun);
        const didStart = await temporal.startInitialSync(initialSyncRunId, {
          activityId,
          collectionKey: sync.collection_key,
          environmentId: sync.environment_id,
          integrationKey: sync.integration_key,
          linkedAccountId: sync.linked_account_id,
          syncRunId: initialSyncRunId,
          lastSyncedAt: sync.last_synced_at,
        });

        return didStart ? sync : null;
      } else {
        const syncSchedule = await this.getSyncSchedule(
          sync.linked_account_id,
          sync.collection_key
        );

        if (!syncSchedule) {
          throw new Error('Failed to get sync schedule');
        }

        if (syncSchedule.status === SyncScheduleStatus.Stopped) {
          const incrementalSyncRunId = generateId(Resource.SyncRun);
          const didTrigger = await temporal.triggerIncrementalSync(incrementalSyncRunId, {
            activityId,
            collectionKey: sync.collection_key,
            environmentId: sync.environment_id,
            integrationKey: sync.integration_key,
            linkedAccountId: sync.linked_account_id,
            syncRunId: incrementalSyncRunId,
            lastSyncedAt: sync.last_synced_at,
          });

          return didTrigger ? sync : null;
        } else {
          const didTrigger = await temporal.triggerSyncSchedule(syncSchedule.id);
          return didTrigger ? sync : null;
        }
      }
    } catch (err) {
      await errorService.reportError(err);
      return null;
    }
  }

  public async updateSyncFrequency(
    linkedAccountId: string,
    collectionKey: string,
    frequency: string
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
      if (!temporal) {
        throw new Error('Failed to get Temporal client instance');
      }

      const didUpdate = temporal.updateSyncSchedule(syncSchedule.id, interval, offset);
      if (!didUpdate) {
        throw new Error('Failed to update sync schedule in Temporal');
      }

      const updatedSyncSchedule = this.updateSyncSchedule(syncSchedule.id, {
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

  public async isInitialSyncRunning(
    linkedAccountId: string,
    collectionKey: string
  ): Promise<boolean | null> {
    try {
      const syncRuns = await this.listSyncRuns(linkedAccountId, collectionKey);
      if (syncRuns == null) {
        throw new Error('Failed to list sync runs');
      }

      const stillRunning = syncRuns.find(
        (run) => run.type === SyncRunType.Initial && run.status === SyncRunStatus.Running
      );

      return !!stillRunning;
    } catch (err) {
      await errorService.reportError(err);
      return null;
    }
  }

  public async handleSyncFailure(
    linkedAccountId: string,
    collectionKey: string,
    syncRunId: string
  ): Promise<Sync | null> {
    try {
      const temporal = await TemporalClient.getInstance();
      if (!temporal) {
        throw new Error('Failed to get Temporal client instance');
      }

      await this.updateSyncRun(syncRunId, {
        status: SyncRunStatus.Failed,
      });

      const syncSchedule = await this.getSyncSchedule(linkedAccountId, collectionKey);
      if (syncSchedule) {
        const scheduleDidPause = await temporal.pauseSyncSchedule(syncSchedule.id);
        if (scheduleDidPause) {
          await this.updateSyncSchedule(syncSchedule.id, {
            status: SyncScheduleStatus.Stopped,
          });
        }
      }

      return await this.updateSync(linkedAccountId, collectionKey, {
        status: SyncStatus.Error,
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
        if (existingSync.deleted_at) {
          return await this.updateSync(sync.linked_account_id, sync.collection_key, { ...sync });
        } else {
          return existingSync;
        }
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

  public async deleteSync(linkedAccountId: string, collectionKey: string): Promise<Sync | null> {
    try {
      const temporal = await TemporalClient.getInstance();
      if (!temporal) {
        throw new Error('Failed to get Temporal client instance');
      }

      const syncSchedule = await this.getSyncSchedule(linkedAccountId, collectionKey);
      if (syncSchedule) {
        await temporal.deleteSyncSchedule(syncSchedule.id);
        await this.updateSyncSchedule(syncSchedule.id, {
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

      return await this.updateSync(linkedAccountId, collectionKey, {
        deleted_at: now(),
      });
    } catch (err) {
      await errorService.reportError(err);
      return null;
    }
  }
}

export default new SyncService();
