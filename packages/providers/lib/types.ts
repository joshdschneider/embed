import { ProxyOptions } from '@embed/node';
import { AxiosResponse } from 'axios';
import { z } from 'zod';

export enum AuthScheme {
  OAuth2 = 'oauth2',
  OAuth1 = 'oauth1',
  Basic = 'basic',
  ApiKey = 'api_key',
  None = 'none',
}

export const NoAuthSchema = z.object({
  scheme: z.literal(AuthScheme.None),
});

export type NoAuth = z.infer<typeof NoAuthSchema>;

export const ApiAuthSchema = z.object({
  scheme: z.union([z.literal(AuthScheme.Basic), z.literal(AuthScheme.ApiKey)]),
});

export type ApiAuth = z.infer<typeof ApiAuthSchema>;

export const OAuthSchema = z.object({
  scheme: z.union([z.literal(AuthScheme.OAuth1), z.literal(AuthScheme.OAuth2)]),
  authorization_url: z.string(),
  authorization_params: z.record(z.string()).optional(),
  scope_separator: z.string().optional(),
  default_scopes: z.array(z.string()).optional(),
  token_url: z.string(),
  token_params: z.record(z.string()).optional(),
  redirect_uri_metadata: z.array(z.string()).optional(),
  token_response_metadata: z.array(z.string()).optional(),
  token_expiration_buffer: z.number().optional(),
});

export type OAuth = z.infer<typeof OAuthSchema>;

export enum OAuthAuthorizationMethod {
  BODY = 'body',
  HEADER = 'header',
}

export enum OAuthBodyFormat {
  FORM = 'form',
  JSON = 'json',
}

export const OAuth2Schema = OAuthSchema.extend({
  scheme: z.literal(AuthScheme.OAuth2),
  disable_pkce: z.boolean().optional(),
  token_params: z
    .object({ grant_type: z.enum(['authorization_code', 'client_credentials']).optional() })
    .optional(),
  refresh_params: z.object({ grant_type: z.literal('refresh_token') }).optional(),
  authorization_method: z.nativeEnum(OAuthAuthorizationMethod).optional(),
  body_format: z.nativeEnum(OAuthBodyFormat).optional(),
  refresh_url: z.string().optional(),
  token_request_auth_method: z.literal('basic').optional(),
});

export type OAuth2 = z.infer<typeof OAuth2Schema>;

export const OAuth1Schema = OAuthSchema.extend({
  scheme: z.literal(AuthScheme.OAuth1),
  request_url: z.string(),
  request_params: z.record(z.string()).optional(),
  request_http_method: z.enum(['GET', 'PUT', 'POST']).optional(),
  token_http_method: z.enum(['GET', 'PUT', 'POST']).optional(),
  signature_method: z.enum(['HMAC-SHA1', 'RSA-SHA1', 'PLAINTEXT']),
});

export type OAuth1 = z.infer<typeof OAuth1Schema>;

export const AuthSchema = z.union([OAuthSchema, ApiAuthSchema, NoAuthSchema]);

export type Auth = z.infer<typeof AuthSchema>;

export const RetrySchema = z.object({
  at: z.string().optional(),
  after: z.string().optional(),
});

export type Retry = z.infer<typeof RetrySchema>;

export const CollectionPropertySchema = z.object({
  type: z.union([
    z.literal('string'),
    z.literal('number'),
    z.literal('boolean'),
    z.literal('integer'),
    z.literal('array'),
  ]),
  items: z
    .object({
      type: z.union([
        z.literal('string'),
        z.literal('number'),
        z.literal('boolean'),
        z.literal('integer'),
      ]),
    })
    .optional(),
  format: z.union([z.literal('date'), z.literal('date-time')]).optional(),
  description: z.string().optional(),
  index_searchable: z.boolean().optional(),
  index_filterable: z.boolean().optional(),
  vector_searchable: z.boolean().optional(),
  embedding_model: z.union([z.literal('text'), z.literal('multimodal')]).optional(),
});

export type CollectionProperty = z.infer<typeof CollectionPropertySchema>;

export const CollectionSchemaSchema = z.object({
  name: z.string(),
  description: z.string(),
  properties: z.record(CollectionPropertySchema),
  required: z.array(z.string()).optional(),
});

