import { CollectionProperty } from '@kit/providers';
import { Collection } from '@prisma/client';
import weaviate, { WeaviateClient as Client } from 'weaviate-ts-client';
import GraphQLHybrid from '../graphql/hybrid';
import GraphQLWhere from '../graphql/where';
import collectionService from '../services/collection.service';
import errorService from '../services/error.service';
import linkedAccountService from '../services/linkedAccount.service';
import providerService from '../services/provider.service';
import { getWeaviateUrl, isProd } from '../utils/constants';
import { Filter } from '../utils/types';
import { EmbeddingModel, VectorClient } from './vector.client';

const WEAVIATE_URL = getWeaviateUrl();

class WeaviateClient {
  private static instance: WeaviateClient;
  private client: Client | null = null;
  private vectorizer: VectorClient;

  private constructor(client: Client) {
    this.client = client;
    this.vectorizer = new VectorClient();
  }

  static getInstance(): WeaviateClient {
    if (!this.instance) {
      this.instance = this.create();
    }

    return this.instance;
  }

  private static create(): WeaviateClient {
    if (!WEAVIATE_URL) {
      throw new Error('Weaviate host URL not set');
    }

    const client = weaviate.client({
      host: WEAVIATE_URL,
      scheme: isProd() ? 'https' : undefined,
    });

    return new WeaviateClient(client);
  }

  public async createTenant(
    linkedAccountId: string,
    integrationKey: string,
    collectionKey: string
  ) {
    if (!this.client) {
      await errorService.reportError(new Error('Weaviate client not initialized'));
      return null;
    }

    try {
      const providerSpec = await providerService.getProviderSpec(integrationKey);
      const collectionEntries = Object.entries(providerSpec?.collections || {});
      const providerCollection = collectionEntries.find(([k, v]) => k === collectionKey);
      if (!providerCollection) {
        throw new Error(`Collection not found for provider ${integrationKey}`);
      }

      const collectionSchema = providerCollection[1].schema;
      const collectionName = this.formatCollectionName(integrationKey, collectionSchema.name);
      return await this.client.schema
        .tenantsCreator(collectionName, [{ name: linkedAccountId }])
        .do();
    } catch (err) {
      await errorService.reportError(err);
      return null;
    }
  }

  public async batchSave<T extends { [key: string]: unknown }>(
    linkedAccountId: string,
    integrationKey: string,
    collectionKey: string,
    objects: T[]
  ): Promise<boolean> {
    if (!this.client) {
      await errorService.reportError(new Error('Weaviate client not initialized'));
      return false;
    }

    try {
      const linkedAccount = await linkedAccountService.getLinkedAccountById(linkedAccountId);
      if (!linkedAccount) {
        throw new Error(`Linked account not found with ID ${linkedAccountId}`);
      }

      const collection = await collectionService.retrieveCollection(
        collectionKey,
        integrationKey,
        linkedAccount.environment_id
      );

      if (!collection) {
        throw new Error(`Collection not found with key ${collectionKey}`);
      }

      const providerSpec = await providerService.getProviderSpec(integrationKey);
      const collectionEntries = Object.entries(providerSpec?.collections || {});
      const providerCollection = collectionEntries.find(([k, v]) => k === collectionKey);
      if (!providerCollection) {
        throw new Error(`Collection not found for provider ${integrationKey}`);
      }

      const collectionSchema = providerCollection[1].schema;
      const collectionName = this.formatCollectionName(integrationKey, collectionSchema.name);
      const collectionProperties = Object.entries(collectionSchema.properties);

      let batcher = this.client.batch.objectsBatcher();

      for (const obj of objects) {
        const vectors = await this.vectorizeProperties(obj, collection, collectionProperties);

        batcher = batcher.withObject({
          class: collectionName,
          tenant: linkedAccountId,
          properties: obj,
          vectors: vectors,
        });
      }

      await batcher.do();
      return true;
    } catch (err) {
      await errorService.reportError(err);
      return false;
    }
  }

