import { Client as Elastic } from '@elastic/elasticsearch';
import {
  IndicesCreateRequest,
  MappingProperty,
  SearchHit,
} from '@elastic/elasticsearch/lib/api/types';
import { Connection } from '@prisma/client';
import collectionService from '../services/collection.service';
import errorService from '../services/error.service';
import providerService from '../services/provider.service';
import { getElasticApiKey, getElasticApiKeyId, getElasticEndpoint } from '../utils/constants';
import { ImageSearchOptions, QueryOptions, SourceObjectWithHash } from '../utils/types';
import { EmbeddingClient } from './embedding.client';
import { IndexClient } from './index.client';
import { QueryClient } from './query.client';

class ElasticClient {
  private static instance: ElasticClient;
  private elastic: Elastic;
  private embeddings: EmbeddingClient;
  private queries: QueryClient;

  private constructor(elastic: Elastic, embeddings: EmbeddingClient, queries: QueryClient) {
    this.elastic = elastic;
    this.embeddings = embeddings;
    this.queries = queries;
  }

  static getInstance(): ElasticClient {
    if (!this.instance) {
      this.instance = this.create();
    }

    return this.instance;
  }

  private static create(): ElasticClient {
    const elasticEndpoint = getElasticEndpoint();
    const elasticApiKeyId = getElasticApiKeyId();
    const elasticApiKey = getElasticApiKey();

    if (!elasticEndpoint) {
      throw new Error('Elastic URL not set');
    } else if (!elasticApiKeyId) {
      throw new Error('Elastic API key ID not set');
    } else if (!elasticApiKey) {
      throw new Error('Elastic API key not set');
    }

    const elastic = new Elastic({
      node: elasticEndpoint,
      auth: { apiKey: { id: elasticApiKeyId, api_key: elasticApiKey } },
    });

    const embeddings = new EmbeddingClient();
    const queries = new QueryClient(elastic, embeddings);
    return new ElasticClient(elastic, embeddings, queries);
  }

  public static formatIndexName(
    environmentId: string,
    integrationId: string,
    collectionKey: string
  ) {
    return `${environmentId}.${integrationId}.${collectionKey}`;
  }

