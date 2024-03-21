import { Registry } from '@embed/providers';
import {
  LogLevel,
  SyncContext,
  SyncRunStatus,
  activityService,
  errorService,
  now,
  syncService,
} from '@embed/shared';
import { CancelledFailure, Context } from '@temporalio/activity';
import { TerminatedFailure, TimeoutFailure } from '@temporalio/workflow';
import { ActionArgs, IncrementalSyncArgs, InitialSyncArgs } from './types';

export async function runInitialSync(args: InitialSyncArgs): Promise<void> {
  try {
    await activityService.createActivityLog(args.activityId, {
      message: `Starting initial sync`,
      level: LogLevel.Info,
      timestamp: now(),
    });

    const temporalContext: Context = Context.current();

    const syncContext = new SyncContext({
      linkedAccountId: args.linkedAccountId,
      integrationKey: args.integrationKey,
      collectionKey: args.collectionKey,
      syncRunId: args.syncRunId,
      lastSyncedAt: args.lastSyncedAt,
      activityId: args.activityId,
      syncType: 'initial',
      temporalContext,
    });

    const registry = new Registry();
    await registry.syncProviderCollection(args.integrationKey, args.collectionKey, syncContext);

    const results = await syncContext.reportResults();
    await syncService.updateSyncRun(args.syncRunId, {
      status: SyncRunStatus.Succeeded,
      ...results,
    });

    await syncContext.finish();
    await syncService.updateSync(args.linkedAccountId, args.collectionKey, {
      last_synced_at: now(),
    });

    await activityService.createActivityLog(args.activityId, {
      message: `Initial sync complete`,
      level: LogLevel.Info,
      timestamp: now(),
      payload: { ...results },
    });
  } catch (err) {
    await errorService.reportError(err);

    await activityService.createActivityLog(args.activityId, {
      message: `Initial sync failed`,
      level: LogLevel.Error,
      timestamp: now(),
    });

    await syncService.handleSyncFailure(args.linkedAccountId, args.collectionKey, args.syncRunId);
  }
}

export async function runIncrementalSync(args: IncrementalSyncArgs): Promise<void> {
  try {
    const initialSyncStillRunning = await syncService.isInitialSyncRunning(
      args.linkedAccountId,
      args.collectionKey
    );

    if (initialSyncStillRunning == null) {
      throw new Error('Failed to check if initial sync is still running');
    } else if (initialSyncStillRunning == true) {
      await activityService.createActivityLog(args.activityId, {
        message: `Incremental sync skipped because initial sync is still running`,
        level: LogLevel.Warn,
        timestamp: now(),
      });

      return;
    }

    await activityService.createActivityLog(args.activityId, {
      message: `Starting incremental sync`,
      level: LogLevel.Info,
      timestamp: now(),
      payload: {
        integration: args.integrationKey,
        linked_account: args.linkedAccountId,
        collection: args.collectionKey,
      },
    });

    const temporalContext: Context = Context.current();

    const syncContext = new SyncContext({
      linkedAccountId: args.linkedAccountId,
      integrationKey: args.integrationKey,
      collectionKey: args.collectionKey,
      syncRunId: args.syncRunId,
      lastSyncedAt: args.lastSyncedAt,
      activityId: args.activityId,
      syncType: 'incremental',
      temporalContext,
    });

    const registry = new Registry();
    await registry.syncProviderCollection(args.integrationKey, args.collectionKey, syncContext);

    const results = await syncContext.reportResults();
    await syncService.updateSyncRun(args.syncRunId, {
      status: SyncRunStatus.Succeeded,
      ...results,
    });

    await syncContext.finish();
    await syncService.updateSync(args.linkedAccountId, args.collectionKey, {
      last_synced_at: now(),
    });

    await activityService.createActivityLog(args.activityId, {
      message: `Incremental sync complete`,
      level: LogLevel.Info,
      timestamp: now(),
      payload: { ...results },
    });
  } catch (err) {
    await errorService.reportError(err);

    await activityService.createActivityLog(args.activityId, {
      message: `Incremental sync failed`,
      level: LogLevel.Error,
      timestamp: now(),
    });

    await syncService.handleSyncFailure(args.linkedAccountId, args.collectionKey, args.syncRunId);
  }
}

export async function triggerAction(args: ActionArgs): Promise<void> {
  return;
}

export async function reportFailure(
  err: any,
  args: InitialSyncArgs | IncrementalSyncArgs | ActionArgs,
  defaultTimeout: string,
  maxAttempts: number
): Promise<void> {
  await errorService.reportError(err);

  let message: string = 'Activity failed';
  if ('syncRunId' in args) {
    message = 'Sync failed';
    await syncService.handleSyncFailure(args.linkedAccountId, args.collectionKey, args.syncRunId);
  } else if ('actionKey' in args) {
    message = 'Action failed';
    // handle action failure
  }

  if (
    err instanceof CancelledFailure ||
    err.cause instanceof TerminatedFailure ||
    err.cause?.name === 'TerminatedFailure'
  ) {
    message += ` due to cancellation`;
  } else if (err.cause instanceof TimeoutFailure || err.cause?.name === 'TimeoutFailure') {
    if (err.cause.timeoutType === 3) {
      message += `, timeout exceeded ${defaultTimeout}`;
    } else {
      message += `, max attempts of ${maxAttempts} exceeded`;
    }
  }

  await activityService.createActivityLog(args.activityId, {
    message,
    level: LogLevel.Error,
    timestamp: now(),
  });
}
