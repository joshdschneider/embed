import { Client as Elastic } from '@elastic/elasticsearch';
import type {
  KnnQuery,
  QueryDslQueryContainer,
  QueryDslRangeQuery,
  SearchHighlightField,
  SearchHit,
  SearchRequest,
} from '@elastic/elasticsearch/lib/api/types';
import { CollectionProperty } from '@embed/providers';
import axios from 'axios';
import {
  DEFAULT_KNN_NUM_CANDIDATES,
  DEFAULT_QUERY_LIMIT,
  DEFAULT_SCORE_THRESHOLD,
} from '../utils/constants';
import { MultimodalEmbeddingModel, TextEmbeddingModel } from '../utils/enums';
import { isValidUrl } from '../utils/helpers';
import {
  Filter,
  HitObject,
  ImageSearchOptions,
  NestedHitObject,
  QueryOptions,
} from '../utils/types';
import { EmbeddingClient } from './embedding.client';

export class QueryClient {
  private elastic: Elastic;
  private embeddings: EmbeddingClient;

  constructor(elasticClient: Elastic, embeddingClient: EmbeddingClient) {
    this.elastic = elasticClient;
    this.embeddings = embeddingClient;
  }

  public async emptyQuery({
    indexName,
    queryOptions,
  }: {
    indexName: string;
    queryOptions?: QueryOptions;
  }): Promise<SearchHit[]> {
    const req: SearchRequest = {
      index: indexName,
      size: queryOptions?.limit || DEFAULT_QUERY_LIMIT,
    };

    if (queryOptions?.filters) {
      const filter = QueryClient.transformFilter(queryOptions.filters);
      req.query = { bool: { filter: filter } };
    } else {
      req.query = { match_all: {} };
    }

    const res = await this.elastic.search(req);
    return res.hits.hits;
  }

  public async keywordQuery({
    indexName,
    schemaProperties,
    queryOptions,
  }: {
    indexName: string;
    schemaProperties: Record<string, CollectionProperty>;
    queryOptions: QueryOptions;
  }): Promise<HitObject[]> {
    const { query, limit } = queryOptions;
    if (!query) {
      throw new Error('Query missing for keyword search');
    }

    const should: QueryDslQueryContainer[] = [];
    const highlightFields: Record<string, SearchHighlightField> = {};

    const mainProperties: string[] = [];
    const nestedProperties: string[] = [];

    Object.entries(schemaProperties).forEach(([name, prop]) => {
      if (prop.type === 'nested' && prop.properties) {
        const nestedShould: QueryDslQueryContainer[] = [];
        const nestedHighlightFields: Record<string, SearchHighlightField> = {};

        Object.entries(prop.properties).forEach(([nestedName, nestedProp]) => {
          nestedProperties.push(`${name}.${nestedName}`);
          if (nestedProp.keyword_searchable) {
            nestedHighlightFields[`${name}.${nestedName}`] = {};
            if (nestedProp.wildcard) {
              nestedShould.push({
                wildcard: { [`${name}.${nestedName}`]: `*${query}*` },
              });
            } else {
              nestedShould.push({
                match: { [`${name}.${nestedName}`]: query },
              });
            }
          }
        });

        should.push({
          nested: {
            path: name,
            inner_hits: {
              size: limit || DEFAULT_QUERY_LIMIT,
              highlight: { fields: nestedHighlightFields },
              _source: nestedProperties,
            },
            query: { bool: { should: nestedShould } },
            score_mode: 'max',
          },
        });
      } else {
        mainProperties.push(name);
        if (prop.keyword_searchable) {
          highlightFields[name] = {};
          if (prop.wildcard) {
            should.push({
              wildcard: { [name]: `*${query}*` },
            });
          } else {
            should.push({
              match: { [name]: query },
            });
          }
        }
      }
    });

    const filter = queryOptions.filters
      ? QueryClient.transformFilter(queryOptions.filters)
      : undefined;

    const results = await this.elastic.search({
      index: indexName,
      query: {
        bool: {
          should: should,
          filter: filter,
        },
      },
      highlight: {
        fields: highlightFields,
      },
      size: limit || DEFAULT_QUERY_LIMIT,
      _source: mainProperties,
    });

    return results.hits.hits.map((hit) => QueryClient.processKeywordHit(hit));
  }

