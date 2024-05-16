import { proxyActivities } from '@temporalio/workflow';
import type * as activities from './activities.js';
import { ActionArgs } from './types.js';

const DEFAULT_TIMEOUT = '1 hour';
const MAXIMUM_ATTEMPTS = 3;

const { triggerAction, reportFailure } = proxyActivities<typeof activities>({
  startToCloseTimeout: DEFAULT_TIMEOUT,
  scheduleToCloseTimeout: DEFAULT_TIMEOUT,
  heartbeatTimeout: '10m',
  retry: {
    initialInterval: '5m',
    maximumAttempts: MAXIMUM_ATTEMPTS,
  },
});

export async function action(args: ActionArgs): Promise<void> {
  try {
    return await triggerAction(args);
  } catch (err: any) {
    return await reportFailure({
      err,
      args,
      defaultTimeout: DEFAULT_TIMEOUT,
      maxAttempts: MAXIMUM_ATTEMPTS,
    });
  }
}
