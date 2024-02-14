import { proxyActivities } from '@temporalio/workflow';
import type * as activities from './activities.js';
import { ActionArgs, ContinuousSyncArgs, InitialSyncArgs } from './types.js';

const DEFAULT_TIMEOUT = '24 hours';
const MAXIMUM_ATTEMPTS = 3;

const { runInitialSync, runContinuousSync, executeAction, reportFailure } = proxyActivities<
  typeof activities
>({
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
    return await runInitialSync(args);
  } catch (err: any) {
    return await reportFailure(err, args, DEFAULT_TIMEOUT, MAXIMUM_ATTEMPTS);
  }
}

export async function continuousSync(args: ContinuousSyncArgs): Promise<boolean | object | null> {
  try {
    return await runContinuousSync(args);
  } catch (e: any) {
    return await reportFailure(e, args, DEFAULT_TIMEOUT, MAXIMUM_ATTEMPTS);
  }
}

export async function action(args: ActionArgs): Promise<boolean | object | null> {
  try {
    return await executeAction(args);
  } catch (e: any) {
    return await reportFailure(e, args, DEFAULT_TIMEOUT, MAXIMUM_ATTEMPTS);
  }
}
