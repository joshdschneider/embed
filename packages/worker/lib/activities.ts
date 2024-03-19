import { Registry } from '@embed/providers';
import { LogLevel, SyncContext, activityService, errorService, now } from '@embed/shared';
import { Context } from '@temporalio/activity';
import { ActionArgs, IncrementalSyncArgs, InitialSyncArgs } from './types';

export async function runInitialSync(args: InitialSyncArgs): Promise<boolean | object | null> {
  await activityService.createActivityLog(args.activityId, {
    message: `Starting initial sync`,
    level: LogLevel.Info,
    timestamp: now(),
    payload: {
      integration: args.integrationKey,
      linked_account: args.linkedAccountId,
      collection: args.collectionKey,
    },
  });

  try {
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
    await syncContext.finish();

    await activityService.createActivityLog(args.activityId, {
      message: `Initial sync finished successfully`,
      level: LogLevel.Info,
      timestamp: now(),
      payload: { ...results },
    });

    return true;
  } catch (err) {
    await errorService.reportError(err);

    await activityService.createActivityLog(args.activityId, {
      message: `Initial sync failed`,
      level: LogLevel.Error,
      timestamp: now(),
      payload: {
        integration: args.integrationKey,
        linked_account: args.linkedAccountId,
        collection: args.collectionKey,
      },
    });

    return false;
  }
}

export async function runIncrementalSync(
  args: IncrementalSyncArgs
): Promise<boolean | object | null> {
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

  try {
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
    await syncContext.finish();

    await activityService.createActivityLog(args.activityId, {
      message: `Initial sync finished successfully`,
      level: LogLevel.Info,
      timestamp: now(),
      payload: { ...results },
    });

    return true;
  } catch (err) {
    await errorService.reportError(err);

    await activityService.createActivityLog(args.activityId, {
      message: `Incremental sync failed`,
      level: LogLevel.Error,
      timestamp: now(),
      payload: {
        integration: args.integrationKey,
        linked_account: args.linkedAccountId,
        collection: args.collectionKey,
      },
    });

    return false;
  }
}

export async function executeAction(args: ActionArgs): Promise<boolean | object | null> {
  return false;
}

export async function reportFailure(
  err: unknown,
  args: InitialSyncArgs | IncrementalSyncArgs | ActionArgs,
  defaultTimeout: string,
  maxAttempts: number
): Promise<false> {
  await errorService.reportError(err);

  const { environmentId, activityId, ...rest } = args;

  let type = 'Activity';
  if ('syncId' in args) {
    type = 'Sync';
  } else if ('action' in args) {
    type = 'Action';
  }

  await activityService.createActivityLog(args.activityId, {
    message: `${type} failed for linked account ${rest.linkedAccountId}`,
    level: LogLevel.Error,
    timestamp: now(),
    payload: { ...rest, defaultTimeout, maxAttempts },
  });

  return false;
}