  public async nearText<T = any>(
    linkedAccountId: string,
    collectionKey: string,
    query: string,
    options?: {
      alpha?: number;
      limit?: number;
      offset?: number;
      filter?: Filter;
      returnProperties?: string[];
    }
  ): Promise<(T & { _score: number })[] | null> {
    if (!this.client) {
      await errorService.reportError(new Error('Weaviate client not initialized'));
      return null;
    }

    try {
      const linkedAccount = await linkedAccountService.getLinkedAccountById(linkedAccountId);
      if (!linkedAccount) {
        throw new Error(`Linked account not found with ID ${linkedAccountId}`);
      }

      const collection = await collectionService.retrieveCollection(
        collectionKey,
        linkedAccount.integration_key,
        linkedAccount.environment_id
      );

      if (!collection) {
        throw new Error(`Collection not found with key ${collectionKey}`);
      }

      const providerSpec = await providerService.getProviderSpec(linkedAccount.integration_key);
      const collectionEntries = Object.entries(providerSpec?.collections || {});
      const providerCollection = collectionEntries.find(([k, v]) => k === collectionKey);
      if (!providerCollection) {
        throw new Error(`Collection not found for provider ${linkedAccount.integration_key}`);
      }

      const collectionSchema = providerCollection[1].schema;
      const collectionName = this.formatCollectionName(
        linkedAccount.integration_key,
        collectionSchema.name
      );

      const fields =
        options?.returnProperties && options?.returnProperties.length > 0
          ? options.returnProperties
          : Object.keys(collectionSchema.properties);

      let textProperties: string[] = [];
      let multimodalProperties: string[] = [];

      for (const [k, v] of Object.entries(collectionSchema.properties)) {
        if (v.vector_searchable !== false) {
          if (v.embedding_model !== 'multimodal') {
            textProperties.push(k);
          } else if (v.embedding_model === 'multimodal') {
            multimodalProperties.push(k);
          }
        }
      }

      let textQueryPromise;
      let multimodalQueryPromise;

      if (textProperties.length > 0) {
        textQueryPromise = this.hybridQuery({
          tenant: linkedAccountId,
          collection: collectionName,
          query,
          targetVectors: textProperties,
          embeddingModel: collection.text_embedding_model as EmbeddingModel,
          alpha: options?.alpha,
          limit: options?.limit,
          where: options?.filter,
          fields: fields,
        });
      }

      if (multimodalProperties.length > 0) {
        multimodalQueryPromise = this.hybridQuery({
          tenant: linkedAccountId,
          collection: collectionName,
          query,
          targetVectors: multimodalProperties,
          embeddingModel: collection.multimodal_embedding_model as EmbeddingModel,
          alpha: options?.alpha,
          limit: options?.limit,
          where: options?.filter,
          fields: fields,
        });
      }

      const [textQueryResponse, multimodalQueryResponse] = await Promise.all([
        textQueryPromise,
        multimodalQueryPromise,
      ]);

      if (textQueryResponse && multimodalQueryResponse) {
        const flatArray = [textQueryResponse, multimodalQueryResponse].flat(1);
        const mergedArray = flatArray.reduce(
          (
            acc: { _additional: { score: string; id: string }; [key: string]: unknown }[],
            current
          ) => {
            const x = acc.find((item) => item._additional.id === current._additional.id);
            if (!x) {
              return acc.concat([current]);
            } else {
              return acc.map((item) =>
                item._additional.id === current._additional.id
                  ? parseFloat(item._additional.score) > parseFloat(current._additional.score)
                    ? item
                    : current
                  : item
              );
            }
          },
          []
        );

        const responseLength =
          textQueryResponse.length > multimodalQueryResponse.length
            ? textQueryResponse.length
            : multimodalQueryResponse.length;

        const responseLimit = options?.limit
          ? responseLength > options.limit
            ? options.limit
            : responseLength
          : responseLength;

        return mergedArray
          .sort((a, b) => parseFloat(b._additional.score) - parseFloat(a._additional.score))
          .slice(0, responseLimit)
          .map((item) => {
            const { _additional, ...rest } = item;
            return { ...rest, _score: parseFloat(_additional.score) };
          }) as (T & { _score: number })[];
      } else {
        const resolvedPromise = Array.isArray(textQueryResponse)
          ? textQueryResponse
          : Array.isArray(multimodalQueryResponse)
            ? multimodalQueryResponse
            : [];

        return resolvedPromise.map((item) => {
          const { _additional, ...rest } = item;
          return { ...rest, _score: parseFloat(_additional.score) };
        }) as (T & { _score: number })[];
      }
    } catch (err) {
      await errorService.reportError(err);
      return null;
    }
  }

