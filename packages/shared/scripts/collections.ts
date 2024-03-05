import weaviate from 'weaviate-ts-client';

if (!process.env.WEAVIATE_URL) {
  throw new Error('WEAVIATE_URL not set');
}

const client = weaviate.client({
  host: process.env.WEAVIATE_URL,
});

// create collections
