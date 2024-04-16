import { Collection, LinkedAccount } from '@prisma/client';
import ElasticClient from '../clients/elastic.client';
import { database } from '../utils/database';
import { now } from '../utils/helpers';
import { ImageSearchOptions, QueryOptions } from '../utils/types';
import errorService from './error.service';

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
}

export default new CollectionService();
