export interface SyncArgs {
  environmentId: string;
  integrationKey: string;
  linkedAccountId: string;
  collectionKey: string;
}

export interface ActionArgs {
  environmentId: string;
  integrationKey: string;
  linkedAccountId: string;
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
