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
  help_link: z.string().optional(),
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

export const AuthSchema = z.array(z.union([OAuthSchema, ApiAuthSchema, NoAuthSchema]));

export type Auth = z.infer<typeof AuthSchema>;

export const RetrySchema = z.object({
  at: z.string().optional(),
  after: z.string().optional(),
});

export type Retry = z.infer<typeof RetrySchema>;

export const PropertyTypeSchema = z.union([
  z.literal('string'),
  z.literal('number'),
  z.literal('integer'),
  z.literal('boolean'),
  z.literal('date'),
  z.literal('object'),
  z.literal('array'),
  z.literal('nested'),
]);

export type PropertyType = z.infer<typeof PropertyTypeSchema>;

export const PropertyItemsSchema = z.object({
  type: z.union([
    z.literal('string'),
    z.literal('number'),
    z.literal('integer'),
    z.literal('boolean'),
    z.literal('date'),
  ]),
});

export type PropertyItems = z.infer<typeof PropertyItemsSchema>;

export interface CollectionProperty {
  type: PropertyType;
  items?: PropertyItems;
  description?: string;
  properties?: Record<string, CollectionProperty>;
  filterable?: boolean;
  keyword_searchable?: boolean;
  vector_searchable?: boolean;
  return_by_default?: boolean;
  multimodal?: boolean;
  wildcard?: boolean;
  hidden?: boolean;
}

export const CollectionPropertySchema: z.ZodType<CollectionProperty> = z.object({
  type: PropertyTypeSchema,
  items: PropertyItemsSchema.optional(),
  description: z.string().optional(),
  properties: z.record(z.lazy(() => CollectionPropertySchema)).optional(),
  filterable: z.boolean().default(true),
  keyword_searchable: z.boolean().default(true),
  vector_searchable: z.boolean().default(true),
  return_by_default: z.boolean().default(true),
  multimodal: z.boolean().default(false),
  wildcard: z.boolean().default(false),
  hidden: z.boolean().default(false),
});

export const CollectionConfigurationSchema = z.object({
  type: PropertyTypeSchema,
  items: PropertyItemsSchema.optional(),
  description: z.string().optional(),
});

export type CollectionConfiguration = z.infer<typeof CollectionConfigurationSchema>;

export const CollectionSchemaSchema = z.object({
  name: z.string(),
  description: z.string(),
  properties: z.record(CollectionPropertySchema),
  required: z.array(z.string()).optional(),
});

export type CollectionSchema = z.infer<typeof CollectionSchemaSchema>;

export const CollectionSchema = z.object({
  unique_key: z.string(),
  schema: CollectionSchemaSchema,
  required_scopes: z.array(z.string()).optional(),
  configuration: z.record(CollectionConfigurationSchema).optional(),
});

export type Collection = z.infer<typeof CollectionSchema>;

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

export const ActionConfigurationSchema = z.object({
  type: PropertyTypeSchema,
  items: PropertyItemsSchema.optional(),
  description: z.string().optional(),
});

export type ActionConfiguration = z.infer<typeof ActionConfigurationSchema>;

export const ActionSchema = z.object({
  unique_key: z.string(),
  required_scopes: z.array(z.string()).optional(),
  schema: ActionSchemaSchema,
  configuration: z.record(ActionConfigurationSchema).optional(),
});

export type Action = z.infer<typeof ActionSchema>;

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
  collections: z.array(CollectionSchema).optional(),
  actions: z.array(ActionSchema).optional(),
});

export type ProviderSpecification = z.infer<typeof ProviderSpecificationSchema>;

export type HttpMethod =
  | 'GET'
  | 'POST'
  | 'PATCH'
  | 'PUT'
  | 'DELETE'
  | 'get'
  | 'post'
  | 'patch'
  | 'put'
  | 'delete';

export type ResponseType = 'arraybuffer' | 'json' | 'text' | 'stream';

export interface ProxyOptions {
  integrationId: string;
  connectionId: string;
  endpoint: string;
  baseUrlOverride?: string;
  method?: HttpMethod;
  responseType?: ResponseType;
  headers?: Record<string, string>;
  params?: string | Record<string, string | number>;
  data?: unknown;
  retries?: number;
}

export type InternalProxyOptions = Omit<ProxyOptions, 'connectionId' | 'integrationId'>;

export type MethodProxyOptions = Omit<InternalProxyOptions, 'method'>;

type LogLevel = 'info' | 'debug' | 'error' | 'warn' | 'verbose';

type ActivityLog = {
  id: string;
  activity_id: string;
  level: string;
  message: string;
  payload: any;
  timestamp: number;
};

export interface SourceObject {
  id: string;
  [key: string]: any;
}

export declare class BaseContext {
  activityId: string | null;
  proxy<T = any>(options: InternalProxyOptions): Promise<AxiosResponse<T>>;
  get<T = any>(options: MethodProxyOptions): Promise<AxiosResponse<T>>;
  post<T = any>(options: MethodProxyOptions): Promise<AxiosResponse<T>>;
  patch<T = any>(options: MethodProxyOptions): Promise<AxiosResponse<T>>;
  put<T = any>(options: MethodProxyOptions): Promise<AxiosResponse<T>>;
  delete<T = any>(options: MethodProxyOptions): Promise<AxiosResponse<T>>;
  reportError(err: unknown): Promise<void>;
  log(message: string): void;
  createActivityLog(activityLog: {
    level: LogLevel;
    message: string;
    payload?: object | undefined;
  }): Promise<ActivityLog | null>;
}

export interface SyncContext extends BaseContext {
  collectionKey: string;
  multimodalEnabled: boolean;
  syncRunId: string;
  lastSyncedAt: number | null;
  processAudio(buffer: Buffer): Promise<string[]>;
  processVideo(buffer: Buffer): Promise<string[]>;
  batchSave(objects: SourceObject[]): Promise<boolean>;
  pruneDeleted(allIds: string[]): Promise<boolean>;
  reportResults(): Promise<{
    records_added: number;
    records_updated: number;
    records_deleted: number;
  }>;
  finish(): boolean;
}

export interface ActionContext extends BaseContext {}