  public async vectorQuery({
    indexName,
    schemaProperties,
    queryOptions,
    textEmbeddingModel,
    multimodalEmbeddingModel,
    multimodalEnabled,
  }: {
    indexName: string;
    schemaProperties: Record<string, CollectionProperty>;
    queryOptions: QueryOptions;
    textEmbeddingModel: TextEmbeddingModel;
    multimodalEmbeddingModel: MultimodalEmbeddingModel;
    multimodalEnabled: boolean;
  }): Promise<HitObject[]> {
    if (!queryOptions.query) {
      throw new Error('Query missing for vector search');
    }

    const mainProperties: string[] = [];
    const nestedProperties: string[] = [];
    const textProperties: string[] = [];
    const multimodalProperties: string[] = [];

    Object.entries(schemaProperties).forEach(([name, prop]) => {
      if (prop.type === 'nested' && prop.properties) {
        Object.entries(prop.properties).forEach(([nestedName, nestedProp]) => {
          nestedProperties.push(`${name}.${nestedName}`);
          if (nestedProp.vector_searchable) {
            if (nestedProp.multimodal && multimodalEnabled) {
              multimodalProperties.push(`${name}.${nestedName}`);
            } else {
              textProperties.push(`${name}.${nestedName}`);
            }
          }
        });
      } else {
        mainProperties.push(name);
        if (prop.vector_searchable) {
          if (prop.multimodal && multimodalEnabled) {
            multimodalProperties.push(name);
          } else {
            textProperties.push(name);
          }
        }
      }
    });

    if (textProperties.length === 0 && multimodalProperties.length === 0) {
      throw new Error(`No vector properties found in collection`);
    }

    let textEmbeddingPromise: Promise<number[][]> | undefined;
    let multimodalEmbeddingPromise: Promise<number[][]> | undefined;

    if (textProperties.length > 0) {
      textEmbeddingPromise = this.embeddings.embedText({
        model: textEmbeddingModel,
        purpose: 'query',
        text: [queryOptions.query],
      });
    }

    if (multimodalProperties.length > 0) {
      multimodalEmbeddingPromise = this.embeddings.embedMultimodal({
        model: multimodalEmbeddingModel,
        type: 'text',
        content: [queryOptions.query],
      });
    }

    const filter = queryOptions.filters
      ? QueryClient.transformFilter(queryOptions.filters)
      : undefined;

    const textResults = textProperties.map(async (prop) => {
      const queryVector = await textEmbeddingPromise!;

      const knn: KnnQuery = {
        field: `${prop}_vector`,
        k: queryOptions.limit || DEFAULT_QUERY_LIMIT,
        num_candidates: DEFAULT_KNN_NUM_CANDIDATES,
        query_vector: queryVector[0],
        filter: filter,
      };

      if (prop.includes('.')) {
        knn.inner_hits = {
          size: queryOptions.limit || DEFAULT_QUERY_LIMIT,
          _source: nestedProperties,
        };
      }

      return this.elastic
        .search({
          index: indexName,
          knn: knn,
          size: queryOptions.limit || DEFAULT_QUERY_LIMIT,
          _source: mainProperties,
        })
        .then((res) => res.hits.hits.map((hit) => QueryClient.processVectorHit(prop, hit)))
        .catch((err) => {
          throw err;
        });
    });

    const multimodalResults = multimodalProperties.map(async (prop) => {
      const queryVector = await multimodalEmbeddingPromise!;

      const knn: KnnQuery = {
        field: `${prop}_vector`,
        k: queryOptions.limit || DEFAULT_QUERY_LIMIT,
        num_candidates: DEFAULT_KNN_NUM_CANDIDATES,
        query_vector: queryVector[0],
        filter: filter,
      };

      if (prop.includes('.')) {
        knn.inner_hits = {
          size: queryOptions.limit || DEFAULT_QUERY_LIMIT,
          _source: nestedProperties,
        };
      }

      return this.elastic
        .search({
          index: indexName,
          knn: knn,
          size: queryOptions.limit || DEFAULT_QUERY_LIMIT,
          _source: mainProperties,
        })
        .then((res) => res.hits.hits.map((hit) => QueryClient.processVectorHit(prop, hit)))
        .catch((err) => {
          throw err;
        });
    });

    const results = await Promise.all([...textResults, ...multimodalResults]);
    const hits = results.flat().sort((a, b) => b._score! - a._score!);
    const nestedProps = new Set(nestedProperties.map((prop) => prop.split('.')[0]!));
    return QueryClient.mergeHits(hits, [...nestedProps]);
  }

