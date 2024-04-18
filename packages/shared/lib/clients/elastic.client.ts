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
    return this.queries.query({
      environmentId: linkedAccount.environment_id,
      linkedAccountId: linkedAccount.id,
      integrationKey: linkedAccount.integration_key,
      collectionKey,
      queryOptions,
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
    return this.queries.imageSearch({
      environmentId: linkedAccount.environment_id,
      linkedAccountId: linkedAccount.id,
      integrationKey: linkedAccount.integration_key,
      collectionKey,
      imageSearchOptions,
    });
  }

  public async indexExists(index: string) {
    return this.elastic.indices.exists({ index });
  }

  public async createIndex({
    linkedAccountId,
    integrationKey,
    collectionKey,
  }: {
    linkedAccountId: string;
    integrationKey: string;
    collectionKey: string;
  }): Promise<boolean> {
    const collection = await providerService.getProviderCollection(integrationKey, collectionKey);
    if (!collection) {
      throw new Error(`Failed to get collection schema for ${collectionKey}`);
    }

    const properties: [string, MappingProperty][] = [];
    for (const [schemaName, schemaProps] of Object.entries(collection.schema.properties)) {
      properties.push(...IndexClient.transformProperty(schemaName, schemaProps));
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
    const providerCollection = await providerService.getProviderCollection(
      integrationKey,
      collectionKey
    );

    if (!providerCollection) {
      throw new Error(`Failed to get collection schema for ${collectionKey}`);
    }

    const collection = await collectionService.retrieveCollection(
      collectionKey,
      integrationKey,
      environmentId
    );

    if (!collection) {
      throw new Error(`Failed to get collection for linked account ${linkedAccountId}`);
    }

    const vectorizedObjects: Record<string, any>[] = [];

    for (const obj of objects) {
      const vectorizedObject = await this.vectorizeObject({
        textEmbeddingModel: collection.text_embedding_model as TextEmbeddingModel,
        multimodalEmbeddingModel: collection.multimodal_embedding_model as MultimodalEmbeddingModel,
        schemaProperties: providerCollection.schema.properties,
        obj,
      });

      vectorizedObjects.push(vectorizedObject);
    }

    const indexName = ElasticClient.formatIndexName(linkedAccountId, collectionKey);
    const operations = vectorizedObjects.flatMap((obj) => [{ index: { _index: indexName } }, obj]);

    const bulkResponse = await this.elastic.bulk({
      refresh: true,
      operations,
    });

    return bulkResponse.errors === false;
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
    const providerCollection = await providerService.getProviderCollection(
      integrationKey,
      collectionKey
    );

    if (!providerCollection) {
      throw new Error(`Failed to get collection schema for ${collectionKey}`);
    }

    const collection = await collectionService.retrieveCollection(
      collectionKey,
      integrationKey,
      environmentId
    );

    if (!collection) {
      throw new Error(`Failed to get collection for linked account ${linkedAccountId}`);
    }

    const vectorObj = await this.vectorizeObject({
      textEmbeddingModel: collection.text_embedding_model as TextEmbeddingModel,
      multimodalEmbeddingModel: collection.multimodal_embedding_model as MultimodalEmbeddingModel,
      schemaProperties: providerCollection.schema.properties,
      obj: object,
    });

    const indexName = ElasticClient.formatIndexName(linkedAccountId, collectionKey);

    const response = await this.elastic.index({
      index: indexName,
      document: vectorObj,
    });

    return response.result === 'created' || response.result === 'updated';
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
    const providerCollection = await providerService.getProviderCollection(
      integrationKey,
      collectionKey
    );

    if (!providerCollection) {
      throw new Error(`Failed to get collection schema for ${collectionKey}`);
    }

    const collection = await collectionService.retrieveCollection(
      collectionKey,
      integrationKey,
      environmentId
    );

    if (!collection) {
      throw new Error(`Failed to get collection for linked account ${linkedAccountId}`);
    }

    const indexName = ElasticClient.formatIndexName(linkedAccountId, collectionKey);

    const results = await this.elastic.search({
      index: indexName,
      query: { terms: { id: objects.map((obj) => obj.id) } },
      _source: ['id'],
    });

    const matchingObjects = results.hits.hits.map((hit: SearchHit<any>) => ({
      _id: hit._id,
      id: hit._source.id,
    }));

    if (matchingObjects.length !== objects.length) {
      const objectsNotFound = objects.filter(
        (obj) => !matchingObjects.find((match) => match.id === obj.id)
      );

      const batchUpsertResults = await this.batchUpsertObjects({
        linkedAccountId,
        integrationKey,
        collectionKey,
        environmentId,
        objects: objectsNotFound,
      });

      if (!batchUpsertResults) {
        return false;
      }
    }

    const operations: object[] = [];

    for (const { id, _id } of matchingObjects) {
      const obj = objects.find((obj) => obj.id === id)!;
      const vectorObj = await this.vectorizeObject({
        textEmbeddingModel: collection.text_embedding_model as TextEmbeddingModel,
        multimodalEmbeddingModel: collection.multimodal_embedding_model as MultimodalEmbeddingModel,
        schemaProperties: providerCollection.schema.properties,
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
    const indexName = ElasticClient.formatIndexName(linkedAccountId, collectionKey);
    const response = await this.elastic.deleteByQuery({
      index: indexName,
      query: { terms: { id: objectIds } },
    });

    return response.failures?.length === 0;
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
