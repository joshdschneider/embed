import { Collection, LinkedAccount } from '@prisma/client';
import ElasticClient from '../clients/elastic.client';
import { database } from '../utils/database';
import { MultimodalEmbeddingModel, TextEmbeddingModel } from '../utils/enums';
import { now } from '../utils/helpers';
import { ImageSearchOptions, QueryOptions } from '../utils/types';
import errorService from './error.service';
import linkedAccountService from './linkedAccount.service';
import recordService from './record.service';
import syncService from './sync.service';

class CollectionService {
  public async listCollections(
    integrationKey: string,
    environmentId: string
  ): Promise<Collection[] | null> {
    try {
      const integration = await database.integration.findUnique({
        where: {
          unique_key_environment_id: {
            unique_key: integrationKey,
            environment_id: environmentId,
          },
          deleted_at: null,
        },
        select: { collections: true },
      });

      if (!integration) {
        return null;
      }

      return integration.collections;
    } catch (err) {
      await errorService.reportError(err);
      return null;
    }
  }

  public async retrieveCollection(
    collectionKey: string,
    integrationKey: string,
    environmentId: string
  ): Promise<Collection | null> {
    try {
      return await database.collection.findUnique({
        where: {
          unique_key_integration_key_environment_id: {
            unique_key: collectionKey,
            integration_key: integrationKey,
            environment_id: environmentId,
          },
          deleted_at: null,
        },
      });
    } catch (err) {
      await errorService.reportError(err);
      return null;
    }
  }

  public async updateCollection(
    collectionKey: string,
    integrationKey: string,
    environmentId: string,
    data: Partial<Collection>
  ): Promise<Collection | null> {
    try {
      return await database.collection.update({
        where: {
          unique_key_integration_key_environment_id: {
            unique_key: collectionKey,
            integration_key: integrationKey,
            environment_id: environmentId,
          },
          deleted_at: null,
        },
        data: { ...data, updated_at: now() },
      });
    } catch (err) {
      await errorService.reportError(err);
      return null;
    }
  }

  public async queryCollection({
    linkedAccount,
    collectionKey,
    queryOptions,
  }: {
    linkedAccount: LinkedAccount;
    collectionKey: string;
    queryOptions: QueryOptions;
  }) {
    try {
      const elastic = ElasticClient.getInstance();
      return await elastic.query({
        linkedAccount,
        collectionKey,
        queryOptions,
      });
    } catch (err) {
      await errorService.reportError(err);
      return null;
    }
  }

  public async imageSearchCollection({
    linkedAccount,
    collectionKey,
    imageSearchOptions,
  }: {
    linkedAccount: LinkedAccount;
    collectionKey: string;
    imageSearchOptions: ImageSearchOptions;
  }) {
    try {
      const elastic = ElasticClient.getInstance();
      return await elastic.imageSearch({
        linkedAccount,
        collectionKey,
        imageSearchOptions,
      });
    } catch (err) {
      await errorService.reportError(err);
      return null;
    }
  }

  public async getCollectionModelSettings(
    environmentId: string,
    integrationKey: string,
    collectionKey: string
  ): Promise<{
    textEmbeddingModel: TextEmbeddingModel;
    multimodalEmbeddingModel: MultimodalEmbeddingModel;
    multimodalEnabled: boolean;
  } | null> {
    try {
      const collection = await database.collection.findUnique({
        where: {
          unique_key_integration_key_environment_id: {
            unique_key: collectionKey,
            integration_key: integrationKey,
            environment_id: environmentId,
          },
          deleted_at: null,
        },
        include: {
          integration: { select: { environment: true } },
        },
      });

      if (!collection) {
        throw new Error('Failed to get default collection settings');
      }

      const {
        text_embedding_model_override,
        multimodal_embedding_model_override,
        multimodal_enabled_override,
        integration,
      } = collection;

      const {
        default_text_embedding_model,
        default_multimodal_embedding_model,
        multimodal_enabled_by_default,
      } = integration.environment;

      const textEmbeddingModel = text_embedding_model_override || default_text_embedding_model;
      const multimodalEmbeddingModel =
        multimodal_embedding_model_override || default_multimodal_embedding_model;
      const multimodalEnabled = multimodal_enabled_override ?? multimodal_enabled_by_default;

      return {
        textEmbeddingModel: textEmbeddingModel as TextEmbeddingModel,
        multimodalEmbeddingModel: multimodalEmbeddingModel as MultimodalEmbeddingModel,
        multimodalEnabled,
      };
    } catch (err) {
      await errorService.reportError(err);
      return null;
    }
  }

  public async resyncCollection(collection: Collection): Promise<boolean> {
    try {
      const syncs = await database.sync.findMany({
        where: {
          environment_id: collection.environment_id,
          integration_key: collection.integration_key,
          collection_key: collection.unique_key,
          deleted_at: null,
        },
      });

      for (const sync of syncs) {
        const hasRecords = await recordService.hasRecords(
          sync.linked_account_id,
          sync.collection_key
        );

        const indexDeleted = await this.deleteCollectionIndex(
          sync.linked_account_id,
          sync.collection_key
        );

        if (!indexDeleted) {
          return false;
        }

        const indexCreated = await linkedAccountService.createIndexForLinkedAccount({
          environmentId: collection.environment_id,
          integrationKey: collection.integration_key,
          collectionKey: collection.unique_key,
          linkedAccountId: sync.linked_account_id,
        });

        if (!indexCreated) {
          return false;
        }

        if (hasRecords) {
          await syncService.triggerSync(sync);
        }
      }

      return true;
    } catch (err) {
      await errorService.reportError(err);
      return false;
    }
  }

  public async deleteCollectionIndex(
    linkedAccountId: string,
    collectionKey: string
  ): Promise<boolean> {
    try {
      const recordsDeleted = await recordService.deleteAllRecords(linkedAccountId, collectionKey);
      if (!recordsDeleted) {
        return false;
      }

      const elastic = ElasticClient.getInstance();
      const indexDeleted = await elastic.deleteIndex({
        linkedAccountId,
        collectionKey,
      });

      if (!indexDeleted) {
        return false;
      }

      await syncService.updateSync(linkedAccountId, collectionKey, {
        last_synced_at: null,
      });

      return true;
    } catch (err) {
      await errorService.reportError(err);
      return false;
    }
  }

  public async clearCollectionRecords(
    linkedAccountId: string,
    collectionKey: string
  ): Promise<boolean> {
    try {
      const recordsDeleted = await recordService.deleteAllRecords(linkedAccountId, collectionKey);
      if (!recordsDeleted) {
        return false;
      }

      const elastic = ElasticClient.getInstance();
      const objectsDeleted = await elastic.deleteAllObjects({
        linkedAccountId,
        collectionKey,
      });

      if (!objectsDeleted) {
        return false;
      }

      await syncService.updateSync(linkedAccountId, collectionKey, {
        last_synced_at: null,
      });

      return true;
    } catch (err) {
      await errorService.reportError(err);
      return false;
    }
  }
}

export default new CollectionService();
