export interface SyncArgs {
  environmentId: string;
  integrationId: string;
  providerKey: string;
  connectionId: string;
  collectionKey: string;
}

export interface ActionArgs {
  environmentId: string;
  integrationId: string;
  providerKey: string;
  connectionId: string;
  actionKey: string;
  activityId: string | null;
}

export interface BaseFailureArgs {
  err: any;
  type: 'sync' | 'action';
  defaultTimeout: string;
  maxAttempts: number;
}

export interface SyncFailureArgs extends BaseFailureArgs {
  type: 'sync';
  args: SyncArgs;
}

export interface ActionFailureArgs extends BaseFailureArgs {
  type: 'action';
  args: ActionArgs;
}
