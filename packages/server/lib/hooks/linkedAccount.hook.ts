import { LinkedAccount } from '@prisma/client';
import WorkerClient from '../clients/worker.client';
import errorService from '../services/error.service';
import integrationService from '../services/integration.service';
import webhookService from '../services/webhook.service';

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
    await webhookService.sendLinkedAccountCreatedWebhook({
      environmentId,
      linkedAccount,
      activityId,
    });

    try {
      const syncModels = await integrationService.getIntegrationSyncModels(
        linkedAccount.integration_provider,
        linkedAccount.environment_id
      );

      if (Array.isArray(syncModels)) {
        const enabledSyncModels = syncModels.filter((syncModel) => syncModel.is_enabled);
        if (enabledSyncModels.length > 0) {
          const worker = await WorkerClient.getInstance();
          if (worker) {
            worker.initiateSyncs(linkedAccount, enabledSyncModels);
          }
        }
      }
    } catch (err) {
      await errorService.reportError(err);
    }
  }
}

export default new LinkedAccountHook();
