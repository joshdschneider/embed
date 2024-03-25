export interface SyncArgs {
  environmentId: string;
  integrationKey: string;
  linkedAccountId: string;
  collectionKey: string;
  syncRunId: string;
  lastSyncedAt: number | null;
  activityId: string | null;
}

export type InitialSyncArgs = SyncArgs;

export type IncrementalSyncArgs = SyncArgs;

export interface ActionArgs {
  environmentId: string;
  integrationKey: string;
  linkedAccountId: string;
  actionKey: string;
  activityId: string | null;
}
