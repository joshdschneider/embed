import { SourceObject } from '@embed/providers';

export interface SyncArgs {
  environmentId: string;
  integrationKey: string;
  linkedAccountId: string;
  collectionKey: string;
}

export interface ActionArgs {
  environmentId: string;
  integrationKey: string;
  linkedAccountId: string;
  actionKey: string;
  activityId: string | null;
}

export type Branding = {
  name: string | null;
  appearance: string;
  border_radius: string;
  light_mode: {
    logo: string | null;
    favicon: string | null;
    page_background: string;
    button_background: string;
    button_text: string;
    links: string;
  };
  dark_mode: {
    logo: string | null;
    favicon: string | null;
    page_background: string;
    button_background: string;
    button_text: string;
    links: string;
  };
};

export type QueryOptions = {
  type?: 'vector' | 'hybrid' | 'keyword';
  query?: string;
  filter?: any;
  returnProperties?: string[];
  limit?: number;
  alpha?: number;
  disableMultimodal?: boolean;
};

export type ImageSearchOptions = {
  image: string;
  filters?: any;
  returnProperties?: string[];
  limit?: number;
};

export interface TermFilter {
  term: {
    [field: string]: string | number | boolean;
  };
}

export interface TermsFilter {
  terms: {
    [field: string]: Array<string | number | boolean>;
  };
}

export interface RangeFilter {
  range: {
    [field: string]: {
      gte?: number | string;
      lte?: number | string;
      gt?: number | string;
      lt?: number | string;
    };
  };
}

export interface ExistsFilter {
  exists: {
    field: string;
  };
}

export type Filter = TermFilter | TermsFilter | RangeFilter | ExistsFilter;

export type SourceObjectWithHash = SourceObject & { hash: string };

export type NestedSourceObjectWithHash = Omit<SourceObject, 'id'> & { hash: string };

export interface HitObject {
  _score: number | null | undefined;
  _match: string[];
  _source: SourceObjectWithHash;
}

export type NestedHitObject = {
  _score: number | null | undefined;
  _match: string[];
  _source: NestedSourceObjectWithHash;
};
