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
    linkedAccountId,
    indexName,
    schemaProperties,
    queryOptions,
  }: {
    linkedAccountId: string;
    indexName: string;
    schemaProperties: Record<string, CollectionProperty>;
    queryOptions?: QueryOptions;
  }): Promise<object[]> {
    const req: SearchRequest = {
      index: indexName,
      size: queryOptions?.limit || DEFAULT_QUERY_LIMIT,
    };

    if (queryOptions?.filter) {
      const filter = QueryClient.transformFilter(queryOptions.filter, schemaProperties);
      req.query = {
        bool: {
          must: filter,
          filter: { term: { linked_account_id: linkedAccountId } },
        },
      };
    } else {
      req.query = { term: { linked_account_id: linkedAccountId } };
    }

    const res = await this.elastic.search(req);
    return QueryClient.formatEmptyQueryHits({
      hits: res.hits.hits,
      schemaProperties,
      returnProperties: queryOptions?.returnProperties,
    });
  }

  public async keywordQuery({
    linkedAccountId,
    indexName,
    schemaProperties,
    queryOptions,
    noFormat,
  }: {
    linkedAccountId: string;
    indexName: string;
    schemaProperties: Record<string, CollectionProperty>;
    queryOptions: QueryOptions;
    noFormat?: boolean;
  }) {
    const { query, limit } = queryOptions;
    if (!query) {
      throw new Error('Query missing for keyword search');
    }

    const should: QueryDslQueryContainer[] = [];
    const highlightFields: Record<string, SearchHighlightField> = {};
    const mainProperties: string[] = ['hash'];
    const nestedProperties: string[] = [];

    Object.entries(schemaProperties).forEach(([name, prop]) => {
      if (prop.type === 'nested' && prop.properties) {
        nestedProperties.push(`${name}.hash`);
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

    const filter = queryOptions.filter
      ? QueryClient.transformFilter(queryOptions.filter, schemaProperties)
      : undefined;

    const res = await this.elastic.search({
      index: indexName,
      query: {
        bool: {
          should: should,
          must: filter,
          filter: { term: { linked_account_id: linkedAccountId } },
        },
      },
      highlight: {
        fields: highlightFields,
      },
      size: limit || DEFAULT_QUERY_LIMIT,
      _source: mainProperties,
    });

    const keywordHits = res.hits.hits.map((hit) => {
      return QueryClient.processKeywordHit(hit);
    });

    const nestedProps = new Set(nestedProperties.map((prop) => prop.split('.')[0]!));
    QueryClient.normalizeScores(keywordHits, [...nestedProps]);

    if (noFormat) {
      return keywordHits;
    }

    return QueryClient.formatQueryHits({
      hits: keywordHits,
      schemaProperties,
      returnProperties: queryOptions.returnProperties,
      limit: queryOptions.limit,
    });
  }

  public async vectorQuery({
    linkedAccountId,
    indexName,
    schemaProperties,
    queryOptions,
    textEmbeddingModel,
    multimodalEmbeddingModel,
    multimodalEnabled,
    noFormat,
  }: {
    linkedAccountId: string;
    indexName: string;
    schemaProperties: Record<string, CollectionProperty>;
    queryOptions: QueryOptions;
    textEmbeddingModel: TextEmbeddingModel;
    multimodalEmbeddingModel: MultimodalEmbeddingModel;
    multimodalEnabled: boolean;
    noFormat?: boolean;
  }) {
    if (!queryOptions.query) {
      throw new Error('Query missing for vector search');
    }

    const mainProperties: string[] = ['hash'];
    const nestedProperties: string[] = [];
    const textProperties: string[] = [];
    const multimodalProperties: string[] = [];

    Object.entries(schemaProperties).forEach(([name, prop]) => {
      if (prop.type === 'nested' && prop.properties) {
        nestedProperties.push(`${name}.hash`);
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

    const filter = queryOptions.filter
      ? QueryClient.transformFilter(queryOptions.filter, schemaProperties)
      : undefined;

    const textResults = textProperties.map(async (prop) => {
      const queryVector = await textEmbeddingPromise!;

      const knn: KnnQuery = {
        field: `${prop}_vector`,
        k: queryOptions.limit || DEFAULT_QUERY_LIMIT,
        num_candidates: DEFAULT_KNN_NUM_CANDIDATES,
        query_vector: queryVector[0],
        filter: {
          bool: {
            must: filter,
            filter: { term: { linked_account_id: linkedAccountId } },
          },
        },
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
        .then((res) =>
          res.hits.hits.map((hit) => {
            return QueryClient.processVectorHit(prop, hit);
          })
        )
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
        filter: {
          bool: {
            must: filter,
            filter: { term: { linked_account_id: linkedAccountId } },
          },
        },
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
        .then((res) =>
          res.hits.hits.map((hit) => {
            return QueryClient.processVectorHit(prop, hit);
          })
        )
        .catch((err) => {
          throw err;
        });
    });

    const results = await Promise.all([...textResults, ...multimodalResults]);
    const hits = results.flat().sort((a, b) => b._score! - a._score!);
    const nestedProps = new Set(nestedProperties.map((prop) => prop.split('.')[0]!));

    QueryClient.normalizeScores(hits, [...nestedProps]);
    const vectorHits = QueryClient.mergeHits(hits, [...nestedProps]);

    if (noFormat) {
      return vectorHits;
    }

    return QueryClient.formatQueryHits({
      hits: vectorHits,
      schemaProperties,
      returnProperties: queryOptions.returnProperties,
      limit: queryOptions.limit,
    });
  }

  public async hybridQuery({
    linkedAccountId,
    indexName,
    schemaProperties,
    queryOptions,
    textEmbeddingModel,
    multimodalEmbeddingModel,
    multimodalEnabled,
  }: {
    linkedAccountId: string;
    indexName: string;
    schemaProperties: Record<string, CollectionProperty>;
    queryOptions: QueryOptions;
    textEmbeddingModel: TextEmbeddingModel;
    multimodalEmbeddingModel: MultimodalEmbeddingModel;
    multimodalEnabled: boolean;
  }): Promise<object[]> {
    const keywordQueryPromise = this.keywordQuery({
      linkedAccountId,
      indexName,
      schemaProperties,
      queryOptions,
      noFormat: true,
    });

    const vectorQueryPromise = this.vectorQuery({
      linkedAccountId,
      indexName,
      schemaProperties,
      queryOptions,
      textEmbeddingModel,
      multimodalEmbeddingModel,
      multimodalEnabled,
      noFormat: true,
    });

    const [keywordHits, vectorHits] = await Promise.all([keywordQueryPromise, vectorQueryPromise]);

    const nestedProps: string[] = Object.entries(schemaProperties)
      .filter(([name, prop]) => prop.type === 'nested' && prop.properties)
      .map(([name, prop]) => name);

    const blendedHits = QueryClient.blendHits(
      vectorHits as HitObject[],
      keywordHits as HitObject[],
      nestedProps,
      queryOptions.alpha
    );

    return QueryClient.formatQueryHits({
      hits: blendedHits,
      schemaProperties,
      returnProperties: queryOptions.returnProperties,
      limit: queryOptions.limit,
    });
  }

  public async imageSearch({
    linkedAccountId,
    indexName,
    schemaProperties,
    returnProperties,
    imageSearchOptions,
    multimodalEmbeddingModel,
  }: {
    linkedAccountId: string;
    indexName: string;
    schemaProperties: Record<string, CollectionProperty>;
    returnProperties?: string[];
    imageSearchOptions: ImageSearchOptions;
    multimodalEmbeddingModel: MultimodalEmbeddingModel;
  }) {
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
      ? QueryClient.transformFilter(imageSearchOptions.filters, schemaProperties)
      : undefined;

    const multimodalResults = multimodalProperties.map(async (prop) => {
      const queryVector = multimodalEmbedding;

      const knn: KnnQuery = {
        field: `${prop}_vector`,
        k: imageSearchOptions.limit || DEFAULT_QUERY_LIMIT,
        num_candidates: DEFAULT_KNN_NUM_CANDIDATES,
        query_vector: queryVector[0],
        filter: {
          bool: {
            must: filter,
            filter: { term: { linked_account_id: linkedAccountId } },
          },
        },
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
    const mergedHits = QueryClient.mergeHits(hits, [...nestedProps]);

    return QueryClient.formatQueryHits({
      hits: mergedHits,
      schemaProperties,
      returnProperties,
      limit: imageSearchOptions.limit,
    });
  }

  private static normalizeScores(hits: HitObject[], nestedProps: string[]) {
    const scores = hits.map((hit) => hit._score ?? 0).filter((score) => !isNaN(score));
    if (scores.length === 0) {
      return;
    }

    const minScore = Math.min(...scores);
    const maxScore = Math.max(...scores);

    if (maxScore === minScore) {
      hits.forEach((hit) => {
        hit._score = 1;
        nestedProps.forEach((prop) => {
          const nestedItems = hit._source[prop];
          if (Array.isArray(nestedItems)) {
            nestedItems.forEach((item) => (item._score = 1));
          }
        });
      });
      return;
    }

    hits.forEach((hit) => {
      hit._score = ((hit._score ?? 0) - minScore) / (maxScore - minScore);
      nestedProps.forEach((prop) => {
        const nestedItems = hit._source[prop];
        if (Array.isArray(nestedItems)) {
          nestedItems.forEach((item) => {
            item._score = ((item._score ?? 0) - minScore) / (maxScore - minScore);
          });
        }
      });
    });
  }

  private static transformFilter(
    filters: Filter | Filter[],
    schemaProperties: Record<string, CollectionProperty>
  ): QueryDslQueryContainer[] {
    const queryFilter: QueryDslQueryContainer[] = [];
    const queryOptionsFilters = Array.isArray(filters) ? filters : [filters];

    const mustAppendKeyword: string[] = [];
    Object.entries(schemaProperties).forEach(([name, prop]) => {
      if (prop.filterable && prop.keyword_searchable) {
        mustAppendKeyword.push(name);
      }

      if (prop.type === 'nested' && prop.properties) {
        Object.entries(prop.properties).forEach(([nestedName, nestedProp]) => {
          if (nestedProp.filterable && nestedProp.keyword_searchable) {
            mustAppendKeyword.push(`${name}.${nestedName}`);
          }
        });
      }
    });

    queryOptionsFilters.forEach((filter) => {
      if (filter) {
        if ('terms' in filter) {
          const field = Object.keys(filter.terms)[0];
          if (field && mustAppendKeyword.includes(field)) {
            queryFilter.push({
              terms: { [`${field}.keyword`]: filter.terms[field]! },
            });
          } else {
            queryFilter.push({
              terms: filter.terms,
            });
          }
        }

        if ('term' in filter) {
          const field = Object.keys(filter.term)[0];
          if (field && mustAppendKeyword.includes(field)) {
            queryFilter.push({
              term: { [`${field}.keyword`]: filter.term[field] },
            });
          } else {
            queryFilter.push({
              term: filter.term,
            });
          }
        }

        if ('range' in filter) {
          const field = Object.keys(filter.range)[0];
          if (field && mustAppendKeyword.includes(field)) {
            queryFilter.push({
              range: {
                [`${field}.keyword`]: filter.range[field],
              } as Partial<Record<string, QueryDslRangeQuery>>,
            });
          } else {
            queryFilter.push({
              range: filter.range as Partial<Record<string, QueryDslRangeQuery>>,
            });
          }
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
    const hiddenProps: string[] = ['hash'];
    const noReturnByDefault: string[] = [];
    const nestedProps: string[] = [];
    const hiddenNestedProps: string[] = ['hash'];

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
    limit,
  }: {
    hits: HitObject[];
    schemaProperties: Record<string, CollectionProperty>;
    returnProperties?: string[];
    limit?: number;
  }) {
    const hiddenProps: string[] = ['hash'];
    const nestedProps: string[] = [];
    const hiddenNestedProps: string[] = [];

    Object.entries(schemaProperties).forEach(([k, v]) => {
      if (v.hidden === true) {
        hiddenProps.push(k);
      }

      if (v.type === 'nested' && !!v.properties) {
        nestedProps.push(k);
        hiddenNestedProps.push(`${k}.hash`);

        Object.entries(v.properties).forEach(([nestedKey, nestedValue]) => {
          if (nestedValue.hidden === true) {
            hiddenNestedProps.push(`${k}.${nestedKey}`);
          }
        });
      }
    });

    const topLevelReturnProps = returnProperties?.map((prop) => prop.split('.')[0]!);
    const results: HitObject[] = [];

    for (const hit of hits) {
      if (hit._score && hit._score > DEFAULT_SCORE_THRESHOLD) {
        const result = { ...hit };

        for (const key in result._source) {
          if (
            (topLevelReturnProps && !topLevelReturnProps.includes(key)) ||
            hiddenProps.includes(key) ||
            key.endsWith('_vector')
          ) {
            delete result._source[key];
          }
        }

        for (const nestedProp of nestedProps) {
          const nested = result._source[nestedProp];
          const nestedResults: NestedHitObject[] = [];

          if (Array.isArray(nested) && nested.length > 0) {
            for (const nestedHit of nested) {
              if (nestedHit._score && nestedHit._score > DEFAULT_SCORE_THRESHOLD) {
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

                nestedResults.push(nestedHit);
              }
            }

            const nestedArr = nestedResults.slice(0, limit || DEFAULT_QUERY_LIMIT);
            const nestedSources = nestedArr.map((hit) => hit._source);
            result._source[nestedProp] = nestedSources;
          } else if (nested && typeof nested === 'object') {
            for (const key in nested._source) {
              const includesEither =
                returnProperties?.includes(nestedProp) ||
                returnProperties?.includes(`${nestedProp}.${key}`);
              if (
                (returnProperties && !includesEither) ||
                hiddenNestedProps.includes(`${nestedProp}.${key}`) ||
                key.endsWith('_vector')
              ) {
                delete result._source[key];
              }
            }
          }
        }

        results.push(result);
      }
    }

    const resultsArr = results.slice(0, limit || DEFAULT_QUERY_LIMIT);
    return resultsArr.map((hit) => hit._source);
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
        const merged = QueryClient.mergeObjects(existing, obj, nestedProps);
        results.set(obj._source.id, merged);
      } else {
        results.set(obj._source.id, obj);
      }
    }

    return Array.from(results.values()).sort((a, b) => (b._score ?? 0) - (a._score ?? 0));
  }

  private static mergeObjects(
    existingObj: HitObject,
    newObj: HitObject,
    nestedProps: string[]
  ): HitObject {
    const mergedObj = { ...existingObj };

    mergedObj._score = Math.max(existingObj._score ?? 0, newObj._score ?? 0);
    mergedObj._match = Array.from(new Set([...existingObj._match, ...newObj._match]));

    for (const key in newObj._source) {
      if (!nestedProps.includes(key)) {
        if (key in existingObj._source) {
          const existingScore = existingObj._source[key]._score ?? 0;
          const newScore = newObj._source[key]._score ?? 0;
          if (newScore > existingScore) {
            mergedObj._source[key] = newObj._source[key];
          }
        } else {
          mergedObj._source[key] = newObj._source[key];
        }
      } else {
        if (Array.isArray(existingObj._source[key]) || Array.isArray(newObj._source[key])) {
          const existingArray = existingObj._source[key] || [];
          const newArray = newObj._source[key] || [];
          const hashIndex = new Map<string, NestedHitObject>();
          for (const item of existingArray) {
            hashIndex.set(item._source.hash, item);
          }

          for (const item of newArray) {
            if (hashIndex.has(item._source.hash)) {
              const existingItem = hashIndex.get(item._source.hash)!;
              const mergedItem = QueryClient.mergeNestedObjects(existingItem, item);
              hashIndex.set(item._source.hash, mergedItem);
            } else {
              hashIndex.set(item._source.hash, item);
            }
          }

          mergedObj._source[key] = Array.from(hashIndex.values()).sort(
            (a, b) => (b._score ?? 0) - (a._score ?? 0)
          );
        } else if (
          typeof existingObj._source[key] === 'object' ||
          typeof newObj._source[key] === 'object'
        ) {
          mergedObj._source[key] = QueryClient.mergeNestedObjects(
            existingObj._source[key],
            newObj._source[key]
          );
        }
      }
    }

    return mergedObj;
  }

  private static mergeNestedObjects(
    existingObj: NestedHitObject,
    newObj: NestedHitObject
  ): NestedHitObject {
    const mergedObj = { ...existingObj };

    mergedObj._score = Math.max(existingObj._score ?? 0, newObj._score ?? 0);
    mergedObj._match = Array.from(new Set([...existingObj._match, ...newObj._match]));

    for (const key in newObj._source) {
      if (key in existingObj._source) {
        const existingScore = existingObj._source[key]._score ?? 0;
        const newScore = newObj._source[key]._score ?? 0;
        if (newScore > existingScore) {
          mergedObj._source[key] = newObj._source[key];
        }
      } else {
        mergedObj._source[key] = newObj._source[key];
      }
    }

    return mergedObj;
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
        const nested = hit._source[nestedProp];
        if (Array.isArray(nested) && nested.length > 0) {
          for (const nestedHit of nested) {
            nestedHit._score = (nestedHit._score ?? 0) * alpha;
          }
        } else if (typeof nested === 'object') {
          nested._score = (nested._score ?? 0) * alpha;
        }
      }

      results.set(hit._source.id, hit);
    }

    for (const hit of keywordHits) {
      hit._score = (hit._score ?? 0) * (1 - alpha);
      for (const nestedProp of nestedProps) {
        const nested = hit._source[nestedProp];
        if (Array.isArray(nested) && nested.length > 0) {
          for (const nestedHit of nested) {
            nestedHit._score = (nestedHit._score ?? 0) * (1 - alpha);
          }
        } else {
          nested._score = (nested._score ?? 0) * (1 - alpha);
        }
      }

      if (results.has(hit._source.id)) {
        const existing = results.get(hit._source.id)!;
        const blended = QueryClient.blendObjects(existing, hit, nestedProps);
        results.set(hit._source.id, blended);
      } else {
        results.set(hit._source.id, hit);
      }
    }

    return Array.from(results.values()).sort((a, b) => (b._score ?? 0) - (a._score ?? 0));
  }

  private static blendObjects(existingObj: HitObject, newObj: HitObject, nestedProps: string[]) {
    const blendedObj = { ...existingObj };

    blendedObj._score = Math.max(existingObj._score ?? 0, newObj._score ?? 0);
    blendedObj._match = Array.from(new Set([...existingObj._match, ...newObj._match]));

    for (const key in newObj._source) {
      if (!nestedProps.includes(key)) {
        if (key in existingObj._source) {
          const existingScore = existingObj._source[key]._score ?? 0;
          const newScore = newObj._source[key]._score ?? 0;
          if (newScore > existingScore) {
            blendedObj._source[key] = newObj._source[key];
          }
        } else {
          blendedObj._source[key] = newObj._source[key];
        }
      } else {
        if (Array.isArray(existingObj._source[key]) || Array.isArray(newObj._source[key])) {
          const existingArray = existingObj._source[key] || [];
          const newArray = newObj._source[key];
          const hashIndex = new Map<string, NestedHitObject>();
          for (const item of existingArray) {
            hashIndex.set(item._source.hash, item);
          }

          for (const item of newArray) {
            if (hashIndex.has(item._source.hash)) {
              const existingItem = hashIndex.get(item._source.hash)!;
              const mergedItem = QueryClient.mergeNestedObjects(existingItem, item);
              hashIndex.set(item._source.hash, mergedItem);
            } else {
              hashIndex.set(item._source.hash, item);
            }
          }

          blendedObj._source[key] = Array.from(hashIndex.values()).sort(
            (a, b) => (b._score ?? 0) - (a._score ?? 0)
          );
        } else if (
          typeof existingObj._source[key] === 'object' ||
          typeof newObj._source[key] === 'object'
        ) {
          blendedObj._source[key] = QueryClient.mergeNestedObjects(
            existingObj._source[key],
            newObj._source[key]
          );
        }
      }
    }

    return blendedObj;
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
