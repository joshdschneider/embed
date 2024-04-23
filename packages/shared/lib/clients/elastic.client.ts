import { Client as Elastic } from '@elastic/elasticsearch';
import {
  IndicesCreateRequest,
  MappingProperty,
  SearchHit,
} from '@elastic/elasticsearch/lib/api/types';
import { CollectionProperty } from '@embed/providers';
import { LinkedAccount } from '@prisma/client';
import collectionService from '../services/collection.service';
import errorService from '../services/error.service';
import providerService from '../services/provider.service';
import { getElasticApiKey, getElasticApiKeyId, getElasticUrl } from '../utils/constants';
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
    const elasticUrl = getElasticUrl();
    const elasticApiKeyId = getElasticApiKeyId();
    const elasticApiKey = getElasticApiKey();

    if (!elasticUrl) {
      throw new Error('Elastic URL not set');
    } else if (!elasticApiKeyId) {
      throw new Error('Elastic API key ID not set');
    } else if (!elasticApiKey) {
      throw new Error('Elastic API key not set');
    }

    const elastic = new Elastic({
      node: elasticUrl,
      auth: {
        apiKey: {
          id: elasticApiKeyId,
          api_key: elasticApiKey,
        },
      },
    });

    const embeddings = new EmbeddingClient();
    const queries = new QueryClient(elastic, embeddings);

    return new ElasticClient(elastic, embeddings, queries);
  }

  public static formatIndexName(linkedAccountId: string, collectionKey: string) {
    return `${linkedAccountId}-${collectionKey}`;
  }

  public async query({
    linkedAccount,
    collectionKey,
    queryOptions,
  }: {
    linkedAccount: LinkedAccount;
    collectionKey: string;
    queryOptions: QueryOptions;
  }) {
    const indexName = ElasticClient.formatIndexName(linkedAccount.id, collectionKey);
    const providerCollection = await providerService.getProviderCollection(
      linkedAccount.integration_key,
      collectionKey
    );

    if (!providerCollection) {
      throw new Error(
        `Failed to get collection ${collectionKey} for provider ${linkedAccount.integration_key}`
      );
    }

    const schemaProperties = providerCollection.schema.properties;

    if (!queryOptions?.query) {
      return this.queries.emptyQuery({
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
        indexName,
        schemaProperties,
        queryOptions,
      });
    }

    const modelSettings = await collectionService.getCollectionModelSettings(
      linkedAccount.environment_id,
      linkedAccount.integration_key,
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
        indexName,
        schemaProperties,
        queryOptions,
        textEmbeddingModel,
        multimodalEmbeddingModel,
        multimodalEnabled,
      });
    }

    return this.queries.hybridQuery({
      indexName,
      schemaProperties,
      queryOptions,
      textEmbeddingModel,
      multimodalEmbeddingModel,
      multimodalEnabled,
    });
  }

  public async imageSearch({
    linkedAccount,
    collectionKey,
    imageSearchOptions,
  }: {
    linkedAccount: LinkedAccount;
    collectionKey: string;
    imageSearchOptions: ImageSearchOptions;
  }) {
    const indexName = ElasticClient.formatIndexName(linkedAccount.id, collectionKey);
    const collection = await providerService.getProviderCollection(
      linkedAccount.integration_key,
      collectionKey
    );

    if (!collection) {
      throw new Error(
        `Failed to get collection ${collectionKey} for provider ${linkedAccount.integration_key}`
      );
    }

    const returnProperties = imageSearchOptions.returnProperties;
    const schemaProperties = collection.schema.properties;
    const modelSettings = await collectionService.getCollectionModelSettings(
      linkedAccount.environment_id,
      linkedAccount.integration_key,
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
      indexName,
      schemaProperties,
      returnProperties,
      imageSearchOptions,
      multimodalEmbeddingModel,
    });
  }

  public async indexExists(index: string) {
    return this.elastic.indices.exists({ index });
  }

  public async createIndex({
    environmentId,
    linkedAccountId,
    integrationKey,
    collectionKey,
  }: {
    environmentId: string;
    linkedAccountId: string;
    integrationKey: string;
    collectionKey: string;
  }): Promise<boolean> {
    try {
      const modelSettings = await collectionService.getCollectionModelSettings(
        environmentId,
        integrationKey,
        collectionKey
      );

      if (!modelSettings) {
        throw new Error('Failed to get collection model settings');
      }

      const providerCollection = await providerService.getProviderCollection(
        integrationKey,
        collectionKey
      );

      if (!providerCollection) {
        throw new Error(`Failed to get collection schema for ${collectionKey}`);
      }

      const properties: [string, MappingProperty][] = [['hash', { type: 'keyword', index: false }]];
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

      const indexName = ElasticClient.formatIndexName(linkedAccountId, collectionKey);
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
    linkedAccountId,
    integrationKey,
    environmentId,
    collectionKey,
    objects,
  }: {
    linkedAccountId: string;
    integrationKey: string;
    environmentId: string;
    collectionKey: string;
    objects: SourceObjectWithHash[];
  }): Promise<boolean> {
    if (!objects || objects.length === 0) {
      return true;
    }

    try {
      const providerCollection = await providerService.getProviderCollection(
        integrationKey,
        collectionKey
      );

      if (!providerCollection) {
        throw new Error(`Failed to get collection schema for ${collectionKey}`);
      }

      const modelSettings = await collectionService.getCollectionModelSettings(
        environmentId,
        integrationKey,
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

      const indexName = ElasticClient.formatIndexName(linkedAccountId, collectionKey);
      const operations = vectorizedObjects.flatMap((obj) => [
        { index: { _index: indexName } },
        obj,
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
    linkedAccountId,
    integrationKey,
    environmentId,
    collectionKey,
    object,
  }: {
    linkedAccountId: string;
    integrationKey: string;
    environmentId: string;
    collectionKey: string;
    object: SourceObjectWithHash;
  }): Promise<boolean> {
    try {
      const providerCollection = await providerService.getProviderCollection(
        integrationKey,
        collectionKey
      );

      if (!providerCollection) {
        throw new Error(`Failed to get collection schema for ${collectionKey}`);
      }

      const modelSettings = await collectionService.getCollectionModelSettings(
        environmentId,
        integrationKey,
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

      const indexName = ElasticClient.formatIndexName(linkedAccountId, collectionKey);

      const response = await this.elastic.index({
        index: indexName,
        document: vectorObj,
      });

      return response.result === 'created' || response.result === 'updated';
    } catch (err) {
      await errorService.reportError(err);
      return false;
    }
  }

  public async updateObjects({
    linkedAccountId,
    integrationKey,
    environmentId,
    collectionKey,
    objects,
  }: {
    linkedAccountId: string;
    integrationKey: string;
    environmentId: string;
    collectionKey: string;
    objects: SourceObjectWithHash[];
  }): Promise<boolean> {
    if (!objects || objects.length === 0) {
      return true;
    }

    try {
      const providerCollection = await providerService.getProviderCollection(
        integrationKey,
        collectionKey
      );

      if (!providerCollection) {
        throw new Error(`Failed to get collection schema for ${collectionKey}`);
      }

      const modelSettings = await collectionService.getCollectionModelSettings(
        environmentId,
        integrationKey,
        collectionKey
      );

      if (!modelSettings) {
        throw new Error('Failed to get collection model settings');
      }

      const { textEmbeddingModel, multimodalEmbeddingModel } = modelSettings;
      const schemaProperties = providerCollection.schema.properties;
      const indexName = ElasticClient.formatIndexName(linkedAccountId, collectionKey);

      const results = await this.elastic.search({
        index: indexName,
        query: { terms: { 'id.keyword': objects.map((obj) => obj.id) } },
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
        operations.push({ doc: vectorObj });
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
    linkedAccountId,
    collectionKey,
    objectIds,
  }: {
    linkedAccountId: string;
    collectionKey: string;
    objectIds: string[];
  }): Promise<boolean> {
    if (!objectIds || objectIds.length === 0) {
      return true;
    }

    try {
      const indexName = ElasticClient.formatIndexName(linkedAccountId, collectionKey);
      const response = await this.elastic.deleteByQuery({
        index: indexName,
        query: { terms: { 'id.keyword': objectIds } },
      });

      return response.failures?.length === 0;
    } catch (err) {
      await errorService.reportError(err);
      return false;
    }
  }

  public async deleteAllObjects({
    linkedAccountId,
    collectionKey,
  }: {
    linkedAccountId: string;
    collectionKey: string;
  }): Promise<boolean> {
    try {
      const indexName = ElasticClient.formatIndexName(linkedAccountId, collectionKey);
      const response = await this.elastic.deleteByQuery({
        index: indexName,
        query: { match_all: {} },
      });

      return response.failures?.length === 0;
    } catch (err) {
      await errorService.reportError(err);
      return false;
    }
  }

  public async deleteIndex(linkedAccountId: string, collectionKey: string): Promise<boolean> {
    try {
      const indexName = ElasticClient.formatIndexName(linkedAccountId, collectionKey);
      const response = await this.elastic.indices.delete({ index: indexName });
      return response.acknowledged;
    } catch (err) {
      await errorService.reportError(err);
      return false;
    }
  }
}

export default ElasticClient;
