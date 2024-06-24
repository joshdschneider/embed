import { AuthScheme } from '@embed/providers';
import {
  ActionRunStatus,
  Branding,
  DEFAULT_LIMIT,
  EnvironmentType,
  LogAction,
  LogLevel,
  SyncFrequency,
  SyncRunStatus,
  SyncStatus,
} from '@embed/shared';
import { z } from 'zod';

export interface DefaultTemplateData {
  branding: Branding;
  prefers_dark_mode: boolean;
}

export interface ErrorTemplateData extends DefaultTemplateData {
  error_message: string;
}

export interface ConfigTemplateData extends DefaultTemplateData {
  server_url: string;
  session_token: string;
  integration: {
    provider_key: string;
    name: string;
    logo_url: string | undefined;
    logo_url_dark_mode: string | undefined;
  };
  configuration_fields: {
    name: string;
    label: string;
    help_link: string | undefined;
  }[];
}

export interface ApiKeyTemplateData extends DefaultTemplateData {
  nonce: string;
  server_url: string;
  session_token: string;
  integration: {
    provider_key: string;
    name: string;
    logo_url: string | undefined;
    logo_url_dark_mode: string | undefined;
    help_link: string | undefined;
  };
}

export interface BasicTemplateData extends DefaultTemplateData {
  nonce: string;
  server_url: string;
  session_token: string;
  integration: {
    provider_key: string;
    name: string;
    logo_url: string | undefined;
    logo_url_dark_mode: string | undefined;
    help_link: string | undefined;
  };
}

export interface PreviewTemplateData extends DefaultTemplateData {
  nonce: string;
  server_url: string;
  integration: {
    name: string;
    logo_url: string | undefined;
    logo_url_dark_mode: string | undefined;
    help_link: string | undefined;
  };
}

export const idSchema = z
  .string()
  .min(3, { message: 'ID cannot be empty' })
  .max(48, { message: 'ID cannot be longer than 48 characters' })
  .regex(/^[a-zA-Z0-9-_]+$/, {
    message: 'ID can only contain alphanumeric characters, dashes, and underscores',
  });

export type UserObject = {
  object: 'user';
  id: string;
  email: string;
  first_name: string | null;
  last_name: string | null;
};

export const UpdateUserRequestSchema = z.object({
  first_name: z.string().optional().nullable(),
  last_name: z.string().optional().nullable(),
  email_subscriptions: z.array(z.string()).optional(),
});

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
  auth_schemes: AuthScheme[];
  is_enabled: boolean;
  logo_url: string;
  logo_url_dark_mode: string | null;
  is_using_test_credentials: boolean;
  oauth_client_id: string | null;
  oauth_client_secret: string | null;
  oauth_scopes: string[];
  created_at: number;
  updated_at: number;
}

export const CreateIntegrationRequestSchema = z.object({
  id: idSchema.optional(),
  provider_key: z.string(),
  auth_schemes: z.array(z.string()).optional(),
  use_test_credentials: z.boolean().optional(),
  oauth_client_id: z.string().optional().nullable(),
  oauth_client_secret: z.string().optional().nullable(),
  oauth_scopes: z.array(z.string()).optional().nullable(),
});

export type CreateIntegrationRequest = z.infer<typeof CreateIntegrationRequestSchema>;

export const UpdateIntegrationRequestSchema = z.object({
  is_using_test_credentials: z.boolean().optional(),
  oauth_client_id: z.string().optional().nullable(),
  oauth_client_secret: z.string().optional().nullable(),
  oauth_scopes: z.array(z.string()).optional().nullable(),
});

export type UpdateIntegrationRequest = z.infer<typeof UpdateIntegrationRequestSchema>;

export interface IntegrationDeletedObject {
  object: 'integration';
  id: string;
  deleted: true;
}

export interface CollectionObject {
  object: 'collection';
  unique_key: string;
  integration_id: string;
  provider_key: string;
  is_enabled: boolean;
  default_sync_frequency: string;
  auto_start_syncs: boolean;
  exclude_properties_from_syncs: string[];
  configuration: Record<string, any> | null;
  created_at: number;
  updated_at: number;
}

export const UpdateCollectionRequestSchema = z.object({
  default_sync_frequency: z.string().optional(),
  auto_start_syncs: z.boolean().optional(),
  exclude_properties_from_syncs: z.array(z.string()).optional(),
  configuration: z.record(z.string(), z.any()).optional().nullable(),
});

export type UpdateCollectionRequest = z.infer<typeof UpdateCollectionRequestSchema>;

export interface ActionObject {
  object: 'action';
  unique_key: string;
  integration_id: string;
  provider_key: string;
  is_enabled: boolean;
  configuration: Record<string, any> | null;
  created_at: number;
  updated_at: number;
}

export const UpdateActionRequestSchema = z.object({
  configuration: z.record(z.string(), z.any()).optional().nullable(),
});

