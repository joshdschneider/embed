import { Collection, collectionService } from '@embed/shared';

class CollectionHook {
  public async collectionUpdated({
    initialCollection,
    updatedCollection,
  }: {
    initialCollection: Collection;
    updatedCollection: Collection;
  }): Promise<void> {
    if (
      initialCollection.is_enabled !== updatedCollection.is_enabled &&
      !updatedCollection.is_enabled
    ) {
      await collectionService.onCollectionDisabled(updatedCollection);
    }

    let shouldResync = false;
    if (initialCollection.text_embedding_model !== updatedCollection.text_embedding_model) {
      shouldResync = true;
    }

    if (
      initialCollection.multimodal_embedding_model !== updatedCollection.multimodal_embedding_model
    ) {
      shouldResync = true;
    }

    if (initialCollection.multimodal_enabled !== updatedCollection.multimodal_enabled) {
      shouldResync = true;
    }

    if (
      JSON.stringify(initialCollection.exclude_properties_from_syncs) !==
      JSON.stringify(updatedCollection.exclude_properties_from_syncs)
    ) {
      shouldResync = true;
    }

    if (shouldResync) {
      await collectionService.resyncCollection(updatedCollection);
    }
  }
}

export default new CollectionHook();
