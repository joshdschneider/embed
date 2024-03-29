import { Registry } from '@embed/providers';
import {
  ActionArgs,
  IncrementalSyncArgs,
  InitialSyncArgs,
  LogAction,
  LogLevel,
  Resource,
  SyncContext,
  SyncRunStatus,
  SyncRunType,
  activityService,
  errorService,
  generateId,
  linkedAccountService,
  now,
  syncService,
} from '@embed/shared';
import { CancelledFailure, Context } from '@temporalio/activity';
import { TerminatedFailure, TimeoutFailure } from '@temporalio/workflow';

export async function runInitialSync(args: InitialSyncArgs): Promise<void> {
  try {
    await activityService.createActivityLog(args.activityId, {
      message: `Starting initial sync`,
      level: LogLevel.Info,
      timestamp: now(),
    });

    const temporalContext: Context = Context.current();
    const multimodalEnabled = await linkedAccountService.isMultimodalEnabled(args.linkedAccountId);

    const syncContext = new SyncContext({
      environmentId: args.environmentId,
      linkedAccountId: args.linkedAccountId,
      integrationKey: args.integrationKey,
      collectionKey: args.collectionKey,
      syncRunId: args.syncRunId,
      multimodalEnabled: multimodalEnabled,
      lastSyncedAt: args.lastSyncedAt,
      activityId: args.activityId,
      syncRunType: SyncRunType.Initial,
      temporalContext,
    });

    const registry = new Registry();
    await registry.syncProviderCollection(args.integrationKey, args.collectionKey, syncContext);

    const results = await syncContext.reportResults();
    await syncService.updateSyncRun(args.syncRunId, {
      status: SyncRunStatus.Succeeded,
      ...results,
    });

    syncContext.finish();
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
  let activityId = args.activityId;
  let syncRunId = args.syncRunId;

  if (!activityId) {
    activityId = await activityService.createActivity({
      id: generateId(Resource.Activity),
      environment_id: args.environmentId,
      linked_account_id: args.linkedAccountId,
      integration_key: args.integrationKey,
      collection_key: args.collectionKey,
      action_key: null,
      link_token_id: null,
      timestamp: now(),
      action: LogAction.Sync,
      level: LogLevel.Info,
    });
  }

  if (!syncRunId) {
    const temporalRunId = Context.current().info.workflowExecution.runId;
    const syncRun = await syncService.createSyncRun({
      id: generateId(Resource.SyncRun),
      linked_account_id: args.linkedAccountId,
      collection_key: args.collectionKey,
      type: SyncRunType.Incremental,
      status: SyncRunStatus.Running,
      temporal_run_id: temporalRunId,
      records_added: 0,
      records_updated: 0,
      records_deleted: 0,
      created_at: now(),
      updated_at: now(),
    });

    if (!syncRun) {
      await activityService.createActivityLog(activityId, {
        message: `Incremental sync failed`,
        level: LogLevel.Error,
        timestamp: now(),
      });

      return await errorService.reportError(new Error('Failed to create sync run in database'));
    } else {
      syncRunId = syncRun.id;
    }
  }

  try {
    const initialSyncStillRunning = await syncService.isInitialSyncRunning(
      args.linkedAccountId,
      args.collectionKey
    );

    if (initialSyncStillRunning == null) {
      throw new Error('Failed to check if initial sync is still running');
    } else if (initialSyncStillRunning == true) {
      await activityService.createActivityLog(activityId, {
        message: `Incremental sync skipped because initial sync is still running`,
        level: LogLevel.Warn,
        timestamp: now(),
      });
      return;
    }

    await activityService.createActivityLog(activityId, {
      message: `Starting incremental sync`,
      level: LogLevel.Info,
      timestamp: now(),
      payload: {
        integration: args.integrationKey,
        linked_account: args.linkedAccountId,
        collection: args.collectionKey,
        sync_run: syncRunId,
      },
    });

    const temporalContext: Context = Context.current();
    const multimodalEnabled = await linkedAccountService.isMultimodalEnabled(args.linkedAccountId);
    const lastSyncedAt = await syncService.getLastSyncedAt(
      args.linkedAccountId,
      args.collectionKey
    );

    const syncContext = new SyncContext({
      environmentId: args.environmentId,
      linkedAccountId: args.linkedAccountId,
      integrationKey: args.integrationKey,
      collectionKey: args.collectionKey,
      multimodalEnabled: multimodalEnabled,
      syncRunId: syncRunId,
      lastSyncedAt: lastSyncedAt,
      activityId: activityId,
      syncRunType: SyncRunType.Incremental,
      temporalContext,
    });

    const registry = new Registry();
    await registry.syncProviderCollection(args.integrationKey, args.collectionKey, syncContext);

    const results = await syncContext.reportResults();
    await syncService.updateSyncRun(syncRunId, {
      status: SyncRunStatus.Succeeded,
      ...results,
    });

    syncContext.finish();
    await syncService.updateSync(args.linkedAccountId, args.collectionKey, {
      last_synced_at: now(),
    });

    await activityService.createActivityLog(activityId, {
      message: `Incremental sync complete`,
      level: LogLevel.Info,
      timestamp: now(),
      payload: { ...results },
    });
  } catch (err) {
    await errorService.reportError(err);

    await activityService.createActivityLog(activityId, {
      message: `Incremental sync failed`,
      level: LogLevel.Error,
      timestamp: now(),
    });

    await syncService.handleSyncFailure(args.linkedAccountId, args.collectionKey, syncRunId);
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
  if ('syncRunId' in args && args.syncRunId) {
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

  await activityService.createActivityLog(args.activityId || null, {
    message,
    level: LogLevel.Error,
    timestamp: now(),
  });
}
