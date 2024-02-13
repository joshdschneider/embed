import { LogLevel, activityService, errorService, now } from '@kit/shared';
import { Context } from '@temporalio/activity';
import { InitialSyncArgs } from './types';

export async function routeSync(args: InitialSyncArgs): Promise<boolean | object | null> {
  const { syncId, jobId, linkedAccountId, activityId } = args;

  const context: Context = Context.current();

  await activityService.createActivityLog(activityId, {
    message: `Starting initial sync for ${linkedAccountId}`,
    level: LogLevel.Info,
    timestamp: now(),
    payload: { syncId, jobId, linkedAccountId },
  });

  try {
    // run sync
  } catch (err) {
    await errorService.reportError(err);

    await activityService.createActivityLog(activityId, {
      message: `Sync ${syncId} failed to run`,
      level: LogLevel.Error,
      timestamp: now(),
      payload: { syncId, jobId, linkedAccountId },
    });
  }

  return true;
}

export async function reportFailure(
  error: unknown,
  args: InitialSyncArgs,
  defaultTimeout: string,
  maxAttempts: number
): Promise<void> {
  return;
}
