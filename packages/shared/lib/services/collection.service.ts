import { Collection, Connection } from '@prisma/client';
import ElasticClient from '../clients/elastic.client';
import { database } from '../utils/database';
import { MultimodalEmbeddingModel, SyncStatus, TextEmbeddingModel } from '../utils/enums';
import { now } from '../utils/helpers';
import { ImageSearchOptions, QueryOptions, UsageType } from '../utils/types';
import errorService from './error.service';
import recordService from './record.service';
import syncService from './sync.service';
import usageService from './usage.service';

class CollectionService {
  public async listCollections({
    integrationId,
    environmentId,
  }: {
    integrationId: string;
    environmentId: string;
  }): Promise<Collection[] | null> {
    try {
      const integration = await database.integration.findUnique({
        where: {
          id_environment_id: {
            id: integrationId,
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

  public async retrieveCollection({
    collectionKey,
    integrationId,
    environmentId,
  }: {
    collectionKey: string;
    integrationId: string;
    environmentId: string;
  }): Promise<Collection | null> {
    try {
      return await database.collection.findUnique({
        where: {
          unique_key_integration_id_environment_id: {
            unique_key: collectionKey,
            integration_id: integrationId,
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

  public async updateCollection({
    collectionKey,
    integrationId,
    environmentId,
    data,
  }: {
    collectionKey: string;
    integrationId: string;
    environmentId: string;
    data: Partial<Collection>;
  }): Promise<Collection | null> {
    try {
      return await database.collection.update({
        where: {
          unique_key_integration_id_environment_id: {
            unique_key: collectionKey,
            integration_id: integrationId,
            environment_id: environmentId,
          },
          deleted_at: null,
        },
        data: {
          ...data,
          configuration: data.configuration || undefined,
          updated_at: now(),
        },
      });
    } catch (err) {
      await errorService.reportError(err);
      return null;
    }
  }

  public async queryCollection({
    connection,
    providerKey,
    collectionKey,
    queryOptions,
  }: {
    connection: Connection;
    providerKey: string;
    collectionKey: string;
    queryOptions: QueryOptions;
  }) {
    try {
      const elastic = ElasticClient.getInstance();
      const results = await elastic.query({
        connection,
        collectionKey,
        providerKey,
        queryOptions,
      });

      usageService.reportUsage({
        usageType: UsageType.Query,
        queryType: 'text',
        environmentId: connection.environment_id,
        integrationId: connection.integration_id,
        connectionId: connection.id,
      });

      return results;
    } catch (err) {
      await errorService.reportError(err);
      return null;
    }
  }

  public async imageSearchCollection({
    connection,
    providerKey,
    collectionKey,
    imageSearchOptions,
  }: {
    connection: Connection;
    providerKey: string;
    collectionKey: string;
    imageSearchOptions: ImageSearchOptions;
  }) {
    try {
      const elastic = ElasticClient.getInstance();
      const results = await elastic.imageSearch({
        connection,
        providerKey,
        collectionKey,
        imageSearchOptions,
      });

      usageService.reportUsage({
        usageType: UsageType.Query,
        queryType: 'image',
        environmentId: connection.environment_id,
        integrationId: connection.integration_id,
        connectionId: connection.id,
      });

      return results;
    } catch (err) {
      await errorService.reportError(err);
      return null;
    }
  }

  public async createCollection(collection: Collection): Promise<Collection | null> {
    try {
      const newCollection = await database.collection.create({
        data: {
          ...collection,
          configuration: collection.configuration || undefined,
          created_at: now(),
          updated_at: now(),
        },
      });

      const collectionCreated = await this.createCollectionIndex({
        environmentId: newCollection.environment_id,
        integrationId: newCollection.integration_id,
        providerKey: newCollection.provider_key,
        collectionKey: newCollection.unique_key,
      });

      if (!collectionCreated) {
        throw new Error('Failed to create collection in Elastic');
      }

      return newCollection;
    } catch (err) {
      await errorService.reportError(err);
      return null;
    }
  }

  public async createCollectionIndex({
    environmentId,
    integrationId,
    providerKey,
    collectionKey,
  }: {
    environmentId: string;
    integrationId: string;
    providerKey: string;
    collectionKey: string;
  }): Promise<boolean> {
    try {
      const elastic = ElasticClient.getInstance();
      return await elastic.createIndex({
        environmentId,
        integrationId,
        providerKey,
        collectionKey,
      });
    } catch (err) {
      await errorService.reportError(err);
      return false;
    }
  }

  public async getCollectionModelSettings({
    integrationId,
    collectionKey,
    environmentId,
  }: {
    integrationId: string;
    collectionKey: string;
    environmentId: string;
  }): Promise<{
    textEmbeddingModel: TextEmbeddingModel;
    multimodalEmbeddingModel: MultimodalEmbeddingModel;
    multimodalEnabled: boolean;
  } | null> {
    try {
      const collection = await database.collection.findUnique({
        where: {
          unique_key_integration_id_environment_id: {
            unique_key: collectionKey,
            integration_id: integrationId,
            environment_id: environmentId,
          },
          deleted_at: null,
        },
      });

      if (!collection) {
        throw new Error('Failed to get default collection settings');
      }

      return {
        textEmbeddingModel: collection.text_embedding_model as TextEmbeddingModel,
        multimodalEmbeddingModel: collection.multimodal_embedding_model as MultimodalEmbeddingModel,
        multimodalEnabled: collection.multimodal_enabled,
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
          integration_id: collection.integration_id,
          collection_key: collection.unique_key,
          deleted_at: null,
        },
      });

      const shouldResync = syncs.filter((sync) => sync.last_synced_at !== null);
      const indexDeleted = await this.deleteCollectionIndex({
        environmentId: collection.environment_id,
        integrationId: collection.integration_id,
        collectionKey: collection.unique_key,
      });

      if (!indexDeleted) {
        return false;
      }

      const indexCreated = await this.createCollectionIndex({
        environmentId: collection.environment_id,
        integrationId: collection.integration_id,
        providerKey: collection.provider_key,
        collectionKey: collection.unique_key,
      });

      if (!indexCreated) {
        return false;
      }

      for (const sync of shouldResync) {
        await syncService.triggerSync(sync);
      }

      return true;
    } catch (err) {
      await errorService.reportError(err);
      return false;
    }
  }

  public async onCollectionDisabled(collection: Collection) {
    try {
      const syncs = await database.sync.findMany({
        where: {
          integration_id: collection.integration_id,
          collection_key: collection.unique_key,
          deleted_at: null,
        },
      });

      const shouldStop = syncs.filter((sync) => sync.status === SyncStatus.Running);
      for (const sync of shouldStop) {
        await syncService.stopSync(sync);
      }

      return true;
    } catch (err) {
      await errorService.reportError(err);
      return false;
    }
  }

  public async deleteCollectionIndex({
    environmentId,
    integrationId,
    collectionKey,
  }: {
    environmentId: string;
    integrationId: string;
    collectionKey: string;
  }): Promise<boolean> {
    try {
      const recordsDeleted = await recordService.deleteRecordsForCollection({
        integrationId,
        collectionKey,
        environmentId,
      });

      if (!recordsDeleted) {
        return false;
      }

      const elastic = ElasticClient.getInstance();
      const indexDeleted = await elastic.deleteIndex({
        environmentId,
        integrationId,
        collectionKey,
      });

      if (!indexDeleted) {
        return false;
      }

      const syncs = await syncService.listSyncsForCollection({
        integrationId,
        collectionKey,
      });

      if (!syncs) {
        return false;
      }

      await database.$transaction(
        syncs.map((sync) => {
          return database.sync.update({
            where: {
              collection_key_connection_id_integration_id: {
                collection_key: collectionKey,
                connection_id: sync.connection_id,
                integration_id: integrationId,
              },
            },
            data: { last_synced_at: null },
          });
        })
      );

      return true;
    } catch (err) {
      await errorService.reportError(err);
      return false;
    }
  }

  public async deleteCollection({
    environmentId,
    integrationId,
    collectionKey,
  }: {
    environmentId: string;
    integrationId: string;
    collectionKey: string;
  }): Promise<boolean> {
    try {
      const didDelete = await this.deleteCollectionIndex({
        environmentId,
        integrationId,
        collectionKey,
      });

      if (!didDelete) {
        return false;
      }

      await database.collection.update({
        where: {
          unique_key_integration_id_environment_id: {
            unique_key: collectionKey,
            integration_id: integrationId,
            environment_id: environmentId,
          },
        },
        data: { deleted_at: now() },
      });

      return true;
    } catch (err) {
      await errorService.reportError(err);
      return false;
    }
  }
}

export default new CollectionService();
