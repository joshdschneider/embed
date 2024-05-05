import { AuthScheme } from '@embed/providers';
import { Branding, SyncRunStatus, SyncStatus } from '@embed/shared';
import { z } from 'zod';

export enum EnvironmentType {
  Staging = 'staging',
  Production = 'production',
}

export enum ConnectionType {
  Individual = 'individual',
  Organization = 'organization',
}

export interface DefaultTemplateData {
  branding: Branding;
  prefers_dark_mode: boolean;
}

export interface ErrorTemplateData extends DefaultTemplateData {
  error_message: string;
}

export interface ConfigTemplateData extends DefaultTemplateData {
  server_url: string;
  connect_token: string;
  integration: {
    provider_key: string;
    name: string;
    logo_url: string | undefined;
    logo_url_dark_mode: string | undefined;
  };
  configuration_fields: {
    name: string;
    label: string;
  }[];
}

export interface ApiKeyTemplateData extends DefaultTemplateData {
  server_url: string;
  connect_token: string;
  integration: {
    provider_key: string;
    name: string;
    logo_url: string | undefined;
    logo_url_dark_mode: string | undefined;
  };
}

export interface ServiceAccountTemplateData extends DefaultTemplateData {
  server_url: string;
  connect_token: string;
  integration: {
    provider_key: string;
    name: string;
    logo_url: string | undefined;
    logo_url_dark_mode: string | undefined;
  };
}

export interface BasicTemplateData extends DefaultTemplateData {
  server_url: string;
  connect_token: string;
  integration: {
    provider_key: string;
    name: string;
    logo_url: string | undefined;
    logo_url_dark_mode: string | undefined;
  };
}

export interface PreviewTemplateData extends DefaultTemplateData {
  server_url: string;
  integration: {
    name: string;
    logo_url: string | undefined;
    logo_url_dark_mode: string | undefined;
  };
}

export type UserObject = {
  object: 'user';
  id: string;
  email: string;
  first_name: string | null;
  last_name: string | null;
};

export type InvitationObject = {
  object: 'invitation';
  id: string;
  email: string;
  state: 'pending' | 'accepted' | 'revoked' | 'expired';
  acceptedAt?: string;
  revokedAt?: string;
  expiresAt: string;
  token: string;
  acceptInvitationUrl: string;
  organizationId?: string;
  createdAt: string;
  updatedAt: string;
};

export interface EnvironmentObject {
  object: 'environment';
  id: string;
  organization_id: string;
  type: EnvironmentType;
  auto_enable_collections: boolean;
  auto_enable_actions: boolean;
  auto_start_syncs: boolean;
  default_sync_frequency: string;
  default_text_embedding_model: string;
  default_multimodal_embedding_model: string;
  multimodal_enabled_by_default: boolean;
  branding: any;
  created_at: number;
  updated_at: number;
}

export interface OrganizationObject {
  object: 'organization';
  id: string;
  name: string;
  created_at: number;
  updated_at: number;
}

export interface IntegrationObject {
  object: 'integration';
  id: string;
  provider_key: string;
  logo_url: string | null;
  logo_url_dark_mode: string | null;
  display_name: string | null;
  auth_scheme: AuthScheme;
  is_enabled: boolean;
  created_at: number;
  updated_at: number;
}

export type IntegrationObjectWithCredentials = IntegrationObject & {
  is_using_test_credentials: boolean;
  oauth_client_id: string | null;
  oauth_client_secret: string | null;
  oauth_scopes: string[];
};

export const CreateIntegrationRequestSchema = z.object({
  provider_key: z.string(),
  auth_scheme: z.union([
    z.literal(AuthScheme.OAuth2),
    z.literal(AuthScheme.OAuth1),
    z.literal(AuthScheme.Basic),
    z.literal(AuthScheme.ApiKey),
    z.literal(AuthScheme.ServiceAccount),
    z.literal(AuthScheme.None),
  ]),
  display_name: z.string().optional().nullable(),
  is_using_test_credentials: z.boolean().optional(),
  oauth_client_id: z.string().optional().nullable(),
  oauth_client_secret: z.string().optional().nullable(),
  oauth_scopes: z.array(z.string()).optional().nullable(),
});

export type CreateIntegrationRequest = z.infer<typeof CreateIntegrationRequestSchema>;

export const UpdateIntegrationRequestSchema = z.object({
  display_name: z.string().optional().nullable(),
  is_using_test_credentials: z.boolean().optional(),
  oauth_client_id: z.string().optional().nullable(),
  oauth_client_secret: z.string().optional().nullable(),
  oauth_scopes: z.array(z.string()).optional().nullable(),
});

export type UpdateIntegrationRequest = z.infer<typeof UpdateIntegrationRequestSchema>;

export interface CollectionObject {
  object: 'collection';
  unique_key: string;
  integration_id: string;
  provider_key: string;
  is_enabled: boolean;
  default_sync_frequency: string;
  auto_start_syncs: boolean;
  exclude_properties_from_syncs: string[];
  text_embedding_model: string;
  multimodal_embedding_model: string;
  multimodal_enabled: boolean;
  created_at: number;
  updated_at: number;
}