  public async hybridQuery({
    indexName,
    schemaProperties,
    queryOptions,
    textEmbeddingModel,
    multimodalEmbeddingModel,
    multimodalEnabled,
  }: {
    indexName: string;
    schemaProperties: Record<string, CollectionProperty>;
    queryOptions: QueryOptions;
    textEmbeddingModel: TextEmbeddingModel;
    multimodalEmbeddingModel: MultimodalEmbeddingModel;
    multimodalEnabled: boolean;
  }): Promise<HitObject[]> {
    const keywordQueryPromise = this.keywordQuery({
      indexName,
      schemaProperties,
      queryOptions,
    });

    const vectorQueryPromise = this.vectorQuery({
      indexName,
      schemaProperties,
      queryOptions,
      textEmbeddingModel,
      multimodalEmbeddingModel,
      multimodalEnabled,
    });

    const [keywordHits, vectorHits] = await Promise.all([keywordQueryPromise, vectorQueryPromise]);

    const nestedProps: string[] = Object.entries(schemaProperties)
      .filter(([name, prop]) => prop.type === 'nested' && prop.properties)
      .map(([name, prop]) => name);

    return QueryClient.blendHits(vectorHits, keywordHits, nestedProps, queryOptions.alpha);
  }

  public async imageSearch({
    indexName,
    schemaProperties,
    imageSearchOptions,
    multimodalEmbeddingModel,
  }: {
    indexName: string;
    schemaProperties: Record<string, CollectionProperty>;
    imageSearchOptions: ImageSearchOptions;
    multimodalEmbeddingModel: MultimodalEmbeddingModel;
  }): Promise<HitObject[]> {
    if (!imageSearchOptions.image) {
      throw new Error('Query missing for vector search');
    }
    const mainProperties: string[] = [];
    const nestedProperties: string[] = [];
    const multimodalProperties: string[] = [];

    Object.entries(schemaProperties).forEach(([name, prop]) => {
      if (prop.type === 'nested' && prop.properties) {
        Object.entries(prop.properties).forEach(([nestedName, nestedProp]) => {
          nestedProperties.push(`${name}.${nestedName}`);
          if (nestedProp.vector_searchable && nestedProp.multimodal) {
            multimodalProperties.push(`${name}.${nestedName}`);
          }
        });
      } else {
        mainProperties.push(name);
        if (prop.vector_searchable) {
          if (prop.multimodal === true) {
            multimodalProperties.push(name);
          }
        }
      }
    });

    if (multimodalProperties.length === 0) {
      throw new Error(`No multimodal properties in collection`);
    }

    const base64 = await QueryClient.getImageBase64(imageSearchOptions.image);
    const multimodalEmbedding = await this.embeddings.embedMultimodal({
      model: multimodalEmbeddingModel,
      type: 'text',
      content: [base64],
    });

    const filter = imageSearchOptions.filters
      ? QueryClient.transformFilter(imageSearchOptions.filters)
      : undefined;

    const multimodalResults = multimodalProperties.map(async (prop) => {
      const queryVector = multimodalEmbedding;

      const knn: KnnQuery = {
        field: `${prop}_vector`,
        k: imageSearchOptions.limit || DEFAULT_QUERY_LIMIT,
        num_candidates: DEFAULT_KNN_NUM_CANDIDATES,
        query_vector: queryVector[0],
        filter: filter,
      };

      if (prop.includes('.')) {
        knn.inner_hits = {
          size: imageSearchOptions.limit || DEFAULT_QUERY_LIMIT,
          _source: nestedProperties,
        };
      }

      return this.elastic
        .search({
          index: indexName,
          knn: knn,
          size: imageSearchOptions.limit || DEFAULT_QUERY_LIMIT,
          _source: mainProperties,
        })
        .then((res) => res.hits.hits.map((hit) => QueryClient.processVectorHit(prop, hit)))
        .catch((err) => {
          throw err;
        });
    });

    const results = await Promise.all([...multimodalResults]);
    const hits = results.flat().sort((a, b) => b._score! - a._score!);
    const nestedProps = new Set(nestedProperties.map((prop) => prop.split('.')[0]!));
    return QueryClient.mergeHits(hits, [...nestedProps]);
  }

