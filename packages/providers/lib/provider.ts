export abstract class Provider {
  public abstract getSpec(): ProviderSpecification;
}

export type ProviderSpecification = {
  slug: string;
  display_name: string;
  base_url: string;
  auth: Auth;
  headers?: Record<string, string>;
  retry?: Retry;
  pagination?: Pagination;
  logo_url?: string;
  docs_url?: string;
};

export enum AuthScheme {
  OAUTH2 = 'OAUTH2',
  OAUTH1 = 'OAUTH1',
  BASIC = 'BASIC',
  API_KEY = 'API_KEY',
  NONE = 'NONE',
}

export interface NoAuth {
  scheme: AuthScheme.NONE;
}

export interface ApiAuth {
  scheme: AuthScheme.BASIC | AuthScheme.API_KEY;
}

export interface OAuth {
  scheme: AuthScheme.OAUTH1 | AuthScheme.OAUTH2;
  authorization_url: string;
  authorization_params?: Record<string, string>;
  scope_separator?: string;
  default_scopes?: string[];
  token_url: string;
  token_params?: { [key: string]: string };
  redirect_uri_metadata?: Array<string>;
  token_response_metadata?: Array<string>;
  token_expiration_buffer?: number;
}

export interface OAuth2 extends OAuth {
  scheme: AuthScheme.OAUTH2;
  disable_pkce?: boolean;
  token_params?: { grant_type?: 'authorization_code' | 'client_credentials' };
  refresh_params?: { grant_type: 'refresh_token' };
  authorization_method?: OAuthAuthorizationMethod;
  body_format?: OAuthBodyFormat;
  refresh_url?: string;
  token_request_auth_method?: 'basic';
}

export enum OAuthAuthorizationMethod {
  BODY = 'body',
  HEADER = 'header',
}

export enum OAuthBodyFormat {
  FORM = 'form',
  JSON = 'json',
}

export interface OAuth1 extends OAuth {
  scheme: AuthScheme.OAUTH1;
  request_url: string;
  request_params?: Record<string, string>;
  request_http_method?: 'GET' | 'PUT' | 'POST';
  token_http_method?: 'GET' | 'PUT' | 'POST';
  signature_method: 'HMAC-SHA1' | 'RSA-SHA1' | 'PLAINTEXT';
}

export type Auth = OAuth | ApiAuth | NoAuth;

export interface BasePagination {
  type: string;
  limit?: number;
  response_path?: string;
  limit_name_in_request: string;
}

export interface CursorPagination extends BasePagination {
  cursor_path_in_response: string;
  cursor_name_in_request: string;
}

export interface LinkPagination extends BasePagination {
  link_rel_in_response_header?: string;
  link_path_in_response_body?: string;
}

export interface OffsetPagination extends BasePagination {
  offset_name_in_request: string;
}

export type Pagination = LinkPagination | CursorPagination | OffsetPagination;

export interface Retry {
  at?: string;
  after?: string;
}
