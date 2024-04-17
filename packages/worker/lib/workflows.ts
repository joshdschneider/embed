import { proxyActivities } from '@temporalio/workflow';
import type * as activities from './activities.js';
import { ActionArgs, SyncArgs } from './types.js';

const DEFAULT_TIMEOUT = '24 hours';
const MAXIMUM_ATTEMPTS = 3;

const { triggerSync, triggerAction, reportFailure } = proxyActivities<typeof activities>({
  startToCloseTimeout: DEFAULT_TIMEOUT,
  scheduleToCloseTimeout: DEFAULT_TIMEOUT,
  heartbeatTimeout: '30m',
  retry: {
    initialInterval: '5m',
    maximumAttempts: MAXIMUM_ATTEMPTS,
  },
});

export async function sync(args: SyncArgs): Promise<void> {
  try {
    return await triggerSync(args);
  } catch (err: any) {
    return await reportFailure({
      err,
      type: 'sync',
      args,
      defaultTimeout: DEFAULT_TIMEOUT,
      maxAttempts: MAXIMUM_ATTEMPTS,
    });
  }
}

export async function action(args: ActionArgs): Promise<void> {
  try {
    return await triggerAction(args);
  } catch (err: any) {
    return await reportFailure({
      err,
      type: 'action',
      args,
      defaultTimeout: DEFAULT_TIMEOUT,
      maxAttempts: MAXIMUM_ATTEMPTS,
    });
  }
}
