import { CollectionProperty, CollectionSchema, Registry } from '@embed/providers';
import { config } from 'dotenv';
import weaviate, { WeaviateClass } from 'weaviate-ts-client';

config();

const registry = new Registry();

if (!process.env['WEAVIATE_URL']) {
  throw new Error('WEAVIATE_URL not set');
}

const client = weaviate.client({
  host: process.env['WEAVIATE_URL'],
});

function formatCollectionName(integrationKey: string, collectionSchemaName: string) {
  const combined = `${integrationKey.trim()}-${collectionSchemaName.trim().replace(/ /g, '-')}`;
  const words = combined.split('-');
  const titleCasedWords = words.map((w) => w.charAt(0).toUpperCase() + w.slice(1));
  return titleCasedWords.join('');
}

function transformProperty(schemaProperty: [string, CollectionProperty]): {
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
    name: name === 'id' ? 'external_id' : name,
    dataType: [dataType],
    indexSearchable: props.index_searchable,
    indexFilterable: props.index_filterable,
    description: props.description,
  };
}

function buildVectorConfig(schemaProperties: [string, CollectionProperty][]): {
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

async function createCollections() {
  const allClassDefinitions = await client.schema.getter().do();
  const allCollections = allClassDefinitions.classes || [];
  const allProviderSpecs = await registry.getAllProviderSpecifications();
  const iter: {
    formattedCollectionName: string;
    collectionSchema: CollectionSchema;
  }[] = [];

  for (const providerSpec of allProviderSpecs) {
    if (providerSpec.collections) {
      const providerName = providerSpec.unique_key;
      const collections = Object.entries(providerSpec.collections);

      for (const collection of collections) {
        const collectionSchema = collection[1].schema;
        const formattedCollectionName = formatCollectionName(providerName, collectionSchema.name);
        iter.push({ formattedCollectionName, collectionSchema });
      }
    }
  }

  let createdClassesCount = 0;

  for (const i of iter) {
    const existingCollection = allCollections.find((c) => {
      return c.class === i.formattedCollectionName;
    });

    const schemaProps = Object.entries(i.collectionSchema.properties);
    const weaviateProps = schemaProps.map((prop) => transformProperty(prop));
    const weaviateVectorConfig = buildVectorConfig(schemaProps);

    const newClass: WeaviateClass = {
      class: i.formattedCollectionName,
      description: i.collectionSchema.description,
      multiTenancyConfig: { enabled: true },
      properties: weaviateProps,
      vectorConfig: weaviateVectorConfig,
    };

    if (!existingCollection) {
      await client.schema.classCreator().withClass(newClass).do();
      createdClassesCount++;
    } else {
      if (existingCollection.class !== newClass.class) {
        console.warn(`Collection name mismatch`);
        console.warn(`Existing collection name: ${existingCollection.class}`);
        console.warn(`Provider collection name: ${newClass.class}`);
      }

      if (existingCollection.description !== newClass.description) {
        console.warn(`Collection description mismatch`);
        console.warn(`Existing collection description: ${existingCollection.description}`);
        console.warn(`Provider collection description: ${newClass.description}`);
      }

      const newProps = JSON.stringify(weaviateProps.map((p) => p.name).sort());
      const existingProps = JSON.stringify(
        existingCollection.properties?.map((p) => p.name).sort()
      );
      if (newProps !== existingProps) {
        console.warn(`Collection properties mismatch`);
        console.warn(`Existing: ${existingProps}`);
        console.warn(`Provider: ${newProps}`);
      }

      const newConfigKeys = JSON.stringify(Object.keys(weaviateVectorConfig).sort());
      const existingConfigKeys = JSON.stringify(
        Object.keys(existingCollection.vectorConfig || {}).sort()
      );
      if (newConfigKeys !== existingConfigKeys) {
        console.warn(`Collection vector config mismatch`);
        console.warn(`Existing: ${newConfigKeys}`);
        console.warn(`New: ${newConfigKeys}`);
      }
    }
  }

  console.log(`${createdClassesCount} collections created in Weaviate`);
}

createCollections().catch((err) => console.error(err));
