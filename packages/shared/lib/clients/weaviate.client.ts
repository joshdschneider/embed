import weaviate, { WeaviateClient as Client } from 'weaviate-ts-client';
import { getWeaviateUrl, isProd } from '../utils/constants';

const WEAVIATE_URL = getWeaviateUrl();

class WeaviateClient {
  private static instance: WeaviateClient;
  private client: Client | null = null;

  private constructor(client: Client) {
    this.client = client;
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
}

export default WeaviateClient;