  private static transformFilter(filters: Filter | Filter[]): QueryDslQueryContainer[] {
    const queryFilter: QueryDslQueryContainer[] = [];
    const queryOptionsFilters = Array.isArray(filters) ? filters : [filters];

    queryOptionsFilters.forEach((filter) => {
      if (filter) {
        if ('terms' in filter) {
          queryFilter.push({
            terms: filter.terms,
          });
        }

        if ('term' in filter) {
          queryFilter.push({
            term: filter.term,
          });
        }

        if ('range' in filter) {
          queryFilter.push({
            range: filter.range as Partial<Record<string, QueryDslRangeQuery>>,
          });
        }
      }
    });

    return queryFilter;
  }

  public static formatEmptyQueryHits({
    hits,
    schemaProperties,
    returnProperties,
  }: {
    hits: SearchHit<any>[];
    schemaProperties: Record<string, CollectionProperty>;
    returnProperties?: string[];
  }) {
    const hiddenProps: string[] = [];
    const noReturnByDefault: string[] = [];
    const nestedProps: string[] = [];
    const hiddenNestedProps: string[] = [];

    Object.entries(schemaProperties).forEach(([k, v]) => {
      if (v.hidden === true) {
        hiddenProps.push(k);
      }

      if (v.return_by_default === false) {
        noReturnByDefault.push(k);
      }

      if (v.type === 'nested' && !!v.properties) {
        nestedProps.push(k);
        Object.entries(v.properties).forEach(([nestedKey, nestedValue]) => {
          if (nestedValue.hidden === true) {
            hiddenNestedProps.push(`${k}.${nestedKey}`);
          }

          if (nestedValue.return_by_default === false) {
            noReturnByDefault.push(`${k}.${nestedKey}`);
          }
        });
      }
    });

    const results: object[] = [];
    const topLevelReturnProps = returnProperties?.map((prop) => prop.split('.')[0]!);

    for (const hit of hits) {
      const obj = hit._source;
      for (const key in obj) {
        if (
          (topLevelReturnProps && !topLevelReturnProps.includes(key)) ||
          (!topLevelReturnProps && noReturnByDefault.includes(key)) ||
          hiddenProps.includes(key) ||
          key.endsWith('_vector')
        ) {
          delete obj[key];
        }
      }

      for (const nestedProp of nestedProps) {
        const nestedHits = obj[nestedProp];
        if (Array.isArray(nestedHits) && nestedHits.length > 0) {
          for (const nestedHit of nestedHits) {
            for (const key in nestedHit) {
              const includesEitherReturnProp =
                returnProperties?.includes(nestedProp) ||
                returnProperties?.includes(`${nestedProp}.${key}`);
              const includesEitherNoReturn =
                noReturnByDefault.includes(nestedProp) ||
                noReturnByDefault.includes(`${nestedProp}.${key}`);
              if (
                (returnProperties && !includesEitherReturnProp) ||
                (!returnProperties && includesEitherNoReturn) ||
                hiddenNestedProps.includes(`${nestedProp}.${key}`) ||
                key.endsWith('_vector')
              ) {
                delete nestedHit[key];
              }
            }
          }

          obj[nestedProp] = nestedHits;
        } else if (nestedHits && typeof nestedHits === 'object') {
          for (const key in nestedHits) {
            const includesEitherReturnProp =
              returnProperties?.includes(nestedProp) ||
              returnProperties?.includes(`${nestedProp}.${key}`);
            const includesEitherNoReturn =
              noReturnByDefault.includes(nestedProp) ||
              noReturnByDefault.includes(`${nestedProp}.${key}`);
            if (
              (returnProperties && !includesEitherReturnProp) ||
              (!returnProperties && includesEitherNoReturn) ||
              hiddenNestedProps.includes(`${nestedProp}.${key}`) ||
              key.endsWith('_vector')
            ) {
              delete nestedHits[key];
            }
          }

          obj[nestedProp] = nestedHits;
        }
      }

      results.push(hit._source);
    }

    return results;
  }

