import { AuthScheme, SourceObject } from '@embed/providers';
import { Invitation, Organization, OrganizationMembership, User } from '@workos-inc/node';

export type WorkOSUser = User;
export type WorkOSOrganization = Organization;
export type WorkOSOrganizationMembership = OrganizationMembership;
export type WorkOSInvitation = Invitation;

export interface SyncArgs {
  environmentId: string;
  integrationId: string;
  providerKey: string;
  connectionId: string;
  collectionKey: string;
}

export interface ActionArgs {
  environmentId: string;
  integrationId: string;
  providerKey: string;
  connectionId: string;
  actionKey: string;
  activityId: string | null;
}

export type Branding = {
  appearance: string;
  border_radius: string;
  light_mode: {
    text: string;
    border: string;
    page_background: string;
    button_background: string;
    button_text: string;
  };
  dark_mode: {
    text: string;
    border: string;
    page_background: string;
    button_background: string;
    button_text: string;
  };
};

export type OAuth2Credentials = {
  type: AuthScheme.OAuth2;
  access_token: string;
  refresh_token: string;
  expires_at?: Date;
  raw: Record<string, any>;
};

export type OAuth1Credentials = {
  type: AuthScheme.OAuth1;
  oauth_token: string;
  oauth_token_secret: string;
  raw: Record<string, any>;
};

export type QueryOptions = {
  type?: 'vector' | 'hybrid' | 'keyword';
  query?: string;
  filter?: any;
  returnProperties?: string[];
  limit?: number;
  alpha?: number;
};

export type ImageSearchOptions = QueryOptions & {
  image?: string;
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

export type Metadata = Record<string, any> | null;

export type ConnectionWebhookEvent = 'connection.created' | 'connection.updated';

export interface ConnectionWebhookBody {
  event: ConnectionWebhookEvent;
  integration: string;
  connection: string;
  configuration: Record<string, any>;
  metadata: Metadata;
  created_at: number;
  updated_at: number;
}

export type SyncWebhookEvent = 'sync.succeeded' | 'sync.failed';

export interface SyncWebhookBody {
  event: SyncWebhookEvent;
  integration: string;
  connection: string;
  collection: string;
  results?: {
    records_added: number;
    records_updated: number;
    records_deleted: number;
  };
  reason?: string;
  timestamp: number;
}

export type WebhookBody = ConnectionWebhookBody | SyncWebhookBody;