export type CollectionSchema = z.infer<typeof CollectionSchemaSchema>;

export const MetaCollectionSchema = z.record(
  z.object({
    schema: CollectionSchemaSchema,
    foreign_key: z.string(),
    visible_in_results: z.boolean().optional(),
  })
);

export type MetaCollection = z.infer<typeof CollectionSchemaSchema>;

export const CollectionsSchema = z.record(
  z.object({
    schema: CollectionSchemaSchema,
    default_enabled: z.boolean().optional(),
    default_sync_frequency: z.string().optional(),
    default_auto_start_sync: z.boolean().optional(),
    required_scopes: z.array(z.string()).optional(),
    has_multimodal_properties: z.boolean(),
    has_meta_collections: z.boolean(),
    meta_collections: MetaCollectionSchema.optional(),
  })
);

export type Collections = z.infer<typeof CollectionsSchema>;

export const ActionPropertySchema = z.object({
  type: z.string(),
  enum: z.array(z.string()).optional(),
  description: z.string().optional(),
});

export type ActionProperty = z.infer<typeof ActionPropertySchema>;

export const ActionSchemaSchema = z.object({
  name: z.string(),
  description: z.string(),
  parameters: z.object({
    type: z.literal('object'),
    properties: z.record(ActionPropertySchema),
    required: z.array(z.string()).optional(),
  }),
  required: z.array(z.string()).optional(),
});

export type ActionSchema = z.infer<typeof ActionSchemaSchema>;

export const ActionsSchema = z.record(
  z.object({
    default_enabled: z.boolean().optional(),
    required_scopes: z.array(z.string()).optional(),
    schema: ActionSchemaSchema,
  })
);

export type Actions = z.infer<typeof ActionsSchema>;

export const ProviderSpecificationSchema = z.object({
  unique_key: z.string(),
  name: z.string(),
  base_url: z.string(),
  auth: AuthSchema,
  headers: z.record(z.string()).optional(),
  retry: RetrySchema.optional(),
  logo_url: z.string(),
  logo_url_dark_mode: z.string().optional(),
  docs_url: z.string().optional(),
  collections: CollectionsSchema.optional(),
  actions: ActionsSchema.optional(),
});

export type ProviderSpecification = z.infer<typeof ProviderSpecificationSchema>;

export type InternalProxyOptions = Omit<ProxyOptions, 'linkedAccountId'>;

export type MethodProxyOptions = Omit<InternalProxyOptions, 'method'>;

enum LogLevel {
  Info = 'info',
  Debug = 'debug',
  Error = 'error',
  Warn = 'warn',
  Verbose = 'verbose',
}

type ActivityLog = {
  id: string;
  activity_id: string;
  level: string;
  message: string;
  payload: any;
  timestamp: number;
};

export declare class BaseContext {
  activityId: string | null;
  proxy<T = any>(options: InternalProxyOptions): Promise<AxiosResponse<T>>;
  get<T = any>(options: MethodProxyOptions): Promise<AxiosResponse<T>>;
  post<T = any>(options: MethodProxyOptions): Promise<AxiosResponse<T>>;
  patch<T = any>(options: MethodProxyOptions): Promise<AxiosResponse<T>>;
  put<T = any>(options: MethodProxyOptions): Promise<AxiosResponse<T>>;
  delete<T = any>(options: MethodProxyOptions): Promise<AxiosResponse<T>>;
  reportError(err: unknown): Promise<void>;
  log(activityLog: {
    level: LogLevel;
    message: string;
    payload?: object | undefined;
    timestamp: number;
  }): Promise<ActivityLog | null>;
}

export interface SyncContext extends BaseContext {
  collectionKey: string;
  multimodalEnabled: boolean;
  syncRunId: string;
  lastSyncedAt: number | null;
  syncType: 'initial' | 'incremental';
  batchSave<T = any>(results: T[], model: string): Promise<boolean | null>;
  reportResults(): Promise<{
    records_added: number;
    records_updated: number;
    records_deleted: number;
  }>;
  finish(): Promise<void>;
}

export interface ActionContext extends BaseContext {}
