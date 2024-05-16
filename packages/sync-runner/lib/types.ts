export interface SyncArgs {
  environmentId: string;
  integrationId: string;
  providerKey: string;
  connectionId: string;
  collectionKey: string;
}

export interface SyncFailureArgs {
  err: any;
  defaultTimeout: string;
  maxAttempts: number;
  args: SyncArgs;
}
