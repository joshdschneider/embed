import { LinkedAccount, Sync, SyncModel } from '@prisma/client';
import { Connection, Client as TemporalClient } from '@temporalio/client';
import fs from 'fs';
import activityService from '../services/activity.service';
import errorService from '../services/error.service';
import syncService from '../services/sync.service';
import { LogAction, LogLevel, SyncStatus, SyncType } from '../types';
import { SYNC_TASK_QUEUE, getTemporalNamespace, getTemporalUrl, isProd } from '../utils/constants';
import { Resource, generateId, now } from '../utils/helpers';

const namespace = getTemporalNamespace();

class WorkerClient {
  private static instance: Promise<WorkerClient | null>;
  private client: TemporalClient | null = null;

  private constructor(client: TemporalClient) {
    this.client = client;
  }

  static getInstance(): Promise<WorkerClient | null> {
    if (!this.instance) {
      this.instance = this.create();
    }

    return this.instance;
  }

  private static async create(): Promise<WorkerClient | null> {
    try {
      const connection = await Connection.connect({
        address: getTemporalUrl(),
        tls: isProd()
          ? {
              clientCertPair: {
                crt: fs.readFileSync(`/etc/secrets/${namespace}.crt`),
                key: fs.readFileSync(`/etc/secrets/${namespace}.key`),
              },
            }
          : false,
      });

      const client = new TemporalClient({
        connection,
        namespace,
      });

      return new WorkerClient(client);
    } catch (err) {
      await errorService.reportError(err);
      return null;
    }
  }

  public async initiateSyncs(linkedAccount: LinkedAccount, syncModels: SyncModel[]): Promise<void> {
    try {
      for (const syncModel of syncModels) {
        const sync = await syncService.createSync({
          id: generateId(Resource.Sync),
          linked_account_id: linkedAccount.id,
          model_id: syncModel.id,
          frequency: syncModel.frequency,
          created_at: now(),
          updated_at: now(),
          deleted_at: null,
        });

        if (!sync) {
          throw new Error(
            `Failed to create sync for ${syncModel.integration_provider} ${syncModel.name}`
          );
        }

        // Check frequency and auto-start
      }
    } catch (err) {
      await errorService.reportError(err);
    }
  }

  private async startInitialSync(sync: Sync, linkedAccount: LinkedAccount): Promise<void> {
    if (!this.client) {
      const err = new Error('Failed to initialize Temporal client');
      await errorService.reportError(err);
      return;
    }

    const activityId = await activityService.createActivity({
      id: generateId(Resource.Activity),
      environment_id: linkedAccount.environment_id,
      integration_provider: linkedAccount.integration_provider,
      linked_account_id: linkedAccount.id,
      sync_id: sync.id,
      link_token_id: null,
      action_id: null,
      level: LogLevel.Info,
      action: LogAction.Link,
      timestamp: now(),
    });

    try {
      const job = await syncService.createSyncJob({
        id: generateId(Resource.SyncJob),
        sync_id: sync.id,
        status: SyncStatus.Running,
        type: SyncType.Initial,
        run_id: null,
      });

      if (!job) {
        throw new Error(`Failed to create sync job for sync ${sync.id}`);
      }

      const handle = await this.client.workflow.start('initialSync', {
        taskQueue: SYNC_TASK_QUEUE,
        workflowId: job.id,
        args: [
          {
            syncId: sync.id,
            linkedAccountId: linkedAccount.id,
            activityId,
          },
        ],
      });

      await syncService.updateSyncJob(job.id, { run_id: handle.firstExecutionRunId });
    } catch (err) {
      await errorService.reportError(err);

      await activityService.createActivityLog(activityId, {
        timestamp: now(),
        level: LogLevel.Error,
        message: 'Internal server error',
      });
    }
  }
}

export default WorkerClient;
