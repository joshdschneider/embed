import { collectionService, syncService, type LinkedAccount } from '@embed/shared';
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

    const collections = await collectionService.listCollections(
      linkedAccount.integration_key,
      environmentId
    );

    if (!collections) {
      throw new Error('Failed to retrieve collections from database');
    }

    collections.map((collection) => {
      return syncService.initializeSync({
        linkedAccountId: linkedAccount.id,
        collection,
        activityId,
      });
    });
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

    const collections = await collectionService.listCollections(
      linkedAccount.integration_key,
      environmentId
    );

    if (!collections) {
      throw new Error('Failed to retrieve collections from database');
    }

    collections.map((collection) => {
      return syncService.initializeSync({
        linkedAccountId: linkedAccount.id,
        collection,
        activityId,
      });
    });
  }
}

export default new LinkedAccountHook();
