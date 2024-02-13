import { proxyActivities } from '@temporalio/workflow';
import type * as activities from './activities.js';
import { InitialSyncArgs } from './types.js';

const DEFAULT_TIMEOUT = '24 hours';
const MAXIMUM_ATTEMPTS = 3;

const { routeSync, reportFailure } = proxyActivities<typeof activities>({
  startToCloseTimeout: DEFAULT_TIMEOUT,
  scheduleToCloseTimeout: DEFAULT_TIMEOUT,
  heartbeatTimeout: '30m',
  retry: {
    initialInterval: '5m',
    maximumAttempts: MAXIMUM_ATTEMPTS,
  },
});

export async function initialSync(args: InitialSyncArgs): Promise<boolean | object | null> {
  try {
    return await routeSync(args);
  } catch (err: any) {
    await reportFailure(err, args, DEFAULT_TIMEOUT, MAXIMUM_ATTEMPTS);
    return false;
  }
}
