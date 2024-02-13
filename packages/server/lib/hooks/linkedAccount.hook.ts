import type { LinkedAccount } from '@kit/shared';
import WorkerClient from '../clients/worker.client';
import errorService from '../services/error.service';
import integrationService from '../services/integration.service';
import syncService from '../services/sync.service';
import webhookService from '../services/webhook.service';
import { Resource, generateId, now } from '../utils/helpers';

class LinkedAccountHook {
  public async linkedAccountCreated({
    environmentId,
    linkedAccount,
    activityId,
  }: {
    environmentId: string;
    linkedAccount: LinkedAccount;
    activityId: string | null;
  }): Promise<void> {
    webhookService.sendLinkedAccountCreatedWebhook({
      environmentId,
      linkedAccount,
      activityId,
    });

    try {
      const syncModels = await integrationService.getIntegrationSyncModels(
        linkedAccount.integration_provider,
        linkedAccount.environment_id
      );

      if (!syncModels) {
        throw new Error(`Failed to get sync models for ${linkedAccount.integration_provider}`);
      }

      const enabledSyncModels = syncModels.filter((syncModel) => syncModel.is_enabled);
      if (enabledSyncModels.length === 0) {
        return;
      }

      const worker = await WorkerClient.getInstance();
      if (!worker) {
        throw new Error('Failed to initialize Temporal client');
      }

      for (const model of enabledSyncModels) {
        const sync = await syncService.createSync({
          id: generateId(Resource.Sync),
          linked_account_id: linkedAccount.id,
          model_id: model.id,
          frequency: model.frequency,
          created_at: now(),
          updated_at: now(),
          deleted_at: null,
        });

        if (!sync) {
          await errorService.reportError(
            new Error(`Failed to create sync for ${model.integration_provider} ${model.name}`)
          );
          continue;
        }

        await worker.startInitialSync(sync, model, linkedAccount);
      }
    } catch (err) {
      await errorService.reportError(err);
    }
  }

  public async linkedAccountUpdated({
    environmentId,
    linkedAccount,
    activityId,
  }: {
    environmentId: string;
    linkedAccount: LinkedAccount;
    activityId: string | null;
  }): Promise<void> {
    // todo
  }
}

export default new LinkedAccountHook();
