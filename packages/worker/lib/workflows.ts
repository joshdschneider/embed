import { proxyActivities } from '@temporalio/workflow';
import type * as activities from './activities.js';
import { ActionArgs, IncrementalSyncArgs, InitialSyncArgs } from './types.js';

const DEFAULT_TIMEOUT = '24 hours';
const MAXIMUM_ATTEMPTS = 3;

const { runInitialSync, runIncrementalSync, triggerAction, reportFailure } = proxyActivities<
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

export async function initialSync(args: InitialSyncArgs): Promise<void> {
  try {
    return await runInitialSync(args);
  } catch (err: any) {
    return await reportFailure(err, args, DEFAULT_TIMEOUT, MAXIMUM_ATTEMPTS);
  }
}

export async function incrementalSync(args: IncrementalSyncArgs): Promise<void> {
  try {
    return await runIncrementalSync(args);
  } catch (err: any) {
    return await reportFailure(err, args, DEFAULT_TIMEOUT, MAXIMUM_ATTEMPTS);
  }
}

export async function action(args: ActionArgs): Promise<void> {
  try {
    return await triggerAction(args);
  } catch (err: any) {
    return await reportFailure(err, args, DEFAULT_TIMEOUT, MAXIMUM_ATTEMPTS);
  }
}
