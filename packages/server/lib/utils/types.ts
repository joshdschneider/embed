import { AuthScheme } from '@kit/providers';
import { Branding, SyncRunStatus, SyncRunType, SyncStatus } from '@kit/shared';
import { z } from 'zod';

export enum EnvironmentType {
  Staging = 'staging',
  Production = 'production',
}

export enum AccountType {
  Personal = 'personal',
  Organization = 'organization',
}

export interface DefaultTemplateData {
  branding: Branding;
  prefers_dark_mode: boolean;
}

export interface ErrorTemplateData extends DefaultTemplateData {
  error_message: string;
}

export interface ListTemplateData extends DefaultTemplateData {
  is_preview: boolean;
  server_url: string;
  link_token: string;
  integrations: {
    unique_key: string;
    name: string;
    logo_url: string | undefined;
    logo_url_dark_mode: string | undefined;
  }[];
}

export interface ConsentTemplateData extends DefaultTemplateData {
  is_preview: boolean;
  server_url: string;
  link_token: string;
  can_choose_integration: boolean;
  integration: {
    unique_key: string;
    name: string;
    logo_url: string | undefined;
    logo_url_dark_mode: string | undefined;
  };
}

export interface ConfigTemplateData extends DefaultTemplateData {
  server_url: string;
  link_token: string;
  integration: {
    unique_key: string;
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
  link_token: string;
  integration: {
    unique_key: string;
    name: string;
    logo_url: string | undefined;
    logo_url_dark_mode: string | undefined;
  };
}

export interface BasicTemplateData extends DefaultTemplateData {
  server_url: string;
  link_token: string;
  integration: {
    unique_key: string;
    name: string;
    logo_url: string | undefined;
    logo_url_dark_mode: string | undefined;
  };
}

export type LinkedAccountWebhookEvent = 'linked_account.created' | 'linked_account.updated';

export interface LinkedAccountWebhookBody {
  event: LinkedAccountWebhookEvent;
  integration: string;
  linked_account: string;
  configuration: Record<string, any>;
  metadata: Metadata;
  created_at: number;
  updated_at: number;
}

export type WebhookBody = LinkedAccountWebhookBody;

export interface IntegrationObject {
  object: 'integration';
  unique_key: string;
  name: string;
  logo_url: string;
  logo_url_dark_mode?: string;
  is_enabled: boolean;
  auth_scheme: AuthScheme;
  use_oauth_credentials: boolean;
  oauth_client_id: string | null;
  oauth_client_secret: string | null;
}

export const UpdateIntegrationRequestSchema = z.object({
  use_oauth_credentials: z.boolean().optional(),
  oauth_client_id: z.string().optional().nullable(),
  oauth_client_secret: z.string().optional().nullable(),
});

export type UpdateIntegrationRequest = z.infer<typeof UpdateIntegrationRequestSchema>;

export interface CollectionObject {
  object: 'collection';
  unique_key: string;
  integration: string;
  is_enabled: boolean;
  default_sync_frequency: string;
  auto_start_sync: boolean;
  exclude_properties_from_sync: string[];
  text_embedding_model: string;
  multimodal_embedding_model: string;
  created_at: number;
  updated_at: number;
}

export const UpdateCollectionRequestSchema = z.object({
  default_sync_frequency: z.string().optional(),
  auto_start_sync: z.boolean().optional(),
  exclude_properties_from_sync: z.array(z.string()).optional(),
  text_embedding_model: z.string().optional(),
  multimodal_embedding_model: z.string().optional(),
});

export type UpdateCollectionRequest = z.infer<typeof UpdateCollectionRequestSchema>;

export interface ActionObject {
  object: 'action';
  unique_key: string;
  integration: string;
  is_enabled: boolean;
  created_at: number;
  updated_at: number;
}

export interface ActionRunObject {
  object: 'action_run';
  action: string;
  integration: string;
  linked_account: string;
  created_at: number;
  updated_at: number;
}

export type Metadata = Record<string, any> | null;

export interface LinkTokenObject {
  object: 'link_token';
  token: string;
  url: string;
  integration: string | null;
  linked_account: string | null;
  expires_in_mins: number;
  language: string;
  redirect_url: string | null;
  metadata: Metadata;
  created_at: number;
}

export interface LinkTokenDeletedObject {
  object: 'link_token.deleted';
  token: string;
  deleted: true;
}

export const CreateLinkTokenRequestSchema = z.object({
  integration: z.string().optional(),
  linked_account_id: z.string().optional(),
  expires_in_mins: z.number().optional(),
  language: z.string().optional(),
  redirect_url: z.string().optional(),
  metadata: z.record(z.string(), z.any()).optional(),
});

export interface LinkedAccountObject {
  object: 'linked_account';
  id: string;
  integration: string;
  configuration: Record<string, any>;
  metadata: Metadata;
  created_at: number;
  updated_at: number;
}

export const UpdateLinkedAccountRequestSchema = z.object({
  metadata: z.record(z.string(), z.any()).optional().nullable(),
});

export interface LinkedAccountDeletedObject {
  object: 'linked_account.deleted';
  id: string;
  deleted: true;
}

export interface SyncObject {
  object: 'sync';
  collection: string;
  integration: string;
  linked_account: string;
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
  collection: string;
  integration: string;
  linked_account: string;
  type: SyncRunType;
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