export const UpdateCollectionRequestSchema = z.object({
  is_enabled: z.boolean().optional(),
  default_sync_frequency: z.string().optional(),
  auto_start_syncs: z.boolean().optional(),
  exclude_properties_from_syncs: z.array(z.string()).optional(),
  text_embedding_model: z.string().optional(),
  multimodal_embedding_model: z.string().optional(),
  multimodal_enabled: z.boolean().optional(),
});

export type UpdateCollectionRequest = z.infer<typeof UpdateCollectionRequestSchema>;

export interface ActionObject {
  object: 'action';
  unique_key: string;
  integration_id: string;
  provider_key: string;
  is_enabled: boolean;
  created_at: number;
  updated_at: number;
}

export interface ActionRunObject {
  object: 'action_run';
  action_key: string;
  integration_id: string;
  connection_id: string;
  created_at: number;
  updated_at: number;
}

export interface ConnectTokenObject {
  object: 'connect_token';
  token: string;
  url: string;
  integration_id: string;
  connection_id: string | null;
  expires_in_mins: number;
  type: ConnectionType | null;
  language: string;
  redirect_url: string | null;
  metadata: Record<string, any> | null;
  configuration: Record<string, any> | null;
  created_at: number;
}

export interface ConnectTokenDeletedObject {
  object: 'connect_token.deleted';
  token: string;
  deleted: true;
}

export const CreateConnectTokenRequestSchema = z.object({
  integration_id: z.string(),
  connection_id: z.string().optional().nullable(),
  expires_in_mins: z.number().optional().nullable(),
  language: z.string().optional().nullable(),
  redirect_url: z.string().optional().nullable(),
  type: z.string().optional(),
  display_name: z.string().optional().nullable(),
  configuration: z.record(z.string(), z.any()).optional().nullable(),
  inclusions: z.record(z.string(), z.any()).optional().nullable(),
  exclusions: z.record(z.string(), z.any()).optional().nullable(),
  metadata: z.record(z.string(), z.any()).optional().nullable(),
});

export interface ConnectionObject {
  object: 'connection';
  id: string;
  integration_id: string;
  display_name: string | null;
  type: string;
  auth_scheme: AuthScheme;
  configuration: Record<string, any> | null;
  inclusions: Record<string, any> | null;
  exclusions: Record<string, any> | null;
  metadata: Record<string, any> | null;
  created_at: number;
  updated_at: number;
}

export const UpdateConnectionRequestSchema = z.object({
  configuration: z.record(z.string(), z.any()).optional().nullable(),
  metadata: z.record(z.string(), z.any()).optional().nullable(),
});

export interface ConnectionDeletedObject {
  object: 'connection.deleted';
  id: string;
  deleted: true;
}

export interface SyncObject {
  object: 'sync';
  collection_key: string;
  integration_id: string;
  provider_key: string;
  connection_id: string;
  status: SyncStatus;
  frequency: string;
  last_synced_at: number | null;
  created_at: number;
  updated_at: number;
}

export const UpdateSyncRequestSchema = z.object({
  frequency: z.string(),
});

export interface SyncRunObject {
  object: 'sync_run';
  collection_key: string;
  integration_id: string;
  connection_id: string;
  status: SyncRunStatus;
  records_added: number | null;
  records_updated: number | null;
  records_deleted: number | null;
  created_at: number;
  updated_at: number;
}

export interface WebhookObject {
  object: 'webhook';
  id: string;
  url: string;
  events: string[];
  is_enabled: boolean;
  signing_secret: string;
  created_at: number;
  updated_at: number;
}

export const CreateWebhookRequestSchema = z.object({
  url: z.string(),
  events: z.array(z.string()),
});

export const UpdateWebhookRequestSchema = z.object({
  url: z.string().optional(),
  events: z.array(z.string()).optional(),
});

export interface WebhookDeletedObject {
  object: 'webhook.deleted';
  id: string;
  deleted: true;
}

export interface WebhookEventObject {
  object: 'webhook_event';
  id: string;
  event: string;
  webhook: string;
  payload: Record<string, any>;
  delivered: boolean;
  timestamp: number;
}

export const PaginationParametersSchema = z.object({
  order: z.union([z.literal('asc'), z.literal('desc')]).optional(),
  limit: z
    .string()
    .optional()
    .transform((val) => (val !== undefined ? Number(val) : undefined))
    .refine((val) => val && !isNaN(val) && val >= 1 && val <= 100, {
      message: 'Limit must be a number between 1 and 100',
    }),
  before: z.string().optional(),
  after: z.string().optional(),
});

export const QueryCollectionRequestSchema = z.object({
  type: z.enum(['vector', 'hybrid', 'keyword']).optional(),
  query: z.string().optional(),
  filter: z.any().optional(),
  returnProperties: z.array(z.string()).optional(),
  limit: z.number().optional(),
  alpha: z.number().min(0).max(1).optional(),
});

export type QueryCollectionRequest = z.infer<typeof QueryCollectionRequestSchema>;

export const ImageSearchCollectionRequestSchema = z.object({
  image: z.string(),
  filter: z.any().optional(),
  returnProperties: z.array(z.string()).optional(),
  limit: z.number().optional(),
});

export type ImageSearchCollectionRequest = z.infer<typeof ImageSearchCollectionRequestSchema>;