  public async nearImage<T = any>(
    linkedAccountId: string,
    collectionKey: string,
    imageBase64: string,
    options?: {
      alpha?: number;
      limit?: number;
      offset?: number;
      filter?: Filter;
      returnProperties?: string[];
    }
  ): Promise<(T & { _score: number })[] | null> {
    if (!this.client) {
      await errorService.reportError(new Error('Weaviate client not initialized'));
      return null;
    }

    try {
      const linkedAccount = await linkedAccountService.getLinkedAccountById(linkedAccountId);
      if (!linkedAccount) {
        throw new Error(`Linked account not found with ID ${linkedAccountId}`);
      }

      const collection = await collectionService.retrieveCollection(
        collectionKey,
        linkedAccount.integration_key,
        linkedAccount.environment_id
      );

      if (!collection) {
        throw new Error(`Collection not found with key ${collectionKey}`);
      }

      const providerSpec = await providerService.getProviderSpec(linkedAccount.integration_key);
      const collectionEntries = Object.entries(providerSpec?.collections || {});
      const providerCollection = collectionEntries.find(([k, v]) => k === collectionKey);
      if (!providerCollection) {
        throw new Error(`Collection not found for provider ${linkedAccount.integration_key}`);
      }

      const collectionSchema = providerCollection[1].schema;
      const collectionName = this.formatCollectionName(
        linkedAccount.integration_key,
        collectionSchema.name
      );

      const fields =
        options?.returnProperties && options?.returnProperties.length > 0
          ? options.returnProperties
          : Object.keys(collectionSchema.properties);

      const multimodalProperties = Object.entries(collectionSchema.properties)
        .filter(([k, v]) => v.vector_searchable && v.embedding_model === 'multimodal')
        .map(([k, v]) => k);

      const multimodalQueryResponse = await this.imageQuery({
        tenant: linkedAccountId,
        collection: collectionName,
        imageBase64,
        targetVectors: multimodalProperties,
        embeddingModel: collection.multimodal_embedding_model as EmbeddingModel,
        limit: options?.limit,
        fields,
      });

      return multimodalQueryResponse.map((item) => {
        const { _additional, ...rest } = item;
        return { ...rest, _score: parseFloat(_additional.score) };
      }) as (T & { _score: number })[];
    } catch (err) {
      await errorService.reportError(err);
      return null;
    }
  }

  private async hybridQuery({
    embeddingModel,
    query,
    collection,
    tenant,
    targetVectors,
    alpha,
    limit,
    where,
    fields,
  }: {
    embeddingModel: EmbeddingModel;
    query: string;
    collection: string;
    tenant: string;
    targetVectors: string[];
    alpha?: number;
    limit?: number;
    where?: Filter;
    fields: string[];
  }): Promise<{ _additional: { score: string; id: string }; [key: string]: unknown }[]> {
    if (!this.client) {
      throw new Error('Weaviate client not initialized');
    }

    const vector = await this.vectorizer.vectorize(embeddingModel, [query]);

    const queryString = this.buildHybridQueryString({
      collection,
      tenant,
      hybrid: { query, vector: vector[0]!, targetVectors, alpha },
      limit,
      where,
      fields,
    });

    const response = await this.client.graphql.raw().withQuery(queryString).do();
    if (response?.data?.Get[collection] && Array.isArray(response.data.Get[collection])) {
      return response.data.Get[collection];
    } else {
      await errorService.reportError(new Error('Unexpected query return value'));
      return [];
    }
  }