  public static formatQueryHits({
    hits,
    schemaProperties,
    returnProperties,
  }: {
    hits: HitObject[];
    schemaProperties: Record<string, CollectionProperty>;
    returnProperties?: string[];
  }) {
    const hiddenProps: string[] = [];
    const nestedProps: string[] = [];
    const hiddenNestedProps: string[] = [];

    Object.entries(schemaProperties).forEach(([k, v]) => {
      if (v.hidden === true) {
        hiddenProps.push(k);
      }

      if (v.type === 'nested' && !!v.properties) {
        nestedProps.push(k);

        Object.entries(v.properties).forEach(([nestedKey, nestedValue]) => {
          if (nestedValue.hidden === true) {
            hiddenNestedProps.push(`${k}.${nestedKey}`);
          }
        });
      }
    });

    const topLevelReturnProps = returnProperties?.map((prop) => prop.split('.')[0]!);

    for (const hit of hits) {
      if (hit._score && hit._score < DEFAULT_SCORE_THRESHOLD) {
        const index = hits.indexOf(hit);
        hits.splice(index, 1);
        continue;
      }

      for (const key in hit._source) {
        if (
          (topLevelReturnProps && !topLevelReturnProps.includes(key)) ||
          hiddenProps.includes(key) ||
          key.endsWith('_vector')
        ) {
          delete hit._source[key];
        }
      }

      for (const nestedProp of nestedProps) {
        const nestedHits = hit._source[nestedProp];
        if (Array.isArray(nestedHits) && nestedHits.length > 0) {
          for (const nestedHit of nestedHits) {
            if (nestedHit._score && nestedHit._score < DEFAULT_SCORE_THRESHOLD) {
              const index = nestedHits.indexOf(nestedHit);
              nestedHits.splice(index, 1);
              continue;
            }

            for (const key in nestedHit._source) {
              const includesEither =
                returnProperties?.includes(nestedProp) ||
                returnProperties?.includes(`${nestedProp}.${key}`);
              if (
                (returnProperties && !includesEither) ||
                hiddenNestedProps.includes(`${nestedProp}.${key}`) ||
                key.endsWith('_vector')
              ) {
                delete nestedHit._source[key];
              }
            }
          }
        } else if (nestedHits && typeof nestedHits === 'object') {
          if (nestedHits._score && nestedHits._score < DEFAULT_SCORE_THRESHOLD) {
            hit._source[nestedProp] = nestedHits._source;
          } else {
            for (const key in nestedHits._source) {
              const includesEither =
                returnProperties?.includes(nestedProp) ||
                returnProperties?.includes(`${nestedProp}.${key}`);
              if (
                (returnProperties && !includesEither) ||
                hiddenNestedProps.includes(`${nestedProp}.${key}`) ||
                key.endsWith('_vector')
              ) {
                hit._source[nestedProp] = nestedHits._source;
              }
            }
          }
        }
      }
    }

    return hits;
  }

