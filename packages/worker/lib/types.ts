export interface InitialSyncArgs {
  environmentId: string;
  integrationKey: string;
  linkedAccountId: string;
  collectionKey: string;
  syncRunId: string;
  lastSyncedAt: number | null;
  activityId: string | null;
}

export interface IncrementalSyncArgs {
  environmentId: string;
  integrationKey: string;
  linkedAccountId: string;
  collectionKey: string;
  syncRunId: string;
  lastSyncedAt: number | null;
  activityId: string | null;
}

export interface ActionArgs {
  environmentId: string;
  integrationKey: string;
  linkedAccountId: string;
  actionKey: string;
  activityId: string | null;
}
