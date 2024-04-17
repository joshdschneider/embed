import { Registry } from '@embed/providers';
import {
  ActionArgs,
  Resource,
  SyncArgs,
  SyncContext,
  SyncRunStatus,
  errorService,
  generateId,
  linkedAccountService,
  now,
  syncService,
} from '@embed/shared';
import { CancelledFailure, Context } from '@temporalio/activity';
import { TerminatedFailure, TimeoutFailure } from '@temporalio/workflow';
import { ActionFailureArgs, SyncFailureArgs } from './types';

// export async function runInitialSync(args: InitialSyncArgs): Promise<void> {
//   try {
//     await activityService.createActivityLog(args.activityId, {
//       message: `Starting initial sync`,
//       level: LogLevel.Info,
//       timestamp: now(),
//     });

//     const temporalContext: Context = Context.current();
//     const multimodalEnabled = await linkedAccountService.isMultimodalEnabled(args.linkedAccountId);

//     const syncContext = new SyncContext({
//       environmentId: args.environmentId,
//       linkedAccountId: args.linkedAccountId,
//       integrationKey: args.integrationKey,
//       collectionKey: args.collectionKey,
//       syncRunId: args.syncRunId,
//       multimodalEnabled: multimodalEnabled,
//       lastSyncedAt: args.lastSyncedAt,
//       activityId: args.activityId,
//       syncRunType: SyncRunType.Initial,
//       temporalContext,
//     });

//     const registry = new Registry();
//     await registry.syncProviderCollection(args.integrationKey, args.collectionKey, syncContext);

//     const results = await syncContext.reportResults();
//     await syncService.updateSyncRun(args.syncRunId, {
//       status: SyncRunStatus.Succeeded,
//       ...results,
//     });

//     syncContext.finish();
//     await syncService.updateSync(args.linkedAccountId, args.collectionKey, {
//       last_synced_at: now(),
//     });

//     await activityService.createActivityLog(args.activityId, {
//       message: `Initial sync complete`,
//       level: LogLevel.Info,
//       timestamp: now(),
//       payload: { ...results },
//     });
//   } catch (err) {
//     await errorService.reportError(err);

//     await activityService.createActivityLog(args.activityId, {
//       message: `Initial sync failed`,
//       level: LogLevel.Error,
//       timestamp: now(),
//     });

//     await syncService.handleSyncFailure(args.linkedAccountId, args.collectionKey, args.syncRunId);
//   }
// }

export async function triggerSync(args: SyncArgs): Promise<void> {
  const temporalRunId = Context.current().info.workflowExecution.runId;
  const syncRun = await syncService.createSyncRun({
    id: generateId(Resource.SyncRun),
    linked_account_id: args.linkedAccountId,
    collection_key: args.collectionKey,
    status: SyncRunStatus.Running,
    temporal_run_id: temporalRunId,
    records_added: 0,
    records_updated: 0,
    records_deleted: 0,
    created_at: now(),
    updated_at: now(),
  });

  if (!syncRun) {
    const err = new Error('Failed to create sync run in the database');
    await syncService.handleSyncFailure(args.linkedAccountId, args.collectionKey);
    return await errorService.reportError(err);
  }

  try {
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
      syncRunId: syncRun.id,
      lastSyncedAt: lastSyncedAt,
      temporalContext,
    });

    const registry = new Registry();
    await registry.syncProviderCollection(args.integrationKey, args.collectionKey, syncContext);

    const results = await syncContext.reportResults();
    await syncService.updateSyncRun(syncRun.id, {
      status: SyncRunStatus.Succeeded,
      ...results,
    });

    syncContext.finish();
    await syncService.updateSync(args.linkedAccountId, args.collectionKey, {
      last_synced_at: now(),
    });
  } catch (err) {
    await syncService.updateSyncRun(syncRun.id, {
      status: SyncRunStatus.Failed,
    });

    await syncService.handleSyncFailure(args.linkedAccountId, args.collectionKey);
    return await errorService.reportError(err);
  }
}

export async function triggerAction(args: ActionArgs): Promise<void> {
  return;
}

export async function reportFailure(args: SyncFailureArgs | ActionFailureArgs): Promise<void> {
  await errorService.reportError(args.err);

  let message: string = 'Activity failed';
  if (args.type === 'sync') {
    message = 'Sync failed';
  } else if (args.type === 'action') {
    message = 'Action failed';
  }

  if (
    args.err instanceof CancelledFailure ||
    args.err.cause instanceof TerminatedFailure ||
    args.err.cause?.name === 'TerminatedFailure'
  ) {
    message += ` due to cancellation`;
  } else if (
    args.err.cause instanceof TimeoutFailure ||
    args.err.cause?.name === 'TimeoutFailure'
  ) {
    if (args.err.cause.timeoutType === 3) {
      message += `, timeout exceeded ${args.defaultTimeout}`;
    } else {
      message += `, max attempts of ${args.maxAttempts} exceeded`;
    }
  }

  if (args.type === 'sync') {
    await syncService.handleSyncFailure(args.args.linkedAccountId, args.args.collectionKey);
    // surface error to the user
  } else if (args.type === 'action') {
    message = 'Action failed';
  }
}
