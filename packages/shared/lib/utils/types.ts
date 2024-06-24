import { AuthScheme, SourceObject } from '@embed/providers';
import { Invitation, Organization, OrganizationMembership, User } from '@workos-inc/node';
import { z } from 'zod';
import { MeterEvent, UsageType } from './enums';

export enum EnvironmentType {
  Staging = 'staging',
  Production = 'production',
}

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

export interface BaseUsageObject {
  usageType: UsageType;
}

export interface ConnectionUsageObject extends BaseUsageObject {
  usageType: UsageType.Connection;
  environmentId: string;
  integrationId: string;
  connectionId: string;
  action: 'created' | 'deleted';
}

export interface QueryUsageObject extends BaseUsageObject {
  usageType: UsageType.Query;
  queryType: 'text' | 'image';
  environmentId: string;
  integrationId: string;
  connectionId: string;
}

export interface ActionUsageObject extends BaseUsageObject {
  usageType: UsageType.Action;
  environmentId: string;
  integrationId: string;
  connectionId: string;
  actionRunId: string;
}

export interface ProxyRequestUsageObject extends BaseUsageObject {
  usageType: UsageType.ProxyRequest;
  environmentId: string;
  integrationId: string;
  connectionId: string;
}

export interface SyncUsageObject extends BaseUsageObject {
  usageType: UsageType.Sync;
  environmentId: string;
  integrationId: string;
  connectionId: string;
  syncRunId: string;
  syncedWords: number;
  syncedImages: number;
  syncedAudioSeconds: number;
  syncedVideoSeconds: number;
}

export type UsageObject =
  | ConnectionUsageObject
  | QueryUsageObject
  | ActionUsageObject
  | ProxyRequestUsageObject
  | SyncUsageObject;

export interface BaseUsageRecord {
  organizationId: string;
  meterEvent: MeterEvent;
}

export interface UsageRecordWithValue extends BaseUsageRecord {
  meterEvent:
    | MeterEvent.SyncedWords
    | MeterEvent.SyncedImages
    | MeterEvent.SyncedVideo
    | MeterEvent.SyncedAudio;
  value: number;
}

export interface UsageRecordWithoutValue extends BaseUsageRecord {
  meterEvent:
    | MeterEvent.TextQueries
    | MeterEvent.ImageQueries
    | MeterEvent.Actions
    | MeterEvent.ProxyRequests;
}

export type UsageRecord = UsageRecordWithValue | UsageRecordWithoutValue;

export const StripePriceIdsSchema = z.object({
  connections: z.string(),
  text_queries: z.string(),
  image_queries: z.string(),
  synced_words: z.string(),
  synced_images: z.string(),
  synced_audio: z.string(),
  synced_video: z.string(),
  actions: z.string(),
  proxy_requests: z.string(),
});

export type StripePriceIds = z.infer<typeof StripePriceIdsSchema>;
