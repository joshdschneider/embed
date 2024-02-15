export interface InitialSyncArgs {
  environmentId: string;
  linkedAccountId: string;
  integration: string;
  syncId: string;
  jobId: string;
  activityId: string | null;
}

export interface ContinuousSyncArgs {
  environmentId: string;
  linkedAccountId: string;
  integration: string;
  syncId: string;
  activityId: string | null;
}

export interface ActionArgs {
  environmentId: string;
  linkedAccountId: string;
  integration: string;
  action: string;
  activityId: string | null;
}
