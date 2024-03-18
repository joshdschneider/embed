import { collectionService, type LinkedAccount } from '@embed/shared';
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
    webhookService.sendLinkedAccountWebhook({
      environmentId,
      linkedAccount,
      activityId,
      action: 'created',
    });

    const collections = await collectionService.listCollections(linkedAccount.id, environmentId);

    // linkedAccountService.initiatePostLinkSyncs({
    //   linkedAccount,
    //   activityId,
    //   action: 'created',
    // });
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
    webhookService.sendLinkedAccountWebhook({
      environmentId,
      linkedAccount,
      activityId,
      action: 'updated',
    });

    // linkedAccountService.initiatePostLinkSyncs({
    //   linkedAccount,
    //   activityId,
    //   action: 'updated',
    // });
  }
}

export default new LinkedAccountHook();
