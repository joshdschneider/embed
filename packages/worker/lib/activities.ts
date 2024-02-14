import { LogLevel, SyncType, activityService, errorService, now, syncService } from '@kit/shared';
import { Context } from '@temporalio/activity';
import { ActionArgs, ContinuousSyncArgs, InitialSyncArgs } from './types';

export async function runInitialSync(args: InitialSyncArgs): Promise<boolean | object | null> {
  const { environmentId, activityId, ...rest } = args;

  await activityService.createActivityLog(activityId, {
    message: `Starting initial sync for ${rest.linkedAccountId}`,
    level: LogLevel.Info,
    timestamp: now(),
    payload: { ...rest },
  });

  try {
    const context: Context = Context.current();
    const syncResults = await syncService.runSync({
      ...args,
      type: SyncType.Initial,
      context,
    });

    return await syncService.reportSyncResults(syncResults);
  } catch (err) {
    await errorService.reportError(err);

    await activityService.createActivityLog(activityId, {
      message: `Sync ${rest.syncId} failed to run`,
      level: LogLevel.Error,
      timestamp: now(),
      payload: { ...rest },
    });
  }

  return false;
}

export async function runContinuousSync(
  args: ContinuousSyncArgs
): Promise<boolean | object | null> {
  return false;
}

export async function executeAction(args: ActionArgs): Promise<boolean | object | null> {
  return false;
}

export async function reportFailure(
  err: unknown,
  args: InitialSyncArgs | ContinuousSyncArgs | ActionArgs,
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
