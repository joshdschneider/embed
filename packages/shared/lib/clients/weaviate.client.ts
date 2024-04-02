import { CollectionProperty } from '@embed/providers';
import { Collection, LinkedAccount } from '@prisma/client';
import md5 from 'md5';
import weaviate, { WeaviateClient as Client } from 'weaviate-ts-client';
import GraphQLHybrid from '../graphql/hybrid';
import GraphQLWhere from '../graphql/where';
import collectionService from '../services/collection.service';
import errorService from '../services/error.service';
import linkedAccountService from '../services/linkedAccount.service';
import providerService from '../services/provider.service';
import { getWeaviateUrl, isProd } from '../utils/constants';
import { MultimodalEmbeddingModel, TextEmbeddingModel } from '../utils/enums';
import { Filter } from '../utils/types';
import { EmbeddingClient } from './embedding.client';

const WEAVIATE_URL = getWeaviateUrl();

class WeaviateClient {
  private static instance: WeaviateClient;
  private weaviateClient: Client | null = null;
  private embeddingClient: EmbeddingClient;

  private constructor(client: Client) {
    this.weaviateClient = client;
    this.embeddingClient = new EmbeddingClient();
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
  ): Promise<boolean> {
    if (!this.weaviateClient) {
      await errorService.reportError(new Error('Weaviate client not initialized'));
      return false;
    }

    try {
      const collectionSchema = await providerService.getProviderCollectionSchema(
        integrationKey,
        collectionKey
      );

      if (!collectionSchema) {
        throw new Error(`Failed to get collection schema for ${collectionKey}`);
      }

      const collectionName = this.formatCollectionName(integrationKey, collectionSchema.name);
      await this.weaviateClient.schema
        .tenantsCreator(collectionName, [{ name: linkedAccountId }])
        .do();

      return true;
    } catch (err) {
      await errorService.reportError(err);
      return false;
    }
  }