  private static processKeywordHit(hit: SearchHit): HitObject {
    const mainObjMatches = hit.highlight ? Object.keys(hit.highlight) : [];
    const nestedPathMatch = new Set<string>(mainObjMatches);

    const hitObj = {
      _score: hit._score,
      _match: [...nestedPathMatch],
      _source: hit._source as {
        id: string;
        hash: string;
        [key: string]: any;
      },
    };

    if (hit.inner_hits) {
      Object.entries(hit.inner_hits).forEach(([nestedMatch, innerHitsObj]) => {
        const innerHitsArr = innerHitsObj.hits.hits.map((innerHit) => {
          const nestedObjMatches = innerHit.highlight ? Object.keys(innerHit.highlight) : [];
          const nestedMatch = new Set<string>();

          nestedObjMatches.forEach((m) => {
            if (m.includes('.')) {
              const path = m.split('.')[0];
              if (path) {
                nestedPathMatch.add(path);
              }

              const match = m.split('.')[1];
              if (match) {
                nestedMatch.add(match);
              }
            } else {
              nestedMatch.add(m);
            }
          });

          return {
            _match: [...nestedMatch],
            _score: innerHit._score,
            _source: innerHit._source,
          };
        });

        hitObj['_source'][nestedMatch] = innerHitsArr;
      });
    }

    hitObj['_match'] = [...nestedPathMatch];

    return hitObj;
  }

  private static processVectorHit(path: string, hit: SearchHit): HitObject {
    const match = path.split('.')[0]!;

    const hitObj = {
      _score: hit._score,
      _match: [match],
      _source: hit._source as {
        id: string;
        hash: string;
        [key: string]: any;
      },
    };

    if (hit.inner_hits) {
      const nestedMatch = path.split('.')[1];

      Object.entries(hit.inner_hits).forEach(([_, innerHitsObj]) => {
        const innerHitsArr = innerHitsObj.hits.hits.map((innerHit) => ({
          _match: [nestedMatch],
          _score: innerHit._score,
          _source: innerHit._source,
        }));

        hitObj['_source'][match] = innerHitsArr;
      });
    }

    return hitObj;
  }

  private static mergeHits(inputArray: HitObject[], nestedProps: string[]): HitObject[] {
    const results = new Map<string, HitObject>();

    for (const obj of inputArray) {
      if (results.has(obj._source.id)) {
        const existing = results.get(obj._source.id)!;
        QueryClient.mergeObjects(existing, obj, nestedProps);
      } else {
        const clonedObj = JSON.parse(JSON.stringify(obj));
        results.set(obj._source.id, clonedObj);
      }
    }

    return Array.from(results.values()).sort((a, b) => (b._score ?? 0) - (a._score ?? 0));
  }

  private static mergeObjects(existing: HitObject, newObj: HitObject, nestedProps: string[]) {
    existing._score = Math.max(existing._score ?? 0, newObj._score ?? 0);
    existing._match = Array.from(new Set([...existing._match, ...newObj._match]));

    for (const prop of nestedProps) {
      const existingProp = existing._source[prop];
      const newProp = newObj._source[prop];

      if (Array.isArray(existingProp) && Array.isArray(newProp)) {
        QueryClient.mergeNestedArrays(existingProp, newProp);
      } else if (typeof existingProp === 'object' && typeof newProp === 'object') {
        QueryClient.mergeNestedObjects(existingProp, newProp);
      }
    }
  }

  private static mergeNestedArrays(
    existingNested: NestedHitObject[],
    newNested: NestedHitObject[]
  ): void {
    const hashIndex = new Map<string, NestedHitObject>();

    for (const item of existingNested) {
      hashIndex.set(item._source.hash, item);
    }

    for (const item of newNested) {
      if (hashIndex.has(item._source.hash)) {
        const existingItem = hashIndex.get(item._source.hash)!;
        existingItem._score = Math.max(existingItem._score ?? 0, item._score ?? 0);
        existingItem._match = Array.from(new Set([...existingItem._match, ...item._match]));
      } else {
        existingNested.push(item);
      }
    }

    existingNested.sort((a, b) => (b._score ?? 0) - (a._score ?? 0));
  }

