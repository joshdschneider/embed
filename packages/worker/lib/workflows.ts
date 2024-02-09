import { proxyActivities } from '@temporalio/workflow';
import type * as activities from './activities.js';

const DEFAULT_TIMEOUT = '24 hours';
const MAXIMUM_ATTEMPTS = 3;

const { lottery } = proxyActivities<typeof activities>({
  startToCloseTimeout: DEFAULT_TIMEOUT,
  scheduleToCloseTimeout: DEFAULT_TIMEOUT,
  retry: {
    initialInterval: '5m',
    maximumAttempts: MAXIMUM_ATTEMPTS,
  },
  heartbeatTimeout: '30m',
});

export async function playLottery(args: { guess: number }): Promise<boolean> {
  try {
    return await lottery(args);
  } catch (err: any) {
    return false;
  }
}
