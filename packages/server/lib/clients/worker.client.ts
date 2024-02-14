import type { LinkedAccount, Sync, SyncModel } from '@kit/shared';
import {
  LogAction,
  LogLevel,
  Resource,
  SYNC_TASK_QUEUE,
  ScheduleStatus,
  SyncStatus,
  SyncType,
  activityService,
  errorService,
  generateId,
  getTemporalNamespace,
  getTemporalUrl,
  isProd,
  now,
} from '@kit/shared';
import { Connection, ScheduleOverlapPolicy, Client as TemporalClient } from '@temporalio/client';
import fs from 'fs';
import ms, { StringValue } from 'ms';
import syncService from '../services/sync.service';

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

  public async startInitialSync(
    sync: Sync,
    syncModel: SyncModel,
    linkedAccount: LinkedAccount
  ): Promise<void> {
    if (!this.client) {
      await errorService.reportError(new Error('Failed to initialize Temporal client'));
      return;
    }

    let activityId: string | null = null;

    if (syncModel.auto_start) {
      activityId = await activityService.createActivity({
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
    }

    try {
      const job = await syncService.createSyncJob({
        id: generateId(Resource.SyncJob),
        sync_id: sync.id,
        status: syncModel.auto_start ? SyncStatus.Running : SyncStatus.Paused,
        type: SyncType.Initial,
        run_id: null,
      });

      if (!job) {
        throw new Error(`Failed to create sync job for sync ${sync.id}`);
      }

      if (syncModel.auto_start) {
        const handle = await this.client.workflow.start('initialSync', {
          taskQueue: SYNC_TASK_QUEUE,
          workflowId: job.id,
          args: [
            {
              environmentId: linkedAccount.environment_id,
              linkedAccountId: linkedAccount.id,
              integration: linkedAccount.integration_provider,
              syncId: sync.id,
              jobId: job.id,
              activityId,
            },
          ],
        });

        await syncService.updateSyncJob(job.id, {
          run_id: handle.firstExecutionRunId,
        });

        await activityService.createActivityLog(activityId, {
          timestamp: now(),
          level: LogLevel.Info,
          message: 'Initial sync started',
          payload: { sync_job_id: job.id },
        });
      }

      const { interval, offset } = this.getInterval(syncModel.frequency as StringValue, new Date());
      const scheduleId = generateId(Resource.Schedule);

      const scheduleHandle = await this.client.schedule.create({
        scheduleId,
        policies: {
          overlap: ScheduleOverlapPolicy.BUFFER_ONE,
        },
        spec: {
          intervals: [{ every: interval, offset }],
        },
        action: {
          type: 'startWorkflow',
          workflowType: 'continuousSync',
          taskQueue: SYNC_TASK_QUEUE,
          args: [
            {
              environmentId: linkedAccount.environment_id,
              linkedAccountId: linkedAccount.id,
              integration: linkedAccount.integration_provider,
              syncId: sync.id,
              activityId,
            },
          ],
        },
      });

      if (!syncModel.auto_start) {
        await scheduleHandle.pause();
      }

      await syncService.createSyncSchedule({
        id: scheduleId,
        sync_id: sync.id,
        sync_job_id: job.id,
        frequency: interval,
        offset,
        status: syncModel.auto_start === false ? ScheduleStatus.Paused : ScheduleStatus.Running,
      });

      if (syncModel.auto_start) {
        await activityService.createActivityLog(activityId, {
          timestamp: now(),
          level: LogLevel.Info,
          message: 'Initial sync started',
          payload: { sync_job_id: job.id },
        });
      }
    } catch (err) {
      await errorService.reportError(err);

      await activityService.createActivityLog(activityId, {
        timestamp: now(),
        level: LogLevel.Error,
        message: 'Internal server error',
      });
    }
  }

  private getInterval(frequency: StringValue, date: Date) {
    if (ms(frequency) < ms('5m')) {
      throw new Error('Sync interval is too short');
    }

    if (!ms(frequency)) {
      throw new Error('Invalid sync interval');
    }

    const intervalMs = ms(frequency);
    const nowMs = date.getMinutes() * 60 * 1000 + date.getSeconds() * 1000 + date.getMilliseconds();
    const offset = nowMs % intervalMs;

    if (isNaN(offset)) {
      throw new Error('Invalid sync interval');
    }

    return { interval: frequency, offset: offset };
  }
}

export default WorkerClient;
