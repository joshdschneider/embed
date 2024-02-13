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

export interface LinkedAccountCreatedWebhookBody {
  event: 'linked_account.created';
  environment: string;
  integration: string;
  linked_account_id: string;
  metadata: any;
  created_at: number;
  updated_at: number | null;
}

export interface LinkedAccountUpdatedWebhookBody {
  event: 'linked_account.updated';
  environment: string;
  integration: string;
  linked_account_id: string;
  metadata: any;
  created_at: number;
  updated_at: number | null;
}

export type WebhookBody = LinkedAccountCreatedWebhookBody | LinkedAccountUpdatedWebhookBody;
