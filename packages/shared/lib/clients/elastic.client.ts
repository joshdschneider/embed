import { Client as Elastic } from '@elastic/elasticsearch';
import { LinkedAccount } from '@prisma/client';
import { getElasticApiKey, getElasticApiKeyId, getElasticUrl } from '../utils/constants';
import { QueryOptions } from '../utils/types';
import { EmbeddingClient } from './embedding.client';
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
    return this.queries.queryCollection({
      environmentId: linkedAccount.environment_id,
      linkedAccountId: linkedAccount.id,
      integrationKey: linkedAccount.integration_key,
      collectionKey,
      queryOptions,
    });
  }
}

export default ElasticClient;
