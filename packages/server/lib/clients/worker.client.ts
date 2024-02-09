import { LinkedAccount } from '@prisma/client';
import { Connection, Client as TemporalClient } from '@temporalio/client';
import fs from 'fs';
import errorService from '../services/error.service';
import integrationService from '../services/integration.service';
import syncService from '../services/sync.service';
import { getTemporalNamespace, getTemporalUrl, isProd } from '../utils/constants';
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

  public async initiateSync(linkedAccount: LinkedAccount): Promise<void> {
    try {
      if (!this.client) {
        throw new Error('Failed to initialize Temporal client');
      }

      const integration = await integrationService.getIntegrationByProvider(
        linkedAccount.integration_provider,
        linkedAccount.environment_id
      );

      if (!integration) {
        throw new Error(`Failed to retrieve ${linkedAccount.integration_provider} integration`);
      }

      const syncModels = await integrationService.getIntegrationSyncModels(
        linkedAccount.integration_provider,
        linkedAccount.environment_id
      );

      if (!syncModels) {
        throw new Error(
          `Failed to retrieve sync models for ${linkedAccount.integration_provider} integration`
        );
      }

      const enabledSyncModels = syncModels.filter((syncModel) => syncModel.is_enabled);

      for (const syncModel of enabledSyncModels) {
        const sync = await syncService.createSync({
          id: generateId(Resource.Sync),
          linked_account_id: linkedAccount.id,
          model_id: syncModel.id,
          frequency: syncModel.sync_frequency || integration.sync_frequency || 'provider default',
          created_at: now(),
          updated_at: now(),
          deleted_at: null,
        });

        if (sync) {
          await this.client.workflow.start('syncModel', {
            taskQueue: 'syncs',
            workflowId: sync.id,
            args: [
              {
                syncId: sync.id,
                linkedAccountId: linkedAccount.id,
              },
            ],
          });
        }
      }
    } catch (err) {
      await errorService.reportError(err);
    }
  }
}

export default WorkerClient;
