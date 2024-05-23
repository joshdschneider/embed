import { Client as Elastic } from '@elastic/elasticsearch';
import {
  IndicesCreateRequest,
  MappingProperty,
  SearchHit,
} from '@elastic/elasticsearch/lib/api/types';
import { CollectionProperty } from '@embed/providers';
import { Connection } from '@prisma/client';
import collectionService from '../services/collection.service';
import errorService from '../services/error.service';
import providerService from '../services/provider.service';
import { getElasticApiKey, getElasticApiKeyId, getElasticEndpoint } from '../utils/constants';
import { MultimodalEmbeddingModel, TextEmbeddingModel } from '../utils/enums';
import { deconstructObject, reconstructObject } from '../utils/helpers';
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

    const modelSettings = await collectionService.getCollectionModelSettings(
      connection.integration_id,
      collectionKey
    );

    if (!modelSettings) {
      throw new Error('Failed to get collection model settings');
    }

    const { textEmbeddingModel, multimodalEmbeddingModel, multimodalEnabled } = modelSettings;

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
        multimodalEnabled,
      });
    }

    return this.queries.hybridQuery({
      connectionId: connection.id,
      indexName,
      schemaProperties,
      queryOptions,
      textEmbeddingModel,
      multimodalEmbeddingModel,
      multimodalEnabled,
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
    const modelSettings = await collectionService.getCollectionModelSettings(
      connection.integration_id,
      collectionKey
    );

    if (!modelSettings) {
      throw new Error('Failed to get collection model settings');
    }

    const { multimodalEmbeddingModel, multimodalEnabled } = modelSettings;
    if (!multimodalEnabled) {
      throw new Error('Multimodal search is not enabled for this collection');
    }

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
      const modelSettings = await collectionService.getCollectionModelSettings(
        integrationId,
        collectionKey
      );

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

  private async vectorizeObject({
    textEmbeddingModel,
    multimodalEmbeddingModel,
    schemaProperties,
    obj,
  }: {
    textEmbeddingModel: TextEmbeddingModel;
    multimodalEmbeddingModel: MultimodalEmbeddingModel;
    schemaProperties: Record<string, CollectionProperty>;
    obj: Record<string, any>;
  }): Promise<Record<string, any>> {
    const objProperties = deconstructObject(obj);

    const textProperties: [string, any][] = [];
    const multimodalProperties: [string, any][] = [];

    for (const [k, v] of objProperties) {
      if (!v) {
        continue;
      }

      const path = k.split('.').shift()!;
      const property = schemaProperties[path];

      if (property && property.type === 'string' && property.vector_searchable) {
        if (property.multimodal) {
          multimodalProperties.push([k, v]);
        } else {
          textProperties.push([k, v]);
        }
      } else if (property && property.type === 'nested' && property.properties) {
        let nestedPath = k.split('.')[1]!;
        if (!isNaN(Number(nestedPath))) {
          nestedPath = k.split('.')[2]!;
        }

        const nestedProperty = property.properties[nestedPath];
        if (
          nestedProperty &&
          nestedProperty.type === 'string' &&
          nestedProperty.vector_searchable
        ) {
          if (nestedProperty.multimodal) {
            multimodalProperties.push([k, v]);
          } else {
            textProperties.push([k, v]);
          }
        }
      }
    }

    if (textProperties.length === 0 && multimodalProperties.length === 0) {
      return obj;
    }

    const textValues = textProperties.map(([k, v]) => v);
    const multimodalValues = multimodalProperties.map(([k, v]) => v);

    let textVectorsPromise;
    let multimodalVectorsPromise;

    if (textValues.length > 0) {
      textVectorsPromise = this.embeddings.embedText({
        model: textEmbeddingModel,
        text: textValues,
        purpose: 'object',
      });
    }

    if (multimodalValues.length > 0) {
      multimodalVectorsPromise = this.embeddings.embedMultimodal({
        model: multimodalEmbeddingModel,
        content: multimodalValues,
        type: 'images',
      });
    }

    const [textVectors, multimodalVectors] = await Promise.all([
      textVectorsPromise,
      multimodalVectorsPromise,
    ]);

    const textVectorProperties: [string, any][] = [];
    const multimodalVectorProperties: [string, any][] = [];

    if (textVectors) {
      textProperties.forEach(([k, v], i) => {
        textVectorProperties.push([`${k}_vector`, textVectors[i]]);
      });
    }

    if (multimodalVectors) {
      multimodalProperties.forEach(([k, v], i) => {
        multimodalVectorProperties.push([`${k}_vector`, multimodalVectors[i]]);
      });
    }

    return reconstructObject([
      ...objProperties,
      ...textVectorProperties,
      ...multimodalVectorProperties,
    ]);
  }

  public async batchUpsertObjects({
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
      const providerCollection = await providerService.getProviderCollection(
        providerKey,
        collectionKey
      );

      if (!providerCollection) {
        throw new Error(`Failed to get collection schema for ${collectionKey}`);
      }

      const modelSettings = await collectionService.getCollectionModelSettings(
        integrationId,
        collectionKey
      );

      if (!modelSettings) {
        throw new Error('Failed to get collection model settings');
      }

      const { textEmbeddingModel, multimodalEmbeddingModel } = modelSettings;
      const schemaProperties = providerCollection.schema.properties;
      const vectorizedObjects: Record<string, any>[] = [];

      for (const obj of objects) {
        const vectorizedObject = await this.vectorizeObject({
          textEmbeddingModel,
          multimodalEmbeddingModel,
          schemaProperties,
          obj,
        });

        vectorizedObjects.push(vectorizedObject);
      }

      const indexName = ElasticClient.formatIndexName(environmentId, integrationId, collectionKey);
      const operations = vectorizedObjects.flatMap((obj) => [
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

  public async upsertObject({
    connectionId,
    integrationId,
    environmentId,
    providerKey,
    collectionKey,
    object,
  }: {
    connectionId: string;
    integrationId: string;
    environmentId: string;
    providerKey: string;
    collectionKey: string;
    object: SourceObjectWithHash;
  }): Promise<boolean> {
    try {
      const providerCollection = await providerService.getProviderCollection(
        providerKey,
        collectionKey
      );

      if (!providerCollection) {
        throw new Error(`Failed to get collection schema for ${collectionKey}`);
      }

      const modelSettings = await collectionService.getCollectionModelSettings(
        integrationId,
        collectionKey
      );

      if (!modelSettings) {
        throw new Error('Failed to get collection model settings');
      }

      const { textEmbeddingModel, multimodalEmbeddingModel } = modelSettings;
      const schemaProperties = providerCollection.schema.properties;

      const vectorObj = await this.vectorizeObject({
        textEmbeddingModel,
        multimodalEmbeddingModel,
        schemaProperties,
        obj: object,
      });

      const indexName = ElasticClient.formatIndexName(environmentId, integrationId, collectionKey);
      const response = await this.elastic.index({
        index: indexName,
        document: { ...vectorObj, connection_id: connectionId },
      });

      return response.result === 'created' || response.result === 'updated';
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
      const providerCollection = await providerService.getProviderCollection(
        providerKey,
        collectionKey
      );

      if (!providerCollection) {
        throw new Error(`Failed to get collection schema for ${collectionKey}`);
      }

      const modelSettings = await collectionService.getCollectionModelSettings(
        integrationId,
        collectionKey
      );

      if (!modelSettings) {
        throw new Error('Failed to get collection model settings');
      }

      const { textEmbeddingModel, multimodalEmbeddingModel } = modelSettings;
      const schemaProperties = providerCollection.schema.properties;
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
        const obj = objects.find((obj) => obj.id === id)!;
        const vectorObj = await this.vectorizeObject({
          textEmbeddingModel,
          multimodalEmbeddingModel,
          schemaProperties,
          obj,
        });

        operations.push({ update: { _index: indexName, _id } });
        operations.push({ doc: { ...vectorObj, connection_id: connectionId } });
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
