import { Client, Connection, ScheduleHandle, ScheduleOverlapPolicy } from '@temporalio/client';
import fs from 'fs';
import ms, { StringValue } from 'ms';
import errorService from '../services/error.service';
import {
  SYNC_TASK_QUEUE,
  getTemporalCertPath,
  getTemporalKeyPath,
  getTemporalNamespace,
  getTemporalUrl,
  isProd,
} from '../utils/constants';
import { IncrementalSyncArgs, InitialSyncArgs } from '../utils/types';

const TEMPORAL_URL = getTemporalUrl();
const TEMPORAL_NAMESPACE = getTemporalNamespace();
const TEMPORAL_CERT_PATH = getTemporalCertPath();
const TEMPORAL_KEY_PATH = getTemporalKeyPath();
const OVERLAP_POLICY = ScheduleOverlapPolicy.BUFFER_ONE;

class TemporalClient {
  private static instance: Promise<TemporalClient>;
  private client: Client;

  private constructor(client: Client) {
    this.client = client;
  }

  static getInstance(): Promise<TemporalClient> {
    if (!this.instance) {
      this.instance = this.create();
    }

    return this.instance;
  }

  private static async create(): Promise<TemporalClient> {
    if (!TEMPORAL_URL) {
      throw new Error('Temporal URL not set');
    } else if (!TEMPORAL_NAMESPACE) {
      throw new Error('Temporal namespace not set');
    } else if (isProd()) {
      if (!TEMPORAL_CERT_PATH) {
        throw new Error('Temporal cert path not set');
      } else if (!TEMPORAL_KEY_PATH) {
        throw new Error('Temporal key path not set');
      }
    }

    const connection = await Connection.connect({
      address: TEMPORAL_URL,
      tls: isProd()
        ? {
            clientCertPair: {
              crt: fs.readFileSync(TEMPORAL_CERT_PATH!),
              key: fs.readFileSync(TEMPORAL_KEY_PATH!),
            },
          }
        : false,
    });

    const client = new Client({
      connection,
      namespace: TEMPORAL_NAMESPACE,
    });

    return new TemporalClient(client);
  }

  public async startInitialSync(syncRunId: string, args: InitialSyncArgs): Promise<string | null> {
    try {
      const handle = await this.client.workflow.start('initialSync', {
        taskQueue: SYNC_TASK_QUEUE,
        workflowId: syncRunId,
        args: [{ ...args }],
      });

      return handle.firstExecutionRunId;
    } catch (err) {
      await errorService.reportError(err);
      return null;
    }
  }

  public async triggerIncrementalSync(
    syncRunId: string,
    args: IncrementalSyncArgs
  ): Promise<string | null> {
    try {
      const handle = await this.client.workflow.start('incrementalSync', {
        taskQueue: SYNC_TASK_QUEUE,
        workflowId: syncRunId,
        args: [{ ...args }],
      });

      return handle.firstExecutionRunId;
    } catch (err) {
      await errorService.reportError(err);
      return null;
    }
  }

  public async createSyncSchedule(
    scheduleId: string,
    interval: StringValue,
    offset: number,
    args: IncrementalSyncArgs
  ): Promise<ScheduleHandle | null> {
    try {
      return await this.client.schedule.create({
        scheduleId,
        policies: { overlap: OVERLAP_POLICY },
        spec: { intervals: [{ every: ms(interval), offset }] },
        action: {
          type: 'startWorkflow',
          workflowType: 'incrementalSync',
          taskQueue: SYNC_TASK_QUEUE,
          args: [{ ...args }],
        },
      });
    } catch (err) {
      await errorService.reportError(err);
      return null;
    }
  }

  public async getSyncSchedule(scheduleId: string) {
    try {
      return this.client.schedule.getHandle(scheduleId);
    } catch (err) {
      await errorService.reportError(err);
      return null;
    }
  }

  public async terminateSyncRun(runId: string): Promise<boolean> {
    try {
      await this.client.workflow.workflowService.terminateWorkflowExecution({
        firstExecutionRunId: runId,
      });
      return true;
    } catch (err) {
      await errorService.reportError(err);
      return false;
    }
  }

  public async triggerSyncSchedule(scheduleId: string): Promise<boolean> {
    try {
      const scheduleHandle = this.client.schedule.getHandle(scheduleId);
      await scheduleHandle.trigger(OVERLAP_POLICY);
      return true;
    } catch (err) {
      await errorService.reportError(err);
      return false;
    }
  }

  public async pauseSyncSchedule(scheduleId: string): Promise<boolean> {
    try {
      const scheduleHandle = this.client.schedule.getHandle(scheduleId);
      await scheduleHandle.pause();
      return true;
    } catch (err) {
      await errorService.reportError(err);
      return false;
    }
  }

  public async unpauseSyncSchedule(scheduleId: string): Promise<boolean> {
    try {
      const scheduleHandle = this.client.schedule.getHandle(scheduleId);
      await scheduleHandle.unpause();
      return true;
    } catch (err) {
      await errorService.reportError(err);
      return false;
    }
  }

  public async describeSyncSchedule(scheduleId: string) {
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

export default TemporalClient;
