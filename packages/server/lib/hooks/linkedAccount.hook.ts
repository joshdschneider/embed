import {
  LogLevel,
  activityService,
  collectionService,
  errorService,
  linkedAccountService,
  now,
  syncService,
  type LinkedAccount,
} from '@embed/shared';
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
      await activityService.createActivityLog(activityId, {
        level: LogLevel.Error,
        message: `Failed to create collections for linked account`,
        timestamp: now(),
      });

      return await errorService.reportError(
        new Error('Failed to retrieve collections from database')
      );
    }

    let createdCollections: string[] = [];
    let failedCollections: string[] = [];

    for (const collection of collections) {
      const didCreateTenant = await linkedAccountService.createIndexForLinkedAccount(
        linkedAccount.id,
        linkedAccount.integration_key,
        collection.unique_key
      );

      if (!didCreateTenant) {
        failedCollections.push(collection.unique_key);
      } else {
        createdCollections.push(collection.unique_key);
      }
    }

    if (createdCollections.length > 0) {
      await activityService.createActivityLog(activityId, {
        level: LogLevel.Info,
        message: `${createdCollections.length} collection(s) created for linked account`,
        timestamp: now(),
        payload: { linked_account: linkedAccount.id, collections: createdCollections },
      });
    }

    if (failedCollections.length > 0) {
      await activityService.createActivityLog(activityId, {
        level: LogLevel.Error,
        message: `Failed to create ${failedCollections.length} collection(s) for linked account`,
        timestamp: now(),
        payload: { linked_account: linkedAccount.id, collections: failedCollections },
      });
    }

    for (const collection of collections) {
      syncService.initializeSync({
        linkedAccountId: linkedAccount.id,
        collection,
        activityId,
      });
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
      await activityService.createActivityLog(activityId, {
        level: LogLevel.Error,
        message: `Failed to create collections for linked account`,
        timestamp: now(),
      });

      return await errorService.reportError(
        new Error('Failed to retrieve collections from database')
      );
    }

    for (const collection of collections) {
      syncService.initializeSync({
        linkedAccountId: linkedAccount.id,
        collection,
        activityId,
      });
    }
  }
}

export default new LinkedAccountHook();
