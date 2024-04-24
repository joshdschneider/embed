import { Environment, collectionService, errorService, integrationService } from '@embed/shared';

class EnvironmentHook {
  public async environmentUpdated(environment: Environment, changedKeys: string[]) {
    const integrations = await integrationService.listIntegrations(environment.id);
    if (!integrations) {
      errorService.reportError(new Error('Failed to list integrations'));
      return;
    }

    for (const integration of integrations) {
      if (!integration.is_enabled) {
        continue;
      }

      const collections = await collectionService.listCollections(
        integration.unique_key,
        environment.id
      );

      if (!collections) {
        const err = new Error(`Failed to list collections for ${integration.unique_key}`);
        errorService.reportError(err);
        continue;
      } else if (collections.length === 0) {
        continue;
      }

      for (const collection of collections) {
        let shouldResync = false;
        if (
          changedKeys.includes('default_multimodal_embedding_model') &&
          !collection.multimodal_embedding_model_override
        ) {
          shouldResync = true;
        }

        if (
          changedKeys.includes('default_text_embedding_model') &&
          !collection.text_embedding_model_override
        ) {
          shouldResync = true;
        }

        if (
          changedKeys.includes('multimodal_enabled_by_default') &&
          !collection.multimodal_enabled_override &&
          environment.multimodal_enabled_by_default === true
        ) {
          shouldResync = true;
        }

        if (shouldResync) {
          await collectionService.resyncCollection(collection);
        }
      }
    }
  }
}

export default new EnvironmentHook();
