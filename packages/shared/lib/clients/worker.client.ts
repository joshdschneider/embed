import { LinkedAccount, Sync, SyncModel } from '@prisma/client';
import { Connection, ScheduleOverlapPolicy, Client as TemporalClient } from '@temporalio/client';
import fs from 'fs';
import ms, { StringValue } from 'ms';
import activityService from '../services/activity.service';
import errorService from '../services/error.service';
import syncService from '../services/sync.service';
import { SYNC_TASK_QUEUE, getTemporalNamespace, getTemporalUrl, isProd } from '../utils/constants';
import {
  LogAction,
  LogLevel,
  Resource,
  ScheduleStatus,
  SyncStatus,
  SyncType,
} from '../utils/enums';
import { generateId, getFrequencyInterval, now } from '../utils/helpers';

const TEMPORAL_NAMESPACE = getTemporalNamespace();
const OVERLAP_POLICY = ScheduleOverlapPolicy.BUFFER_ONE;

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
                crt: fs.readFileSync(`/etc/secrets/${TEMPORAL_NAMESPACE}.crt`),
                key: fs.readFileSync(`/etc/secrets/${TEMPORAL_NAMESPACE}.key`),
              },
            }
          : false,
      });

      const client = new TemporalClient({
        connection,
        namespace: TEMPORAL_NAMESPACE,
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
      return await errorService.reportError(new Error('Temporal client not initialized'));
    }

    const syncJobId = generateId(Resource.SyncJob);

    await syncService.createSyncJob({
      id: syncJobId,
      sync_id: sync.id,
      status: syncModel.auto_start ? SyncStatus.Running : SyncStatus.Paused,
      type: SyncType.Initial,
      run_id: null,
      added: null,
      updated: null,
      deleted: null,
      created_at: now(),
      updated_at: now(),
      deleted_at: null,
    });

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
        action: LogAction.Sync,
        timestamp: now(),
      });
    }

    try {
      if (syncModel.auto_start) {
        const handle = await this.client.workflow.start('initialSync', {
          taskQueue: SYNC_TASK_QUEUE,
          workflowId: syncJobId,
          args: [
            {
              environmentId: linkedAccount.environment_id,
              linkedAccountId: linkedAccount.id,
              integration: linkedAccount.integration_provider,
              syncId: sync.id,
              syncJobId,
              activityId,
            },
          ],
        });

        await syncService.updateSyncJob(syncJobId, {
          run_id: handle.firstExecutionRunId,
        });

        await activityService.createActivityLog(activityId, {
          timestamp: now(),
          level: LogLevel.Info,
          message: `Initial sync started for model ${syncModel.name}`,
          payload: { sync_job_id: syncJobId },
        });
      }

      const { interval, offset, error } = getFrequencyInterval(
        syncModel.frequency as StringValue,
        new Date()
      );

      if (error !== null) {
        await activityService.createActivityLog(activityId, {
          timestamp: now(),
          level: LogLevel.Error,
          message: `Failed to start incremental sync schedule due to invalid frequency interval`,
        });

        return await errorService.reportError(new Error(error));
      }

      const scheduleId = generateId(Resource.Schedule);

      const scheduleHandle = await this.client.schedule.create({
        scheduleId,
        policies: { overlap: OVERLAP_POLICY },
        spec: { intervals: [{ every: interval, offset }] },
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
        frequency: interval,
        offset,
        status: syncModel.auto_start === false ? ScheduleStatus.Paused : ScheduleStatus.Running,
        created_at: now(),
        updated_at: now(),
        deleted_at: null,
      });

      if (syncModel.auto_start) {
        await activityService.createActivityLog(activityId, {
          timestamp: now(),
          level: LogLevel.Info,
          message: `Started incremental background sync with ${interval} frequency`,
          payload: { schedule_id: scheduleId, frequency: interval },
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

  public async startResync(
    sync: Sync,
    syncModel: SyncModel,
    linkedAccount: LinkedAccount
  ): Promise<void> {
    if (!this.client) {
      return await errorService.reportError(new Error('Temporal client not initialized'));
    }

    const syncJobs = (await syncService.listSyncJobs(sync.id)) || [];

    for (const job of syncJobs) {
      if (job.status === SyncStatus.Running) {
        await this.terminateInitialSync(job.id);
        await syncService.updateSyncJob(job.id, { status: SyncStatus.Stopped });
      } else if (job.status === SyncStatus.Paused) {
        await syncService.updateSyncJob(job.id, { status: SyncStatus.Stopped });
      }
    }

    const syncSchedules = (await syncService.listSyncSchedules(sync.id)) || [];

    for (const schedule of syncSchedules) {
      if (schedule.status === ScheduleStatus.Running) {
        await this.deleteSyncSchedule(schedule.id);
        await syncService.updateSyncSchedule(schedule.id, { status: ScheduleStatus.Stopped });
      }
    }

    return await this.startInitialSync(sync, syncModel, linkedAccount);
  }

  public async terminateInitialSync(syncJobId: string): Promise<boolean> {
    if (!this.client) {
      await errorService.reportError(new Error('Temporal client not initialized'));
      return false;
    }

    try {
      const syncJob = await syncService.getSyncJobById(syncJobId);
      if (!syncJob) {
        return false;
      }

      await this.client.workflow.workflowService.terminateWorkflowExecution({
        firstExecutionRunId: syncJob.run_id,
      });
      return true;
    } catch (err) {
      await errorService.reportError(err);
      return false;
    }
  }

  public async triggerSync(scheduleId: string): Promise<boolean> {
    if (!this.client) {
      await errorService.reportError(new Error('Temporal client not initialized'));
      return false;
    }

    try {
      const scheduleHandle = this.client.schedule.getHandle(scheduleId);
      await scheduleHandle.trigger(OVERLAP_POLICY);
      return true;
    } catch (err) {
      await errorService.reportError(err);
      return false;
    }
  }

  public async pauseSync(scheduleId: string): Promise<boolean> {
    if (!this.client) {
      await errorService.reportError(new Error('Temporal client not initialized'));
      return false;
    }

    try {
      const scheduleHandle = this.client.schedule.getHandle(scheduleId);
      await scheduleHandle.pause();
      return true;
    } catch (err) {
      await errorService.reportError(err);
      return false;
    }
  }

  public async unpauseSync(scheduleId: string): Promise<boolean> {
    if (!this.client) {
      await errorService.reportError(new Error('Temporal client not initialized'));
      return false;
    }

    try {
      const scheduleHandle = this.client.schedule.getHandle(scheduleId);
      await scheduleHandle.unpause();
      await scheduleHandle.trigger(OVERLAP_POLICY);
      const schedule = await syncService.getSyncScheduleById(scheduleId);
      if (schedule) {
        const frequency = schedule.frequency as StringValue;
        const { offset, error } = getFrequencyInterval(frequency, new Date());
        if (error === null) {
          await this.updateSyncSchedule(scheduleId, frequency, offset);
          await syncService.updateSyncSchedule(scheduleId, { offset });
        }
      }
      return true;
    } catch (err) {
      await errorService.reportError(err);
      return false;
    }
  }

  public async describeSyncSchedule(scheduleId: string) {
    if (!this.client) {
      await errorService.reportError(new Error('Temporal client not initialized'));
      return null;
    }

    try {
      return await this.client.workflowService.describeSchedule({
        scheduleId,
        namespace: TEMPORAL_NAMESPACE,
      });
    } catch (err) {
      await errorService.reportError(err);
      return null;
    }
  }

  public async updateSyncSchedule(
    scheduleId: string,
    interval: StringValue,
    offset: number
  ): Promise<boolean> {
    if (!this.client) {
      await errorService.reportError(new Error('Temporal client not initialized'));
      return false;
    }

    try {
      const scheduleHandle = this.client.schedule.getHandle(scheduleId);
      await scheduleHandle.update((prev) => {
        prev.spec = {
          intervals: [{ every: ms(interval), offset }],
        };
        return prev;
      });
      return true;
    } catch (err) {
      await errorService.reportError(err);
      return false;
    }
  }

  public async deleteSyncSchedule(scheduleId: string): Promise<boolean> {
    if (!this.client) {
      await errorService.reportError(new Error('Temporal client not initialized'));
      return false;
    }

    try {
      await this.client.workflowService.deleteSchedule({
        scheduleId,
        namespace: TEMPORAL_NAMESPACE,
      });
      return true;
    } catch (err) {
      await errorService.reportError(err);
      return false;
    }
  }

  public async triggerAction() {
    throw new Error('Not implemented');
  }
}

export default WorkerClient;