  public async query({
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
    const indexName = ElasticClient.formatIndexName(
      connection.environment_id,
      connection.integration_id,
      collectionKey
    );

    const providerCollection = await providerService.getProviderCollection(
      providerKey,
      collectionKey
    );

    if (!providerCollection) {
      throw new Error(`Failed to get collection ${collectionKey} for provider ${providerKey}`);
    }

    const schemaProperties = providerCollection.schema.properties;

    if (!queryOptions?.query) {
      return this.queries.emptyQuery({
        connectionId: connection.id,
        indexName,
        schemaProperties,
        queryOptions,
      });
    }

    if (
      queryOptions.type === 'keyword' ||
      (queryOptions.type === 'hybrid' && queryOptions.alpha === 0)
    ) {
      return this.queries.keywordQuery({
        connectionId: connection.id,
        indexName,
        schemaProperties,
        queryOptions,
      });
    }

    const modelSettings = await collectionService.getCollectionModelSettings({
      collectionKey,
      integrationId: connection.integration_id,
      environmentId: connection.environment_id,
    });

    if (!modelSettings) {
      throw new Error('Failed to get collection model settings');
    }

    const { textEmbeddingModel, multimodalEmbeddingModel } = modelSettings;

    if (
      queryOptions.type === 'vector' ||
      (queryOptions.type === 'hybrid' && queryOptions.alpha === 1)
    ) {
      return this.queries.vectorQuery({
        connectionId: connection.id,
        indexName,
        schemaProperties,
        queryOptions,
        textEmbeddingModel,
        multimodalEmbeddingModel,
      });
    }

    return this.queries.hybridQuery({
      connectionId: connection.id,
      indexName,
      schemaProperties,
      queryOptions,
      textEmbeddingModel,
      multimodalEmbeddingModel,
    });
  }

  public async imageSearch({
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
    const indexName = ElasticClient.formatIndexName(
      connection.environment_id,
      connection.integration_id,
      collectionKey
    );

    const collection = await providerService.getProviderCollection(providerKey, collectionKey);
    if (!collection) {
      throw new Error(`Failed to get collection ${collectionKey} for provider ${providerKey}`);
    }

    const returnProperties = imageSearchOptions.returnProperties;
    const schemaProperties = collection.schema.properties;
    const modelSettings = await collectionService.getCollectionModelSettings({
      collectionKey,
      integrationId: connection.integration_id,
      environmentId: connection.environment_id,
    });

    if (!modelSettings) {
      throw new Error('Failed to get collection model settings');
    }

    const { multimodalEmbeddingModel } = modelSettings;

    return this.queries.imageSearch({
      connectionId: connection.id,
      indexName,
      schemaProperties,
      returnProperties,
      imageSearchOptions,
      multimodalEmbeddingModel,
    });
  }

  public async createIndex({
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
      const modelSettings = await collectionService.getCollectionModelSettings({
        collectionKey,
        integrationId,
        environmentId,
      });

      if (!modelSettings) {
        throw new Error('Failed to get collection model settings');
      }

      const providerCollection = await providerService.getProviderCollection(
        providerKey,
        collectionKey
      );

      if (!providerCollection) {
        throw new Error(`Failed to get collection schema for ${collectionKey}`);
      }

      const properties: [string, MappingProperty][] = [
        ['connection_id', { type: 'keyword', index: false }],
        ['hash', { type: 'keyword', index: false }],
      ];

      for (const [schemaName, schemaProps] of Object.entries(
        providerCollection.schema.properties
      )) {
        properties.push(
          ...IndexClient.transformProperty(
            schemaName,
            schemaProps,
            modelSettings.textEmbeddingModel,
            modelSettings.multimodalEmbeddingModel
          )
        );
      }

      const indexName = ElasticClient.formatIndexName(environmentId, integrationId, collectionKey);
      const index: IndicesCreateRequest = {
        index: indexName,
        mappings: {
          dynamic: 'strict',
          properties: Object.fromEntries(properties),
        },
      };

      const res = await this.elastic.indices.create(index);
      return res.acknowledged;
    } catch (err) {
      await errorService.reportError(err);
      return false;
    }
  }

  public async batchUpsertObjects({
    connectionId,
    integrationId,
    environmentId,
    collectionKey,
    objects,
  }: {
    connectionId: string;
    integrationId: string;
    environmentId: string;
    collectionKey: string;
    objects: SourceObjectWithHash[];
  }): Promise<boolean> {
    if (!objects || objects.length === 0) {
      return true;
    }

    try {
      const indexName = ElasticClient.formatIndexName(environmentId, integrationId, collectionKey);
      const operations = objects.flatMap((obj) => [
        { index: { _index: indexName } },
        { ...obj, connection_id: connectionId },
      ]);

      const bulkResponse = await this.elastic.bulk({
        refresh: true,
        operations,
      });

      return bulkResponse.errors === false;
    } catch (err) {
      await errorService.reportError(err);
      return false;
    }
  }

  public async updateObjects({
    connectionId,
    integrationId,
    environmentId,
    providerKey,
    collectionKey,
    objects,
  }: {
    connectionId: string;
    integrationId: string;
    environmentId: string;
    providerKey: string;
    collectionKey: string;
    objects: SourceObjectWithHash[];
  }): Promise<boolean> {
    if (!objects || objects.length === 0) {
      return true;
    }

    try {
      const indexName = ElasticClient.formatIndexName(environmentId, integrationId, collectionKey);
      const results = await this.elastic.search({
        index: indexName,
        query: {
          bool: {
            must: { terms: { 'id.keyword': objects.map((obj) => obj.id) } },
            filter: { term: { connection_id: connectionId } },
          },
        },
        _source: ['id'],
      });

      const matchingObjects = results.hits.hits.map((hit: SearchHit<any>) => ({
        _id: hit._id,
        id: hit._source.id,
      }));

      if (matchingObjects.length !== objects.length) {
        throw new Error('Mismatch between objects to update and objects found in index');
      }

      const operations: object[] = [];
      for (const { id, _id } of matchingObjects) {
        const obj = objects.find((obj) => obj.id === id);
        if (obj) {
          operations.push({ update: { _index: indexName, _id } });
          operations.push({ doc: { ...obj, connection_id: connectionId } });
        }
      }

      const bulkResponse = await this.elastic.bulk({
        refresh: true,
        operations,
      });

      return bulkResponse.errors === false;
    } catch (err) {
      await errorService.reportError(err);
      return false;
    }
  }

  public async deleteObjects({
    environmentId,
    integrationId,
    collectionKey,
    connectionId,
    objectIds,
  }: {
    environmentId: string;
    integrationId: string;
    collectionKey: string;
    connectionId: string;
    objectIds: string[];
  }): Promise<boolean> {
    if (!objectIds || objectIds.length === 0) {
      return true;
    }

    try {
      const indexName = ElasticClient.formatIndexName(environmentId, integrationId, collectionKey);
      const response = await this.elastic.deleteByQuery({
        index: indexName,
        query: {
          bool: {
            must: { terms: { 'id.keyword': objectIds } },
            filter: { term: { connection_id: connectionId } },
          },
        },
      });

      return response.failures?.length === 0;
    } catch (err) {
      await errorService.reportError(err);
      return false;
    }
  }

  public async deleteObjectsForConnection({
    environmentId,
    integrationId,
    collectionKey,
    connectionId,
  }: {
    environmentId: string;
    integrationId: string;
    collectionKey: string;
    connectionId: string;
  }): Promise<boolean> {
    try {
      const indexName = ElasticClient.formatIndexName(environmentId, integrationId, collectionKey);
      const response = await this.elastic.deleteByQuery({
        index: indexName,
        query: { term: { connection_id: connectionId } },
      });

      return response.failures?.length === 0;
    } catch (err) {
      await errorService.reportError(err);
      return false;
    }
  }

  public async deleteIndex({
    environmentId,
    integrationId,
    collectionKey,
  }: {
    environmentId: string;
    integrationId: string;
    collectionKey: string;
  }): Promise<boolean> {
    try {
      const indexName = ElasticClient.formatIndexName(environmentId, integrationId, collectionKey);
      const response = await this.elastic.indices.delete({ index: indexName });
      return response.acknowledged;
    } catch (err) {
      await errorService.reportError(err);
      return false;
    }
  }
}

export default ElasticClient;
