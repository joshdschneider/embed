import { AuthScheme } from '@kit/providers';
import { z } from 'zod';

export enum EnvironmentType {
  Staging = 'staging',
  Production = 'production',
}

export enum AccountType {
  Personal = 'personal',
  Organization = 'organization',
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
    provider: string;
    display_name: string;
    logo_url: string | undefined;
    logo_dark_url: string | undefined;
  }[];
}

export interface ConsentTemplateData extends DefaultTemplateData {
  is_preview: boolean;
  server_url: string;
  link_token: string;
  can_choose_integration: boolean;
  integration: {
    provider: string;
    display_name: string;
    logo_url: string | undefined;
    logo_dark_url: string | undefined;
  };
}

export interface ConfigTemplateData extends DefaultTemplateData {
  server_url: string;
  link_token: string;
  integration: {
    provider: string;
    display_name: string;
    logo_url: string | undefined;
    logo_dark_url: string | undefined;
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
    provider: string;
    display_name: string;
    logo_url: string | undefined;
    logo_dark_url: string | undefined;
  };
}

export interface BasicTemplateData extends DefaultTemplateData {
  server_url: string;
  link_token: string;
  integration: {
    provider: string;
    display_name: string;
    logo_url: string | undefined;
    logo_dark_url: string | undefined;
  };
}

export type WebhookEvent = 'linked_account.created' | 'linked_account.updated';

export interface LinkedAccountWebhookBody {
  event: WebhookEvent;
  environment: string;
  integration: string;
  linked_account_id: string;
  metadata: any;
  created_at: number;
  updated_at: number | null;
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
  oauth_client_id: z.string().optional(),
  oauth_client_secret: z.string().optional(),
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
  created_at: number;
  updated_at: number;
}

export const UpdateCollectionRequestSchema = z.object({
  default_sync_frequency: z.string().optional(),
  auto_start_sync: z.boolean().optional(),
  exclude_properties_from_sync: z.array(z.string()).optional(),
});

export type UpdateCollectionRequest = z.infer<typeof UpdateCollectionRequestSchema>;

export interface LinkTokenObject {
  object: 'link_token';
  id: string;
  url: string;
  integration_key: string;
  linked_account_id: string | null;
  expires_in_mins: number;
  language: 'en';
  redirect_url: string | null;
  metadata: Record<string, any> | null;
  created_at: number;
}

export interface LinkedAccountObject {
  object: 'linked_account';
  id: string;
  integration_key: string;
  configuration: Record<string, any>;
  metadata: Record<string, any> | null;
  created_at: number;
  updated_at: number;
}