export type UpdateActionRequest = z.infer<typeof UpdateActionRequestSchema>;

export interface ActionRunObject {
  object: 'action_run';
  id: string;
  action_key: string;
  integration_id: string;
  connection_id: string;
  status: ActionRunStatus;
  input: Record<string, any>;
  output: Record<string, any>;
  timestamp: number;
  duration: number;
}

export interface SessionTokenObject {
  object: 'session_token';
  token: string;
  url: string;
  integration_id: string;
  connection_id: string | null;
  expires_at: number;
  redirect_url: string | null;
  auth_scheme: string;
  configuration: Record<string, any> | null;
  inclusions: Record<string, any> | null;
  exclusions: Record<string, any> | null;
  metadata: Record<string, any> | null;
  created_at: number;
}

export interface SessionTokenDeletedObject {
  object: 'session_token';
  token: string;
  deleted: true;
}

export const CreateSessionTokenRequestSchema = z.object({
  integration_id: z.string(),
  connection_id: z.string().optional(),
  expires_in_mins: z.number().optional(),
  redirect_url: z.string().optional().nullable(),
  auth_scheme: z.string().optional(),
  configuration: z.record(z.string(), z.any()).optional().nullable(),
  inclusions: z.record(z.string(), z.any()).optional().nullable(),
  exclusions: z.record(z.string(), z.any()).optional().nullable(),
  metadata: z.record(z.string(), z.any()).optional().nullable(),
});

export interface ConnectionObject {
  object: 'connection';
  id: string;
  integration_id: string;
  auth_scheme: AuthScheme;
  configuration: Record<string, any> | null;
  inclusions: Record<string, any> | null;
  exclusions: Record<string, any> | null;
  metadata: Record<string, any> | null;
  created_at: number;
  updated_at: number;
}

export const ApiKeyCredentialsSchema = z.object({
  api_key: z.string(),
});

export const OAuth2CredentialsSchema = z.object({
  access_token: z.string(),
  refresh_token: z.string(),
  expires_at: z.number().optional(),
});

export const OAuth1CredentialsSchema = z.object({
  oauth_token: z.string(),
  oauth_token_secret: z.string(),
});

export const BasicCredentialsSchema = z.object({
  username: z.string(),
  password: z.string(),
});

export const UpsertConnectionRequestSchema = z.object({
  id: idSchema.optional(),
  integration_id: z.string(),
  auth_scheme: z.string(),
  credentials: z.union([
    ApiKeyCredentialsSchema,
    OAuth2CredentialsSchema,
    OAuth1CredentialsSchema,
    BasicCredentialsSchema,
  ]),
  configuration: z.record(z.string(), z.any()).optional().nullable(),
  inclusions: z.record(z.string(), z.any()).optional().nullable(),
  exclusions: z.record(z.string(), z.any()).optional().nullable(),
  metadata: z.record(z.string(), z.any()).optional().nullable(),
});

export const UpdateConnectionRequestSchema = z.object({
  configuration: z.record(z.string(), z.any()).optional().nullable(),
  inclusions: z.record(z.string(), z.any()).optional().nullable(),
  exclusions: z.record(z.string(), z.any()).optional().nullable(),
  metadata: z.record(z.string(), z.any()).optional().nullable(),
});

export interface ConnectionDeletedObject {
  object: 'connection';
  id: string;
  deleted: true;
}

export interface ConnectionCountObject {
  object: 'connection_count';
  connection_count: number;
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
  frequency: z.enum([
    SyncFrequency.RealTime,
    SyncFrequency.Hourly,
    SyncFrequency.Daily,
    SyncFrequency.Weekly,
    SyncFrequency.Monthly,
  ]),
});

export interface SyncRunObject {
  object: 'sync_run';
  id: string;
  collection_key: string;
  integration_id: string;
  connection_id: string;
  status: SyncRunStatus;
  records_added: number | null;
  records_updated: number | null;
  records_deleted: number | null;
  timestamp: number;
  duration: number | null;
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

export interface ActivityObject {
  object: 'activity';
  id: string;
  environment_id: string;
  integration_id: string | null;
  connection_id: string | null;
  session_token_id: string | null;
  collection_key: string | null;
  action_key: string | null;
  level: LogLevel;
  action: LogAction;
  timestamp: number;
}

export interface ActivityLogObject {
  object: 'activity_log';
  id: string;
  activity_id: string;
  level: string;
  message: string;
  payload: any;
  timestamp: number;
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
    .default(DEFAULT_LIMIT.toString())
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
  return_properties: z.array(z.string()).optional(),
  image: z.string().optional(),
  limit: z.number().optional(),
  alpha: z.number().min(0).max(1).optional(),
});

export type QueryCollectionRequest = z.infer<typeof QueryCollectionRequestSchema>;