  private async imageQuery({
    embeddingModel,
    imageBase64,
    collection,
    tenant,
    targetVectors,
    limit,
    fields,
  }: {
    embeddingModel: EmbeddingModel;
    imageBase64: string;
    collection: string;
    tenant: string;
    targetVectors: string[];
    limit?: number;
    fields: string[];
  }): Promise<{ _additional: { score: string; id: string }; [key: string]: unknown }[]> {
    if (!this.client) {
      throw new Error('Weaviate client not initialized');
    }

    const vector = await this.vectorizer.vectorize(embeddingModel, [imageBase64]);

    const chain = this.client.graphql
      .get()
      .withClassName(collection)
      .withTenant(tenant)
      .withFields(fields.join(' ') + ' _additional { id score }')
      .withNearVector({
        vector: vector[0]!,
        targetVectors,
      });

    if (limit) {
      chain.withLimit(limit);
    }

    const data = await chain.do();
    if (data.data.Get[collection] && Array.isArray(data.data.Get[collection])) {
      return data.data.Get[collection];
    } else {
      await errorService.reportError(new Error('Unexpected query return value'));
      return [];
    }
  }

  private formatCollectionName(integrationKey: string, collectionSchemaName: string) {
    const combined = `${integrationKey.trim()}-${collectionSchemaName.trim().replace(/ /g, '-')}`;
    const words = combined.split('-');
    const titleCasedWords = words.map((w) => w.charAt(0).toUpperCase() + w.slice(1));
    return titleCasedWords.join('');
  }

  private buildHybridQueryString(query: {
    collection: string;
    tenant: string;
    hybrid: {
      query: string;
      vector: number[];
      targetVectors: string[];
      alpha?: number;
    };
    limit?: number;
    where?: Filter;
    fields: string[];
  }): string {
    let args = [
      `tenant:${JSON.stringify(query.tenant)}`,
      `hybrid:${new GraphQLHybrid(query.hybrid).toString()}`,
    ];

    if (query.limit !== undefined) {
      args = [...args, `limit:${JSON.stringify(query.limit)}`];
    }

    if (query.where !== undefined) {
      args = [...args, `where:${new GraphQLWhere(query.where).toString()}`];
    }

    return `{ Get { ${query.collection}(${args.join(',')}) { ${query.fields.join(' ')} _additional { id score } } } }`;
  }

  private async vectorizeProperties(
    obj: { [key: string]: unknown },
    collection: Collection,
    collectionProperties: [string, CollectionProperty][]
  ): Promise<{ [key: string]: number[] }> {
    const textProperties = collectionProperties
      .filter(([k, v]) => v.vector_searchable && v.embedding_model !== 'multimodal')
      .map(([k, v]) => k);

    const multimodalProperties = collectionProperties
      .filter(([k, v]) => v.vector_searchable && v.embedding_model === 'multimodal')
      .map(([k, v]) => k);

    let textVectorsPromise;
    let multimodalVectorsPromise;

    if (textProperties.length > 0) {
      const textChunks = Object.entries(obj)
        .filter(([k, v]) => textProperties.includes(k))
        .map(([k, v]) => v) as string[];

      textVectorsPromise = this.vectorizer.vectorize(
        collection.text_embedding_model as EmbeddingModel,
        textChunks
      );
    }

    if (multimodalProperties.length > 0) {
      const multimodalChunks = Object.entries(obj)
        .filter(([k, v]) => multimodalProperties.includes(k))
        .map(([k, v]) => v) as string[];

      multimodalVectorsPromise = this.vectorizer.vectorize(
        collection.multimodal_embedding_model as EmbeddingModel,
        multimodalChunks
      );
    }

    const [textVectors, multimodalVectors] = await Promise.all([
      textVectorsPromise,
      multimodalVectorsPromise,
    ]);

    const textVectorProperties =
      textVectors?.map((v, i) => {
        const property = textProperties[i] as string;
        return [property, v];
      }) || [];

    const multimodalVectorProperties =
      multimodalVectors?.map((v, i) => {
        const property = multimodalProperties[i] as string;
        return [property, v];
      }) || [];

    return {
      ...Object.fromEntries(textVectorProperties),
      ...Object.fromEntries(multimodalVectorProperties),
    };
  }
}

export default WeaviateClient;
