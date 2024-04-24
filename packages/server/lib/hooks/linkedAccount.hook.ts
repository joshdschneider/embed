import {
  LogLevel,
  activityService,
  collectionService,
  errorService,
  now,
  syncService,
  webhookService,
  type LinkedAccount,
} from '@embed/shared';

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
