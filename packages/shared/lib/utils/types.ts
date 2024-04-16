export interface InitialSyncArgs {
  environmentId: string;
  integrationKey: string;
  linkedAccountId: string;
  collectionKey: string;
  syncRunId: string;
  lastSyncedAt: number | null;
  activityId: string | null;
}

export interface FullSyncArgs {
  environmentId: string;
  integrationKey: string;
  linkedAccountId: string;
  collectionKey: string;
  syncRunId: string;
  activityId: string | null;
}

export interface IncrementalSyncArgs {
  environmentId: string;
  integrationKey: string;
  linkedAccountId: string;
  collectionKey: string;
  syncRunId?: string;
  lastSyncedAt?: number | null;
  activityId?: string | null;
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
  filters?: any;
  returnProperties?: string[];
  limit?: number;
  alpha?: number;
  disableMultimodal?: boolean;
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

export interface HitObject {
  _score: number | null | undefined;
  _match: string[];
  _source: {
    id: string;
    hash: string;
    [key: string]: any;
  };
}

export type NestedHitObject = {
  _score: number | null | undefined;
  _match: string[];
  _source: {
    hash: string;
    [key: string]: any;
  };
};
