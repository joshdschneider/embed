import { Integration, collectionService, errorService } from '@embed/shared';

class IntegrationHook {
  public async onIntegrationDisabled(integration: Integration): Promise<void> {
    if (!integration.is_enabled) {
      return;
    }

    const collections = await collectionService.listCollections({
      integrationId: integration.id,
      environmentId: integration.environment_id,
    });

    if (!collections) {
      return await errorService.reportError(
        new Error('Failed to retrieve collections from database')
      );
    }

    for (const collection of collections) {
      await collectionService.updateCollection({
        integrationId: integration.id,
        environmentId: integration.environment_id,
        collectionKey: collection.unique_key,
        data: { is_enabled: false },
      });

      await collectionService.onCollectionDisabled(collection);
    }
  }
}

export default new IntegrationHook();
