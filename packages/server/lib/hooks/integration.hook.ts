import { Integration, collectionService, errorService } from '@embed/shared';

class IntegrationHook {
  public async onIntegrationDisabled(integration: Integration): Promise<void> {
    if (!integration.is_enabled) {
      return;
    }

    const collections = await collectionService.listCollections(integration.id);
    if (!collections) {
      return await errorService.reportError(
        new Error('Failed to retrieve collections from database')
      );
    }

    for (const collection of collections) {
      await collectionService.updateCollection(collection.unique_key, integration.id, {
        is_enabled: false,
      });

      await collectionService.onCollectionDisabled(collection);
    }
  }
}

export default new IntegrationHook();