  public async batchCreate<T extends { id: string; [key: string]: unknown }>(
    linkedAccountId: string,
    collectionKey: string,
    data: { object: T; instances?: T[] }[]
  ): Promise<boolean> {
    if (!this.weaviateClient) {
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
        linkedAccount.integration_key,
        linkedAccount.environment_id
      );

      if (!collection) {
        throw new Error(`Failed to retrieve collection with key ${collectionKey}`);
      }

      const collectionSchema = await providerService.getProviderCollectionSchema(
        linkedAccount.integration_key,
        collectionKey
      );

      if (!collectionSchema) {
        throw new Error(`Failed to get collection schema for ${collectionKey}`);
      }

      const properties = Object.entries(collectionSchema.properties);
      const schemaName = this.formatCollectionName(
        linkedAccount.integration_key,
        collectionSchema.name
      );

      let batcher = this.weaviateClient.batch.objectsBatcher();

      for (const d of data) {
        const obj = d.object;
        const hash = md5(JSON.stringify(obj));
        const instances = d.instances || [];

        const mainObjectVectors = await this.vectorizeProperties(collection, properties, obj);
        batcher = batcher.withObject({
          class: schemaName,
          tenant: linkedAccountId,
          properties: { ...obj, hash },
          vectors: mainObjectVectors,
        });

        for (const instance of instances) {
          const instanceHash = md5(JSON.stringify(instance));
          const alreadyVectorizedKeys = Object.keys(mainObjectVectors);
          const instanceVectors = await this.vectorizeProperties(
            collection,
            properties.filter(([k, v]) => !alreadyVectorizedKeys.includes(k)),
            instance
          );

          batcher = batcher.withObject({
            class: schemaName,
            tenant: linkedAccountId,
            properties: { ...instance, hash: instanceHash },
            vectors: { ...mainObjectVectors, ...instanceVectors },
          });
        }
      }

      const batchResponse = await batcher.do();

      for (const batch of batchResponse) {
        if (batch.result?.status === 'FAILED') {
          const err = batch.result.errors?.error
            ? batch.result.errors.error.join(' ')
            : 'Batch save failed';

          throw new Error(err);
        }
      }

      return true;
    } catch (err) {
      await errorService.reportError(err);
      return false;
    }
  }

  public async batchUpdate<T extends { id: string; [key: string]: unknown }>(
    linkedAccountId: string,
    collectionKey: string,
    data: { object: T; instances?: T[] }[]
  ): Promise<boolean> {
    if (!this.weaviateClient) {
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
        linkedAccount.integration_key,
        linkedAccount.environment_id
      );

      if (!collection) {
        throw new Error(`Failed to retrieve collection with key ${collectionKey}`);
      }

      const collectionSchema = await providerService.getProviderCollectionSchema(
        linkedAccount.integration_key,
        collectionKey
      );

      if (!collectionSchema) {
        throw new Error(`Failed to get collection schema for ${collectionKey}`);
      }

      const properties = Object.entries(collectionSchema.properties);
      const schemaName = this.formatCollectionName(
        linkedAccount.integration_key,
        collectionSchema.name
      );

      let batcher = this.weaviateClient.batch.objectsBatcher();
      let deleteIds = [];

      for (const d of data) {
        const obj = d.object;
        const instances = d.instances || [];

        let existingObjects = [];
        let cursor;

        while (true) {
          let nextBatch = await this.fetchHashes({
            linkedAccountId,
            schemaName,
            externalId: obj.id,
            cursor,
          });

          if (nextBatch.length === 0) {
            break;
          }

          existingObjects.push(...nextBatch);
          cursor = nextBatch.at(-1)?._additional.id;
        }

        const mainObject = { ...obj, hash: md5(JSON.stringify(obj)) };
        const instanceObjects = instances.map((i) => ({ ...i, hash: md5(JSON.stringify(i)) }));
        const newObjects = [mainObject, ...instanceObjects];

        const newObjectHashes = new Set(newObjects.map((obj) => obj.hash));
        const existingObjectHashes = new Set(existingObjects.map((obj) => obj.hash));

        const objectsToCreate = newObjects.filter((o) => !existingObjectHashes.has(o.hash));
        const objectsToDelete = existingObjects.filter((o) => !newObjectHashes.has(o.hash));
        deleteIds.push(...objectsToDelete.map((o) => o._additional.id));

        const mainObjectVectors = await this.vectorizeProperties(
          collection,
          properties,
          mainObject
        );

        batcher = batcher.withObject({
          class: schemaName,
          tenant: linkedAccountId,
          properties: mainObject,
          vectors: mainObjectVectors,
        });

        for (const objectToCreate of objectsToCreate) {
          const alreadyVectorizedKeys = Object.keys(mainObjectVectors);
          const instanceVectors = await this.vectorizeProperties(
            collection,
            properties.filter(([k, v]) => !alreadyVectorizedKeys.includes(k)),
            objectToCreate
          );

          batcher = batcher.withObject({
            class: schemaName,
            tenant: linkedAccountId,
            properties: objectToCreate,
            vectors: { ...mainObjectVectors, ...instanceVectors },
          });
        }
      }

      const createObjects = await batcher.do();
      let batchCreateError: string | null = null;

      for (const createObject of createObjects) {
        if (createObject.result?.status === 'FAILED') {
          const err = createObject.result.errors?.error
            ? createObject.result.errors.error.map((e) => e.message || '').join(' ')
            : 'Batch create failed';
          if (err && err !== batchCreateError) {
            batchCreateError = err;
          }
        }
      }

      const deleteResponse = await this.weaviateClient.batch
        .objectsBatchDeleter()
        .withClassName(schemaName)
        .withTenant(linkedAccountId)
        .withWhere({
          path: ['id'],
          operator: 'ContainsAny',
          valueTextArray: deleteIds,
        })
        .do();

      const deleteObjects = deleteResponse.results?.objects;
      let batchDeleteError: string | null = null;

      if (deleteObjects && deleteObjects.length > 0) {
        for (const deleteObject of deleteObjects) {
          if (deleteObject.status === 'FAILED') {
            const err = deleteObject.errors?.error
              ? deleteObject.errors?.error.map((e) => e.message || '').join(' ')
              : 'Batch delete failed';
            if (!batchDeleteError) {
              batchDeleteError = err;
            } else if (err !== batchDeleteError) {
              batchDeleteError += ' ' + err;
            }
          }
        }
      }

      if (!!batchCreateError || !!batchDeleteError) {
        throw new Error(`${batchCreateError || ''} ${batchDeleteError || ''}`);
      }

      return true;
    } catch (err) {
      await errorService.reportError(err);
      return false;
    }
  }

  private async fetchHashes({
    linkedAccountId,
    schemaName,
    externalId,
    cursor,
  }: {
    linkedAccountId: string;
    schemaName: string;
    externalId: string;
    cursor?: string;
  }): Promise<{ external_id: string; hash: string; _additional: { id: string } }[]> {
    if (!this.weaviateClient) {
      throw new Error('Weaviate client not initialized');
    }

    const query = this.weaviateClient.graphql
      .get()
      .withClassName(schemaName)
      .withTenant(linkedAccountId)
      .withWhere({
        path: ['external_id'],
        operator: 'Equal',
        valueText: externalId,
      })
      .withFields('external_id hash _additional { id }')
      .withLimit(100);

    if (cursor) {
      let result = await query.withAfter(cursor).do();
      return result.data.Get[schemaName];
    } else {
      let result = await query.do();
      return result.data.Get[schemaName];
    }
  }

  private async fetchIds({
    linkedAccountId,
    schemaName,
    externalId,
    cursor,
  }: {
    linkedAccountId: string;
    schemaName: string;
    externalId: string;
    cursor?: string;
  }): Promise<{ external_id: string; _additional: { id: string } }[]> {
    if (!this.weaviateClient) {
      throw new Error('Weaviate client not initialized');
    }

    const query = this.weaviateClient.graphql
      .get()
      .withClassName(schemaName)
      .withTenant(linkedAccountId)
      .withWhere({
        path: ['external_id'],
        operator: 'Equal',
        valueText: externalId,
      })
      .withFields('external_id _additional { id }')
      .withLimit(100);

    if (cursor) {
      let result = await query.withAfter(cursor).do();
      return result.data.Get[schemaName];
    } else {
      let result = await query.do();
      return result.data.Get[schemaName];
    }
  }

  public async pruneDeleted(
    linkedAccountId: string,
    schemaName: string,
    deletedExternalIds: string[]
  ): Promise<boolean> {
    if (!this.weaviateClient) {
      await errorService.reportError(new Error('Weaviate client not initialized'));
      return false;
    }

    try {
      let batchDeleteError: string | null = null;
      for (const externalId of deletedExternalIds) {
        let deleteIds = [];
        let cursor;

        while (true) {
          let nextBatch = await this.fetchIds({
            linkedAccountId,
            schemaName,
            externalId,
            cursor,
          });

          if (nextBatch.length === 0) {
            break;
          }

          deleteIds.push(...nextBatch.map((batch) => batch._additional.id));
          cursor = nextBatch.at(-1)?._additional.id;
        }

        const response = await this.weaviateClient.batch
          .objectsBatchDeleter()
          .withClassName(schemaName)
          .withTenant(linkedAccountId)
          .withWhere({
            path: ['id'],
            operator: 'ContainsAny',
            valueTextArray: deleteIds,
          })
          .do();

        const objects = response.results?.objects;
        if (objects && objects.length > 0) {
          for (const obj of objects) {
            if (obj.status === 'FAILED') {
              const err = obj.errors?.error
                ? obj.errors?.error.map((e) => e.message || '').join(' ')
                : 'Batch delete failed';
              if (!batchDeleteError) {
                batchDeleteError = err;
              } else if (err !== batchDeleteError) {
                batchDeleteError += ' ' + err;
              }
            }
          }
        }
      }

      if (batchDeleteError) {
        throw new Error(batchDeleteError);
      }

      return true;
    } catch (err) {
      await errorService.reportError(err);
      return false;
    }
  }

  /**
   * TODO for queries:
   * - delete hash from query response
   * - turn external_id into just id
   */

  public async nearText<T = any>(
    linkedAccount: LinkedAccount,
    collectionKey: string,
    query: string,
    options?: {
      alpha?: number;
      limit?: number;
      filter?: Filter;
      returnProperties?: string[];
    }
  ): Promise<(T & { _score: number })[] | null> {
    if (!this.weaviateClient) {
      await errorService.reportError(new Error('Weaviate client not initialized'));
      return null;
    }

    try {
      const collection = await collectionService.retrieveCollection(
        collectionKey,
        linkedAccount.integration_key,
        linkedAccount.environment_id
      );

      if (!collection) {
        throw new Error(`Failed to retrieve collection with key ${collectionKey}`);
      }

      const collectionSchema = await providerService.getProviderCollectionSchema(
        linkedAccount.integration_key,
        collectionKey
      );

      if (!collectionSchema) {
        throw new Error(`Failed to get collection schema for ${collectionKey}`);
      }

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
          if (!v.multimodal) {
            textProperties.push(k);
          } else if (v.multimodal) {
            multimodalProperties.push(k);
          }
        }
      }

      let textQueryPromise;
      let multimodalQueryPromise;

      if (textProperties.length > 0) {
        textQueryPromise = this.hybridQuery({
          tenant: linkedAccount.id,
          collection: collectionName,
          query,
          targetVectors: textProperties,
          embeddingModel: collection.text_embedding_model as TextEmbeddingModel,
          isMultimodal: false,
          alpha: options?.alpha,
          limit: options?.limit,
          where: options?.filter,
          fields: fields,
        });
      }

      if (multimodalProperties.length > 0) {
        multimodalQueryPromise = this.hybridQuery({
          tenant: linkedAccount.id,
          collection: collectionName,
          query,
          targetVectors: multimodalProperties,
          embeddingModel: collection.multimodal_embedding_model as MultimodalEmbeddingModel,
          isMultimodal: true,
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
            acc: {
              [key: string]: unknown;
              _additional: { id: string; score: string };
            }[],
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
      limit?: number;
      offset?: number;
      returnProperties?: string[];
    }
  ): Promise<(T & { _score: number })[] | null> {
    if (!this.weaviateClient) {
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
        throw new Error(`Failed to retrieve collection with key ${collectionKey}`);
      }

      const collectionSchema = await providerService.getProviderCollectionSchema(
        linkedAccount.integration_key,
        collectionKey
      );

      if (!collectionSchema) {
        throw new Error(`Failed to get collection schema for ${collectionKey}`);
      }

      const collectionName = this.formatCollectionName(
        linkedAccount.integration_key,
        collectionSchema.name
      );

      const fields =
        options?.returnProperties && options?.returnProperties.length > 0
          ? options.returnProperties
          : Object.keys(collectionSchema.properties);

      const multimodalProperties = Object.entries(collectionSchema.properties)
        .filter(([k, v]) => v.vector_searchable && v.multimodal)
        .map(([k, v]) => k);

      const multimodalQueryResponse = await this.imageQuery({
        tenant: linkedAccountId,
        collection: collectionName,
        imageBase64,
        targetVectors: multimodalProperties,
        embeddingModel: collection.multimodal_embedding_model as MultimodalEmbeddingModel,
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
    collection,
    tenant,
    query,
    isMultimodal,
    targetVectors,
    alpha,
    limit,
    where,
    fields,
  }: {
    embeddingModel: TextEmbeddingModel | MultimodalEmbeddingModel;
    isMultimodal: boolean;
    query: string;
    collection: string;
    tenant: string;
    targetVectors: string[];
    alpha?: number;
    limit?: number;
    where?: Filter;
    fields: string[];
  }): Promise<{ _additional: { score: string; id: string }; [key: string]: unknown }[]> {
    if (!this.weaviateClient) {
      throw new Error('Weaviate client not initialized');
    }

    let vector;
    if (isMultimodal) {
      const textVectors = await this.embeddingClient.embedText({
        model: embeddingModel as TextEmbeddingModel,
        purpose: 'query',
        text: [query],
      });
      vector = textVectors[0]!;
    } else {
      const multimodalVectors = await this.embeddingClient.embedMultimodal({
        model: embeddingModel as MultimodalEmbeddingModel,
        content: [query],
        type: 'text',
      });
      vector = multimodalVectors[0]!;
    }

    const queryString = this.buildHybridQueryString({
      collection,
      tenant,
      hybrid: { query, vector, targetVectors, alpha },
      limit,
      where,
      fields,
    });

    const response = await this.weaviateClient.graphql.raw().withQuery(queryString).do();
    return response.data.Get[collection];
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
    embeddingModel: MultimodalEmbeddingModel;
    imageBase64: string;
    collection: string;
    tenant: string;
    targetVectors: string[];
    limit?: number;
    fields: string[];
  }): Promise<{ _additional: { score: string; id: string }; [key: string]: unknown }[]> {
    if (!this.weaviateClient) {
      throw new Error('Weaviate client not initialized');
    }

    const [vector] = await this.embeddingClient.embedMultimodal({
      model: embeddingModel,
      content: [imageBase64],
      type: 'images',
    });

    const chain = this.weaviateClient.graphql
      .get()
      .withClassName(collection)
      .withTenant(tenant)
      .withFields(fields.join(' ') + ' _additional { id score }')
      .withNearVector({ vector: vector!, targetVectors });

    if (limit) {
      chain.withLimit(limit);
    }

    const data = await chain.do();
    return data.data.Get[collection];
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
    collection: Collection,
    properties: [string, CollectionProperty][],
    obj: { [key: string]: unknown }
  ): Promise<{ [key: string]: number[] }> {
    const textProperties = properties
      .filter(([k, v]) => v.vector_searchable !== false && v.multimodal !== true)
      .map(([k, v]) => k);

    const multimodalProperties = properties
      .filter(([k, v]) => v.vector_searchable !== false && v.multimodal === true)
      .map(([k, v]) => k);

    let textVectorsPromise;
    let multimodalVectorsPromise;

    if (textProperties.length > 0) {
      const textContent = Object.entries(obj)
        .filter(([k, v]) => textProperties.includes(k))
        .map(([k, v]) => v) as string[];

      textVectorsPromise = this.embeddingClient.embedText({
        model: collection.text_embedding_model as TextEmbeddingModel,
        text: textContent,
        purpose: 'object',
      });
    }

    if (multimodalProperties.length > 0) {
      const multimodalContent = Object.entries(obj)
        .filter(([k, v]) => multimodalProperties.includes(k))
        .map(([k, v]) => v) as string[];

      multimodalVectorsPromise = this.embeddingClient.embedMultimodal({
        model: collection.multimodal_embedding_model as MultimodalEmbeddingModel,
        content: multimodalContent,
        type: 'images',
      });
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