  private static mergeNestedObjects(existingObj: NestedHitObject, newObj: NestedHitObject): void {
    existingObj._score = Math.max(existingObj._score ?? 0, newObj._score ?? 0);
    existingObj._match = Array.from(new Set([...existingObj._match, ...newObj._match]));
  }

  private static blendHits(
    vectorHits: HitObject[],
    keywordHits: HitObject[],
    nestedProps: string[],
    alpha: number = 0.5
  ): HitObject[] {
    const results = new Map<string, HitObject>();

    for (const hit of vectorHits) {
      hit._score = (hit._score ?? 0) * alpha;

      for (const nestedProp of nestedProps) {
        const nestedHits = hit._source[nestedProp];
        if (Array.isArray(nestedHits) && nestedHits.length > 0) {
          for (const nestedHit of nestedHits) {
            nestedHit._score = (nestedHit._score ?? 0) * alpha;
          }
        } else if (typeof nestedHits === 'object') {
          nestedHits._score = (nestedHits._score ?? 0) * alpha;
        }
      }

      results.set(hit._source.id, hit);
    }

    for (const hit of keywordHits) {
      hit._score = (hit._score ?? 0) * (1 - alpha);

      for (const nestedProp of nestedProps) {
        const nestedHits = hit._source[nestedProp];
        if (Array.isArray(nestedHits) && nestedHits.length > 0) {
          for (const nestedHit of nestedHits) {
            nestedHit._score = (nestedHit._score ?? 0) * (1 - alpha);
          }
        } else {
          nestedHits._score = (nestedHits._score ?? 0) * (1 - alpha);
        }
      }

      if (results.has(hit._source.id)) {
        const existing = results.get(hit._source.id)!;
        QueryClient.blendObjects(existing, hit, nestedProps);
      } else {
        const clonedObj = JSON.parse(JSON.stringify(hit));
        results.set(hit._source.id, clonedObj);
      }
    }

    return Array.from(results.values()).sort((a, b) => (b._score ?? 0) - (a._score ?? 0));
  }

  private static blendObjects(existing: HitObject, newObj: HitObject, nestedProps: string[]) {
    existing._score = (existing._score ?? 0) + (newObj._score ?? 0);
    existing._match = Array.from(new Set([...existing._match, ...newObj._match]));

    for (const prop of nestedProps) {
      const existingProp = existing._source[prop];
      const newProp = newObj._source[prop];

      if (Array.isArray(existingProp) && Array.isArray(newProp)) {
        QueryClient.blendNestedArrays(existingProp, newProp);
      } else if (typeof existingProp === 'object' && typeof newProp === 'object') {
        QueryClient.blendNestedObjects(existingProp, newProp);
      }
    }
  }

  private static blendNestedArrays(
    existingNested: NestedHitObject[],
    newNested: NestedHitObject[]
  ): void {
    const hashIndex = new Map<string, NestedHitObject>();

    for (const item of existingNested) {
      hashIndex.set(item._source.hash, item);
    }

    for (const item of newNested) {
      if (hashIndex.has(item._source.hash)) {
        const existingItem = hashIndex.get(item._source.hash)!;
        existingItem._score = (existingItem._score ?? 0) + (item._score ?? 0);
        existingItem._match = Array.from(new Set([...existingItem._match, ...item._match]));
      } else {
        existingNested.push(item);
      }
    }

    existingNested.sort((a, b) => (b._score ?? 0) - (a._score ?? 0));
  }

  private static blendNestedObjects(existingObj: NestedHitObject, newObj: NestedHitObject): void {
    existingObj._score = (existingObj._score ?? 0) + (newObj._score ?? 0);
    existingObj._match = Array.from(new Set([...existingObj._match, ...newObj._match]));
  }

  private static async getImageBase64(input: string): Promise<string> {
    if (input.startsWith('data:image')) {
      return input;
    }

    if (isValidUrl(input)) {
      const response = await axios.get(input, { responseType: 'arraybuffer' });
      const base64 = Buffer.from(response.data, 'binary').toString('base64');
      const contentType = response.headers['content-type'] || 'image/jpeg';
      return `data:${contentType};base64,${base64}`;
    }

    return input;
  }
}
