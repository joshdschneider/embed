import { Sync, SyncRun, SyncSchedule } from '@prisma/client';
import { database } from '../utils/database';
import { SyncStatus } from '../utils/enums';
import { now } from '../utils/helpers';
import errorService from './error.service';

class SyncService {
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
      /**
       * Handle frequency change
       */

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

  public async startSync(linkedAccountId: string, collectionKey: string): Promise<Sync | null> {
    try {
      /**
       * Handle start
       */

      return await database.sync.update({
        where: {
          collection_key_linked_account_id: {
            linked_account_id: linkedAccountId,
            collection_key: collectionKey,
          },
          deleted_at: null,
        },
        data: {
          status: SyncStatus.Running,
          last_synced_at: now(), // ??
          updated_at: now(),
        },
      });
    } catch (err) {
      await errorService.reportError(err);
      return null;
    }
  }

  public async stopSync(linkedAccountId: string, collectionKey: string): Promise<Sync | null> {
    try {
      /**
       * Handle stop
       */

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
      /**
       * Handle trigger
       */

      return await database.sync.update({
        where: {
          collection_key_linked_account_id: {
            linked_account_id: linkedAccountId,
            collection_key: collectionKey,
          },
          deleted_at: null,
        },
        data: {
          last_synced_at: now(), // ??
          updated_at: now(),
        },
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
