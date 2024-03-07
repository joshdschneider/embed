import { CollectionProperty } from '@kit/providers';
import weaviate, { WeaviateClient as Client, WeaviateClass } from 'weaviate-ts-client';
import GraphQLHybrid from '../graphql/hybrid';
import GraphQLWhere from '../graphql/where';
import collectionService from '../services/collection.service';
import errorService from '../services/error.service';
import linkedAccountService from '../services/linkedAccount.service';
import providerService from '../services/provider.service';
import { getWeaviateUrl, isProd } from '../utils/constants';
import { Filter } from '../utils/types';
import { VectorClient } from './vector.client';

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

  public async createIntegrationCollections(
    integrationKey: string,
    collectionKey: string
  ): Promise<WeaviateClass | null> {
    if (!this.client) {
      await errorService.reportError(new Error('Weaviate client not initialized'));
      return null;
    }

    try {
      const providerSpec = await providerService.getProviderSpec(integrationKey);
      if (!providerSpec) {
        throw new Error(`Provider not found with key ${integrationKey}`);
      }

      const collections = Object.entries(providerSpec.collections || {});
      const providerCollection = collections.find(([k, v]) => k === collectionKey);
      if (!providerCollection) {
        throw new Error(`Provider collection not found with key ${collectionKey}`);
      }

      const [k, v] = providerCollection;
      const collectionName = this.formatCollectionName(integrationKey, v.schema.name);
      const schemaProps = Object.entries(v.schema.properties);
      const weaviateProps = schemaProps.map((prop) => this.transformProperty(prop));
      const weaviateVectorConfig = this.getVectorConfig(schemaProps);

      const weaviateClass: WeaviateClass = {
        class: collectionName,
        description: v.schema.description,
        multiTenancyConfig: { enabled: true },
        properties: weaviateProps,
        vectorConfig: weaviateVectorConfig,
      };

      return await this.client.schema.classCreator().withClass(weaviateClass).do();
    } catch (err) {
      await errorService.reportError(err);
      return null;
    }
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

  public async nearText<T>(
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
  ): Promise<T[] | null> {
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

      let promises: Promise<
        { _additional: { score: string; id: string }; [key: string]: unknown }[]
      >[] = [];

      if (textProperties.length > 0) {
        const textQueryPromise = this.vectorQuery({
          tenant: linkedAccountId,
          collection: collectionName,
          query,
          targetVectors: textProperties,
          embeddingModel: collection.text_embedding_model,
          alpha: options?.alpha,
          limit: options?.limit,
          where: options?.filter,
          fields: fields,
        });

        promises.push(textQueryPromise);
      }

      if (multimodalProperties.length > 0) {
        const multimodalQueryPromise = this.vectorQuery({
          tenant: linkedAccountId,
          collection: collectionName,
          query,
          targetVectors: multimodalProperties,
          embeddingModel: collection.multimodal_embedding_model,
          alpha: options?.alpha,
          limit: options?.limit,
          where: options?.filter,
          fields: fields,
        });

        promises.push(multimodalQueryPromise);
      }

      const resolvedPromises = await Promise.all(promises);
      const mergedArray = resolvedPromises.flat(1);
      const uniqueArray = mergedArray.reduce(
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

      const limit = options?.limit || resolvedPromises[0]?.length;
      const sortedAndLimitedArray = uniqueArray
        .sort((a, b) => parseFloat(b._additional.score) - parseFloat(a._additional.score))
        .slice(0, limit);

      return sortedAndLimitedArray as T[];
    } catch (err) {
      await errorService.reportError(err);
      return null;
    }
  }

  private async vectorQuery({
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
    embeddingModel: string;
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

    const queryString = this.buildQueryString({
      collection,
      tenant,
      hybrid: { query, vector: vector[0]!, targetVectors, alpha },
      limit,
      where,
      fields,
    });

    const response = await this.client.graphql.raw().withQuery(queryString).do();
    return response?.data?.Get[collection] || [];
  }

  private async getCollection(collectionName: string): Promise<WeaviateClass | null> {
    if (!this.client) {
      await errorService.reportError(new Error('Weaviate client not initialized'));
      return null;
    }

    try {
      return await this.client.schema.classGetter().withClassName(collectionName).do();
    } catch (err) {
      await errorService.reportError(err);
      return null;
    }
  }

  private formatCollectionName(integrationKey: string, collectionSchemaName: string) {
    const combined = `${integrationKey}-${collectionSchemaName}`;
    const words = combined.split('-');
    const titleCasedWords = words.map((w) => w.charAt(0).toUpperCase() + w.slice(1));
    return titleCasedWords.join('');
  }

  private transformProperty(schemaProperty: [string, CollectionProperty]): {
    dataType?: string[];
    description?: string;
    name?: string;
    indexFilterable?: boolean;
    indexSearchable?: boolean;
  } {
    const [name, props] = schemaProperty;

    let dataType: string;
    if (props.type === 'string' && (props.format === 'date' || props.format === 'date-time')) {
      dataType = 'date';
    } else if (props.type === 'string') {
      dataType = 'text';
    } else if (props.type === 'integer') {
      dataType = 'int';
    } else if (props.type === 'number') {
      dataType = 'number';
    } else {
      throw new Error(`Unsupported property type ${props.type}`);
    }

    return {
      name,
      dataType: [dataType],
      indexSearchable: props.index_searchable,
      indexFilterable: props.index_filterable,
      description: props.description,
    };
  }

  private buildQueryString(query: {
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
    let args = [`tenant:${JSON.stringify(query.tenant)}`];

    args = [...args, `hybrid:${new GraphQLHybrid(query.hybrid).toString()}`];

    if (query.limit !== undefined) {
      args = [...args, `limit:${JSON.stringify(query.limit)}`];
    }

    if (query.where !== undefined) {
      args = [...args, `where:${new GraphQLWhere(query.where).toString()}`];
    }

    const params = args.join(',');

    return `{
      Get{${query.collection}(${params}) {
        ${query.fields.join(' ')} _additional { id score } }
      }
    }`;
  }

  private getVectorConfig(schemaProperties: [string, CollectionProperty][]): {
    [key: string]: {
      vectorizer?: { [key: string]: unknown };
      vectorIndexType?: string;
    };
  } {
    const vectorProps = schemaProperties.filter(([k, v]) => v.vector_searchable !== false);
    const vectorConfigEntries = vectorProps.map(([k, v]) => [
      k,
      {
        vectorIndexType: 'hnsw',
        vectorizer: { none: { properties: [k] } },
      },
    ]);

    const vectorConfigs = Object.fromEntries(vectorConfigEntries);
    return { ...vectorConfigs };
  }
}

export default WeaviateClient;
