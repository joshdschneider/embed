import { LinkedAccount } from '@prisma/client';
import WorkerClient from '../clients/worker.client';
import errorService from '../services/error.service';
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
    try {
      /**
        Execute post-link function
        - If model sync frequency is real-time
        - Get unique ID(s) for mapping from provider
        - Create webhook on provider
        - Save mapping on linked account
        - Process incoming webhooks with mapping lookup
       */

      const worker = await WorkerClient.getInstance();
      if (worker) {
        worker.initiateSync(linkedAccount.id);
      }

      await webhookService.sendLinkedAccountCreatedWebhook({
        environmentId,
        linkedAccount,
        activityId,
      });
    } catch (err) {
      await errorService.reportError(err);
    }
  }
}

export default new LinkedAccountHook();
