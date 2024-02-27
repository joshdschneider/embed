import { ProxyOptions } from '@kit/node';
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

export const BasePaginationSchema = z.object({
  type: z.string(),
  limit: z.number().optional(),
  response_path: z.string().optional(),
  limit_name_in_request: z.string(),
});

export type BasePagination = z.infer<typeof BasePaginationSchema>;

export const CursorPaginationSchema = BasePaginationSchema.extend({
  cursor_path_in_response: z.string(),
  cursor_name_in_request: z.string(),
});

export type CursorPagination = z.infer<typeof CursorPaginationSchema>;

export const LinkPaginationSchema = BasePaginationSchema.extend({
  link_rel_in_response_header: z.string().optional(),
  link_path_in_response_body: z.string().optional(),
});

export type LinkPagination = z.infer<typeof LinkPaginationSchema>;

export const OffsetPaginationSchema = BasePaginationSchema.extend({
  offset_name_in_request: z.string(),
});

export type OffsetPagination = z.infer<typeof OffsetPaginationSchema>;

export const PaginationSchema = z.union([
  LinkPaginationSchema,
  CursorPaginationSchema,
  OffsetPaginationSchema,
]);

export type Pagination = z.infer<typeof PaginationSchema>;

export const RetrySchema = z.object({
  at: z.string().optional(),
  after: z.string().optional(),
});

export type Retry = z.infer<typeof RetrySchema>;

export const CollectionsSchema = z.array(
  z.object({
    unique_key: z.string(),
    default_enabled: z.boolean().optional(),
    default_sync_frequency: z.string().optional(),
    default_auto_start_sync: z.boolean().optional(),
    required_scopes: z.array(z.string()).optional(),
    schema: z.any(),
  })
);

export type Collections = z.infer<typeof CollectionsSchema>;

export const ActionsSchema = z.array(
  z.object({
    unique_key: z.string(),
    default_enabled: z.boolean().optional(),
    required_scopes: z.array(z.string()).optional(),
    schema: z.any(),
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
  pagination: PaginationSchema.optional(),
  logo_url: z.string(),
  logo_url_dark_mode: z.string().optional(),
  docs_url: z.string().optional(),
  collections: CollectionsSchema.optional(),
  actions: ActionsSchema.optional(),
});

export type ProviderSpecification = z.infer<typeof ProviderSpecificationSchema>;

export interface BaseContext {
  proxy<T = any>(options: ProxyOptions): Promise<AxiosResponse<T>>;
  get<T = any>(options: Omit<ProxyOptions, 'method'>): Promise<AxiosResponse<T>>;
  post<T = any>(options: Omit<ProxyOptions, 'method'>): Promise<AxiosResponse<T>>;
  patch<T = any>(options: Omit<ProxyOptions, 'method'>): Promise<AxiosResponse<T>>;
  put<T = any>(options: Omit<ProxyOptions, 'method'>): Promise<AxiosResponse<T>>;
  delete<T = any>(options: Omit<ProxyOptions, 'method'>): Promise<AxiosResponse<T>>;
}

export type PaginateOptions = Omit<ProxyOptions, 'integration' | 'linkedAccountId'> & {
  pagination?: Partial<CursorPagination> | Partial<LinkPagination> | Partial<OffsetPagination>;
};

export interface SyncContext extends BaseContext {
  lastSyncDate: Date | null;
  paginate<T = any>(paginateOptions: PaginateOptions): AsyncGenerator<T[], undefined, void>;
}

export interface ActionContext extends BaseContext {}
