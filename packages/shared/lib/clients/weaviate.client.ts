import weaviate, { WeaviateClient as Client, WeaviateClass } from 'weaviate-ts-client';
import collectionService from '../services/collection.service';
import errorService from '../services/error.service';
import linkedAccountService from '../services/linkedAccount.service';
import providerService from '../services/provider.service';
import { getWeaviateUrl, isProd } from '../utils/constants';
import { Filter, WeaviateFilter } from '../utils/types';
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

      const vector = await this.vectorizer.vectorize(collection.text_embedding_model, [query]);

      const chain = this.client.graphql
        .get()
        .withClassName(collectionName)
        .withTenant(linkedAccountId)
        .withHybrid({
          query,
          vector: vector[0],
          alpha: options?.alpha,
        });

      if (options?.filter) {
        const whereFilters = WeaviateClient.transformFilter(options.filter);
        chain.withWhere(whereFilters);
      }

      const properties = Object.keys(collectionSchema.properties);
      if (options?.returnProperties && options?.returnProperties.length > 0) {
        const props = options.returnProperties.filter((prop) => properties.includes(prop));
        chain.withFields(props.join(' ') + ' _additional { score }');
      } else {
        chain.withFields(properties.join(' ') + ' _additional { score }');
      }

      const data = await chain.do();

      return data.data;
    } catch (err) {
      await errorService.reportError(err);
      return null;
    }
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

  private transformProperty(
    schemaProperty: [
      string,
      {
        type: 'string' | 'number' | 'boolean' | 'integer';
        format?: 'date' | 'date-time';
        description?: string;
        index_searchable?: boolean;
        index_filterable?: boolean;
        vector_searchable?: boolean;
      },
    ]
  ): {
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

  static transformFilter(filter: Filter): WeaviateFilter {
    const { conditions, property, ...rest } = filter;
    const weaviateFilter: WeaviateFilter = {
      ...rest,
      ...(property && { path: property }),
      ...(conditions && { operands: conditions.map(WeaviateClient.transformFilter) }),
    };
    return weaviateFilter;
  }

  private getVectorConfig(
    schemaProperties: [
      string,
      {
        type: 'string' | 'number' | 'boolean' | 'integer';
        format?: 'date' | 'date-time';
        description?: string;
        index_searchable?: boolean;
        index_filterable?: boolean;
        vector_searchable?: boolean;
      },
    ][]
  ): {
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
