import { InitialSyncArgs } from './types';

export async function routeSync(args: InitialSyncArgs): Promise<boolean | object | null> {
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
