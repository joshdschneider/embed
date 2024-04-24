import { Registry } from '@embed/providers';
import {
  ActionArgs,
  LogAction,
  LogLevel,
  Resource,
  SyncArgs,
  SyncContext,
  SyncRunStatus,
  activityService,
  collectionService,
  errorService,
  generateId,
  now,
  syncService,
} from '@embed/shared';
import { CancelledFailure, Context } from '@temporalio/activity';
import { TerminatedFailure, TimeoutFailure } from '@temporalio/workflow';
import { ActionFailureArgs, SyncFailureArgs } from './types';

export async function triggerSync(args: SyncArgs): Promise<void> {
  const activityId = await activityService.createActivity({
    id: generateId(Resource.Activity),
    environment_id: args.environmentId,
    integration_key: args.integrationKey,
    linked_account_id: args.linkedAccountId,
    link_token_id: null,
    action_key: null,
    collection_key: args.collectionKey,
    level: LogLevel.Info,
    action: LogAction.SyncRun,
    timestamp: now(),
  });

  const sync = await syncService.retrieveSync(args.linkedAccountId, args.collectionKey);
  if (!sync) {
    await activityService.createActivityLog(activityId, {
      message: 'Sync failed',
      level: LogLevel.Error,
      timestamp: now(),
      payload: { error: 'Sync does not exist' },
    });

    const err = new Error('Sync not found in the database');
    return await errorService.reportError(err);
  }

  await activityService.createActivityLog(activityId, {
    message: 'Sync started',
    level: LogLevel.Info,
    timestamp: now(),
    payload: {
      integration: args.integrationKey,
      collection: args.collectionKey,
      linked_account: args.linkedAccountId,
    },
  });

  const temporalRunId = Context.current().info.workflowExecution.runId;
  const syncRun = await syncService.createSyncRun({
    id: generateId(Resource.SyncRun),
    linked_account_id: sync.linked_account_id,
    collection_key: sync.collection_key,
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
      message: 'Sync failed',
      level: LogLevel.Error,
      timestamp: now(),
      payload: { error: 'Internal server error' },
    });

    await syncService.handleSyncFailure({ sync, activityId });
    const err = new Error('Failed to create sync run in the database');
    return await errorService.reportError(err);
  }

  try {
    const temporalContext: Context = Context.current();
    const modelSettings = await collectionService.getCollectionModelSettings(
      sync.environment_id,
      sync.integration_key,
      sync.collection_key
    );

    if (!modelSettings) {
      throw new Error('Failed to get collection model settings');
    }

    const lastSyncedAt = await syncService.getLastSyncedAt(
      sync.linked_account_id,
      sync.collection_key
    );

    const syncContext = new SyncContext({
      environmentId: sync.environment_id,
      linkedAccountId: sync.linked_account_id,
      integrationKey: sync.integration_key,
      collectionKey: sync.collection_key,
      activityId: activityId,
      multimodalEnabled: modelSettings.multimodalEnabled,
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
    await syncService.handleSyncSuccess({ sync, activityId, results });
    await activityService.createActivityLog(activityId, {
      message: 'Sync completed',
      level: LogLevel.Info,
      timestamp: now(),
      payload: results,
    });
  } catch (err) {
    await syncService.updateSyncRun(syncRun.id, { status: SyncRunStatus.Failed });
    await activityService.createActivityLog(activityId, {
      message: 'Sync failed',
      level: LogLevel.Error,
      timestamp: now(),
      payload: { error: 'Internal server error' },
    });

    await syncService.handleSyncFailure({ sync, activityId });
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
    const sync = await syncService.retrieveSync(args.args.linkedAccountId, args.args.collectionKey);
    if (sync) {
      await syncService.handleSyncFailure({
        sync,
        reason: message,
        activityId: null,
      });
    }
  } else if (args.type === 'action') {
    message = 'Action failed';
  }
}
