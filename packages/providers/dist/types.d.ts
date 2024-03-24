import { ProxyOptions } from '@embed/node';
import { AxiosResponse } from 'axios';
import { z } from 'zod';
export declare enum AuthScheme {
    OAuth2 = "oauth2",
    OAuth1 = "oauth1",
    Basic = "basic",
    ApiKey = "api_key",
    None = "none"
}
export declare const NoAuthSchema: z.ZodObject<{
    scheme: z.ZodLiteral<AuthScheme.None>;
}, "strip", z.ZodTypeAny, {
    scheme: AuthScheme.None;
}, {
    scheme: AuthScheme.None;
}>;
export type NoAuth = z.infer<typeof NoAuthSchema>;
export declare const ApiAuthSchema: z.ZodObject<{
    scheme: z.ZodUnion<[z.ZodLiteral<AuthScheme.Basic>, z.ZodLiteral<AuthScheme.ApiKey>]>;
}, "strip", z.ZodTypeAny, {
    scheme: AuthScheme.Basic | AuthScheme.ApiKey;
}, {
    scheme: AuthScheme.Basic | AuthScheme.ApiKey;
}>;
export type ApiAuth = z.infer<typeof ApiAuthSchema>;
export declare const OAuthSchema: z.ZodObject<{
    scheme: z.ZodUnion<[z.ZodLiteral<AuthScheme.OAuth1>, z.ZodLiteral<AuthScheme.OAuth2>]>;
    authorization_url: z.ZodString;
    authorization_params: z.ZodOptional<z.ZodRecord<z.ZodString, z.ZodString>>;
    scope_separator: z.ZodOptional<z.ZodString>;
    default_scopes: z.ZodOptional<z.ZodArray<z.ZodString, "many">>;
    token_url: z.ZodString;
    token_params: z.ZodOptional<z.ZodRecord<z.ZodString, z.ZodString>>;
    redirect_uri_metadata: z.ZodOptional<z.ZodArray<z.ZodString, "many">>;
    token_response_metadata: z.ZodOptional<z.ZodArray<z.ZodString, "many">>;
    token_expiration_buffer: z.ZodOptional<z.ZodNumber>;
}, "strip", z.ZodTypeAny, {
    scheme: AuthScheme.OAuth2 | AuthScheme.OAuth1;
    authorization_url: string;
    token_url: string;
    authorization_params?: Record<string, string> | undefined;
    scope_separator?: string | undefined;
    default_scopes?: string[] | undefined;
    token_params?: Record<string, string> | undefined;
    redirect_uri_metadata?: string[] | undefined;
    token_response_metadata?: string[] | undefined;
    token_expiration_buffer?: number | undefined;
}, {
    scheme: AuthScheme.OAuth2 | AuthScheme.OAuth1;
    authorization_url: string;
    token_url: string;
    authorization_params?: Record<string, string> | undefined;
    scope_separator?: string | undefined;
    default_scopes?: string[] | undefined;
    token_params?: Record<string, string> | undefined;
    redirect_uri_metadata?: string[] | undefined;
    token_response_metadata?: string[] | undefined;
    token_expiration_buffer?: number | undefined;
}>;
export type OAuth = z.infer<typeof OAuthSchema>;
export declare enum OAuthAuthorizationMethod {
    BODY = "body",
    HEADER = "header"
}
export declare enum OAuthBodyFormat {
    FORM = "form",
    JSON = "json"
}
export declare const OAuth2Schema: z.ZodObject<{
    authorization_url: z.ZodString;
    authorization_params: z.ZodOptional<z.ZodRecord<z.ZodString, z.ZodString>>;
    scope_separator: z.ZodOptional<z.ZodString>;
    default_scopes: z.ZodOptional<z.ZodArray<z.ZodString, "many">>;
    token_url: z.ZodString;
    redirect_uri_metadata: z.ZodOptional<z.ZodArray<z.ZodString, "many">>;
    token_response_metadata: z.ZodOptional<z.ZodArray<z.ZodString, "many">>;
    token_expiration_buffer: z.ZodOptional<z.ZodNumber>;
    scheme: z.ZodLiteral<AuthScheme.OAuth2>;
    disable_pkce: z.ZodOptional<z.ZodBoolean>;
    token_params: z.ZodOptional<z.ZodObject<{
        grant_type: z.ZodOptional<z.ZodEnum<["authorization_code", "client_credentials"]>>;
    }, "strip", z.ZodTypeAny, {
        grant_type?: "authorization_code" | "client_credentials" | undefined;
    }, {
        grant_type?: "authorization_code" | "client_credentials" | undefined;
    }>>;
    refresh_params: z.ZodOptional<z.ZodObject<{
        grant_type: z.ZodLiteral<"refresh_token">;
    }, "strip", z.ZodTypeAny, {
        grant_type: "refresh_token";
    }, {
        grant_type: "refresh_token";
    }>>;
    authorization_method: z.ZodOptional<z.ZodNativeEnum<typeof OAuthAuthorizationMethod>>;
    body_format: z.ZodOptional<z.ZodNativeEnum<typeof OAuthBodyFormat>>;
    refresh_url: z.ZodOptional<z.ZodString>;
    token_request_auth_method: z.ZodOptional<z.ZodLiteral<"basic">>;
}, "strip", z.ZodTypeAny, {
    scheme: AuthScheme.OAuth2;
    authorization_url: string;
    token_url: string;
    authorization_params?: Record<string, string> | undefined;
    scope_separator?: string | undefined;
    default_scopes?: string[] | undefined;
    redirect_uri_metadata?: string[] | undefined;
    token_response_metadata?: string[] | undefined;
    token_expiration_buffer?: number | undefined;
    disable_pkce?: boolean | undefined;
    token_params?: {
        grant_type?: "authorization_code" | "client_credentials" | undefined;
    } | undefined;
    refresh_params?: {
        grant_type: "refresh_token";
    } | undefined;
    authorization_method?: OAuthAuthorizationMethod | undefined;
    body_format?: OAuthBodyFormat | undefined;
    refresh_url?: string | undefined;
    token_request_auth_method?: "basic" | undefined;
}, {
    scheme: AuthScheme.OAuth2;
    authorization_url: string;
    token_url: string;
    authorization_params?: Record<string, string> | undefined;
    scope_separator?: string | undefined;
    default_scopes?: string[] | undefined;
    redirect_uri_metadata?: string[] | undefined;
    token_response_metadata?: string[] | undefined;
    token_expiration_buffer?: number | undefined;
    disable_pkce?: boolean | undefined;
    token_params?: {
        grant_type?: "authorization_code" | "client_credentials" | undefined;
    } | undefined;
    refresh_params?: {
        grant_type: "refresh_token";
    } | undefined;
    authorization_method?: OAuthAuthorizationMethod | undefined;
    body_format?: OAuthBodyFormat | undefined;
    refresh_url?: string | undefined;
    token_request_auth_method?: "basic" | undefined;
}>;
export type OAuth2 = z.infer<typeof OAuth2Schema>;
export declare const OAuth1Schema: z.ZodObject<{
    authorization_url: z.ZodString;
    authorization_params: z.ZodOptional<z.ZodRecord<z.ZodString, z.ZodString>>;
    scope_separator: z.ZodOptional<z.ZodString>;
    default_scopes: z.ZodOptional<z.ZodArray<z.ZodString, "many">>;
    token_url: z.ZodString;
    token_params: z.ZodOptional<z.ZodRecord<z.ZodString, z.ZodString>>;
    redirect_uri_metadata: z.ZodOptional<z.ZodArray<z.ZodString, "many">>;
    token_response_metadata: z.ZodOptional<z.ZodArray<z.ZodString, "many">>;
    token_expiration_buffer: z.ZodOptional<z.ZodNumber>;
    scheme: z.ZodLiteral<AuthScheme.OAuth1>;
    request_url: z.ZodString;
    request_params: z.ZodOptional<z.ZodRecord<z.ZodString, z.ZodString>>;
    request_http_method: z.ZodOptional<z.ZodEnum<["GET", "PUT", "POST"]>>;
    token_http_method: z.ZodOptional<z.ZodEnum<["GET", "PUT", "POST"]>>;
    signature_method: z.ZodEnum<["HMAC-SHA1", "RSA-SHA1", "PLAINTEXT"]>;
}, "strip", z.ZodTypeAny, {
    scheme: AuthScheme.OAuth1;
    authorization_url: string;
    token_url: string;
    request_url: string;
    signature_method: "HMAC-SHA1" | "RSA-SHA1" | "PLAINTEXT";
    authorization_params?: Record<string, string> | undefined;
    scope_separator?: string | undefined;
    default_scopes?: string[] | undefined;
    token_params?: Record<string, string> | undefined;
    redirect_uri_metadata?: string[] | undefined;
    token_response_metadata?: string[] | undefined;
    token_expiration_buffer?: number | undefined;
    request_params?: Record<string, string> | undefined;
    request_http_method?: "GET" | "PUT" | "POST" | undefined;
    token_http_method?: "GET" | "PUT" | "POST" | undefined;
}, {
    scheme: AuthScheme.OAuth1;
    authorization_url: string;
    token_url: string;
    request_url: string;
    signature_method: "HMAC-SHA1" | "RSA-SHA1" | "PLAINTEXT";
    authorization_params?: Record<string, string> | undefined;
    scope_separator?: string | undefined;
    default_scopes?: string[] | undefined;
    token_params?: Record<string, string> | undefined;
    redirect_uri_metadata?: string[] | undefined;
    token_response_metadata?: string[] | undefined;
    token_expiration_buffer?: number | undefined;
    request_params?: Record<string, string> | undefined;
    request_http_method?: "GET" | "PUT" | "POST" | undefined;
    token_http_method?: "GET" | "PUT" | "POST" | undefined;
}>;
export type OAuth1 = z.infer<typeof OAuth1Schema>;
export declare const AuthSchema: z.ZodUnion<[z.ZodObject<{
    scheme: z.ZodUnion<[z.ZodLiteral<AuthScheme.OAuth1>, z.ZodLiteral<AuthScheme.OAuth2>]>;
    authorization_url: z.ZodString;
    authorization_params: z.ZodOptional<z.ZodRecord<z.ZodString, z.ZodString>>;
    scope_separator: z.ZodOptional<z.ZodString>;
    default_scopes: z.ZodOptional<z.ZodArray<z.ZodString, "many">>;
    token_url: z.ZodString;
    token_params: z.ZodOptional<z.ZodRecord<z.ZodString, z.ZodString>>;
    redirect_uri_metadata: z.ZodOptional<z.ZodArray<z.ZodString, "many">>;
    token_response_metadata: z.ZodOptional<z.ZodArray<z.ZodString, "many">>;
    token_expiration_buffer: z.ZodOptional<z.ZodNumber>;
}, "strip", z.ZodTypeAny, {
    scheme: AuthScheme.OAuth2 | AuthScheme.OAuth1;
    authorization_url: string;
    token_url: string;
    authorization_params?: Record<string, string> | undefined;
    scope_separator?: string | undefined;
    default_scopes?: string[] | undefined;
    token_params?: Record<string, string> | undefined;
    redirect_uri_metadata?: string[] | undefined;
    token_response_metadata?: string[] | undefined;
    token_expiration_buffer?: number | undefined;
}, {
    scheme: AuthScheme.OAuth2 | AuthScheme.OAuth1;
    authorization_url: string;
    token_url: string;
    authorization_params?: Record<string, string> | undefined;
    scope_separator?: string | undefined;
    default_scopes?: string[] | undefined;
    token_params?: Record<string, string> | undefined;
    redirect_uri_metadata?: string[] | undefined;
    token_response_metadata?: string[] | undefined;
    token_expiration_buffer?: number | undefined;
}>, z.ZodObject<{
    scheme: z.ZodUnion<[z.ZodLiteral<AuthScheme.Basic>, z.ZodLiteral<AuthScheme.ApiKey>]>;
}, "strip", z.ZodTypeAny, {
    scheme: AuthScheme.Basic | AuthScheme.ApiKey;
}, {
    scheme: AuthScheme.Basic | AuthScheme.ApiKey;
}>, z.ZodObject<{
    scheme: z.ZodLiteral<AuthScheme.None>;
}, "strip", z.ZodTypeAny, {
    scheme: AuthScheme.None;
}, {
    scheme: AuthScheme.None;
}>]>;
export type Auth = z.infer<typeof AuthSchema>;
export declare const RetrySchema: z.ZodObject<{
    at: z.ZodOptional<z.ZodString>;
    after: z.ZodOptional<z.ZodString>;
}, "strip", z.ZodTypeAny, {
    at?: string | undefined;
    after?: string | undefined;
}, {
    at?: string | undefined;
    after?: string | undefined;
}>;
export type Retry = z.infer<typeof RetrySchema>;
export declare const CollectionPropertySchema: z.ZodObject<{
    type: z.ZodUnion<[z.ZodLiteral<"string">, z.ZodLiteral<"number">, z.ZodLiteral<"boolean">, z.ZodLiteral<"integer">]>;
    format: z.ZodOptional<z.ZodUnion<[z.ZodLiteral<"date">, z.ZodLiteral<"date-time">]>>;
    description: z.ZodOptional<z.ZodString>;
    index_searchable: z.ZodOptional<z.ZodBoolean>;
    index_filterable: z.ZodOptional<z.ZodBoolean>;
    vector_searchable: z.ZodOptional<z.ZodBoolean>;
    embedding_model: z.ZodOptional<z.ZodUnion<[z.ZodLiteral<"text">, z.ZodLiteral<"multimodal">]>>;
}, "strip", z.ZodTypeAny, {
    type: "string" | "number" | "boolean" | "integer";
    format?: "date" | "date-time" | undefined;
    description?: string | undefined;
    index_searchable?: boolean | undefined;
    index_filterable?: boolean | undefined;
    vector_searchable?: boolean | undefined;
    embedding_model?: "text" | "multimodal" | undefined;
}, {
    type: "string" | "number" | "boolean" | "integer";
    format?: "date" | "date-time" | undefined;
    description?: string | undefined;
    index_searchable?: boolean | undefined;
    index_filterable?: boolean | undefined;
    vector_searchable?: boolean | undefined;
    embedding_model?: "text" | "multimodal" | undefined;
}>;
export type CollectionProperty = z.infer<typeof CollectionPropertySchema>;
export declare const CollectionSchemaSchema: z.ZodObject<{
    name: z.ZodString;
    description: z.ZodString;
    properties: z.ZodRecord<z.ZodString, z.ZodObject<{
        type: z.ZodUnion<[z.ZodLiteral<"string">, z.ZodLiteral<"number">, z.ZodLiteral<"boolean">, z.ZodLiteral<"integer">]>;
        format: z.ZodOptional<z.ZodUnion<[z.ZodLiteral<"date">, z.ZodLiteral<"date-time">]>>;
        description: z.ZodOptional<z.ZodString>;
        index_searchable: z.ZodOptional<z.ZodBoolean>;
        index_filterable: z.ZodOptional<z.ZodBoolean>;
        vector_searchable: z.ZodOptional<z.ZodBoolean>;
        embedding_model: z.ZodOptional<z.ZodUnion<[z.ZodLiteral<"text">, z.ZodLiteral<"multimodal">]>>;
    }, "strip", z.ZodTypeAny, {
        type: "string" | "number" | "boolean" | "integer";
        format?: "date" | "date-time" | undefined;
        description?: string | undefined;
        index_searchable?: boolean | undefined;
        index_filterable?: boolean | undefined;
        vector_searchable?: boolean | undefined;
        embedding_model?: "text" | "multimodal" | undefined;
    }, {
        type: "string" | "number" | "boolean" | "integer";
        format?: "date" | "date-time" | undefined;
        description?: string | undefined;
        index_searchable?: boolean | undefined;
        index_filterable?: boolean | undefined;
        vector_searchable?: boolean | undefined;
        embedding_model?: "text" | "multimodal" | undefined;
    }>>;
    required: z.ZodOptional<z.ZodArray<z.ZodString, "many">>;
}, "strip", z.ZodTypeAny, {
    description: string;
    name: string;
    properties: Record<string, {
        type: "string" | "number" | "boolean" | "integer";
        format?: "date" | "date-time" | undefined;
        description?: string | undefined;
        index_searchable?: boolean | undefined;
        index_filterable?: boolean | undefined;
        vector_searchable?: boolean | undefined;
        embedding_model?: "text" | "multimodal" | undefined;
    }>;
    required?: string[] | undefined;
}, {
    description: string;
    name: string;
    properties: Record<string, {
        type: "string" | "number" | "boolean" | "integer";
        format?: "date" | "date-time" | undefined;
        description?: string | undefined;
        index_searchable?: boolean | undefined;
        index_filterable?: boolean | undefined;
        vector_searchable?: boolean | undefined;
        embedding_model?: "text" | "multimodal" | undefined;
    }>;
    required?: string[] | undefined;
}>;
export type CollectionSchema = z.infer<typeof CollectionSchemaSchema>;
export declare const CollectionsSchema: z.ZodRecord<z.ZodString, z.ZodObject<{
    default_enabled: z.ZodOptional<z.ZodBoolean>;
    default_sync_frequency: z.ZodOptional<z.ZodString>;
    default_auto_start_sync: z.ZodOptional<z.ZodBoolean>;
    required_scopes: z.ZodOptional<z.ZodArray<z.ZodString, "many">>;
    has_multimodal_properties: z.ZodBoolean;
    has_references: z.ZodBoolean;
    schema: z.ZodObject<{
        name: z.ZodString;
        description: z.ZodString;
        properties: z.ZodRecord<z.ZodString, z.ZodObject<{
            type: z.ZodUnion<[z.ZodLiteral<"string">, z.ZodLiteral<"number">, z.ZodLiteral<"boolean">, z.ZodLiteral<"integer">]>;
            format: z.ZodOptional<z.ZodUnion<[z.ZodLiteral<"date">, z.ZodLiteral<"date-time">]>>;
            description: z.ZodOptional<z.ZodString>;
            index_searchable: z.ZodOptional<z.ZodBoolean>;
            index_filterable: z.ZodOptional<z.ZodBoolean>;
            vector_searchable: z.ZodOptional<z.ZodBoolean>;
            embedding_model: z.ZodOptional<z.ZodUnion<[z.ZodLiteral<"text">, z.ZodLiteral<"multimodal">]>>;
        }, "strip", z.ZodTypeAny, {
            type: "string" | "number" | "boolean" | "integer";
            format?: "date" | "date-time" | undefined;
            description?: string | undefined;
            index_searchable?: boolean | undefined;
            index_filterable?: boolean | undefined;
            vector_searchable?: boolean | undefined;
            embedding_model?: "text" | "multimodal" | undefined;
        }, {
            type: "string" | "number" | "boolean" | "integer";
            format?: "date" | "date-time" | undefined;
            description?: string | undefined;
            index_searchable?: boolean | undefined;
            index_filterable?: boolean | undefined;
            vector_searchable?: boolean | undefined;
            embedding_model?: "text" | "multimodal" | undefined;
        }>>;
        required: z.ZodOptional<z.ZodArray<z.ZodString, "many">>;
    }, "strip", z.ZodTypeAny, {
        description: string;
        name: string;
        properties: Record<string, {
            type: "string" | "number" | "boolean" | "integer";
            format?: "date" | "date-time" | undefined;
            description?: string | undefined;
            index_searchable?: boolean | undefined;
            index_filterable?: boolean | undefined;
            vector_searchable?: boolean | undefined;
            embedding_model?: "text" | "multimodal" | undefined;
        }>;
        required?: string[] | undefined;
    }, {
        description: string;
        name: string;
        properties: Record<string, {
            type: "string" | "number" | "boolean" | "integer";
            format?: "date" | "date-time" | undefined;
            description?: string | undefined;
            index_searchable?: boolean | undefined;
            index_filterable?: boolean | undefined;
            vector_searchable?: boolean | undefined;
            embedding_model?: "text" | "multimodal" | undefined;
        }>;
        required?: string[] | undefined;
    }>;
}, "strip", z.ZodTypeAny, {
    has_multimodal_properties: boolean;
    has_references: boolean;
    schema: {
        description: string;
        name: string;
        properties: Record<string, {
            type: "string" | "number" | "boolean" | "integer";
            format?: "date" | "date-time" | undefined;
            description?: string | undefined;
            index_searchable?: boolean | undefined;
            index_filterable?: boolean | undefined;
            vector_searchable?: boolean | undefined;
            embedding_model?: "text" | "multimodal" | undefined;
        }>;
        required?: string[] | undefined;
    };
    default_enabled?: boolean | undefined;
    default_sync_frequency?: string | undefined;
    default_auto_start_sync?: boolean | undefined;
    required_scopes?: string[] | undefined;
}, {
    has_multimodal_properties: boolean;
    has_references: boolean;
    schema: {
        description: string;
        name: string;
        properties: Record<string, {
            type: "string" | "number" | "boolean" | "integer";
            format?: "date" | "date-time" | undefined;
            description?: string | undefined;
            index_searchable?: boolean | undefined;
            index_filterable?: boolean | undefined;
            vector_searchable?: boolean | undefined;
            embedding_model?: "text" | "multimodal" | undefined;
        }>;
        required?: string[] | undefined;
    };
    default_enabled?: boolean | undefined;
    default_sync_frequency?: string | undefined;
    default_auto_start_sync?: boolean | undefined;
    required_scopes?: string[] | undefined;
}>>;
export type Collections = z.infer<typeof CollectionsSchema>;
export declare const ActionPropertySchema: z.ZodObject<{
    type: z.ZodString;
    enum: z.ZodOptional<z.ZodArray<z.ZodString, "many">>;
    description: z.ZodOptional<z.ZodString>;
}, "strip", z.ZodTypeAny, {
    type: string;
    enum?: string[] | undefined;
    description?: string | undefined;
}, {
    type: string;
    enum?: string[] | undefined;
    description?: string | undefined;
}>;
export type ActionProperty = z.infer<typeof ActionPropertySchema>;
export declare const ActionSchemaSchema: z.ZodObject<{
    name: z.ZodString;
    description: z.ZodString;
    parameters: z.ZodObject<{
        type: z.ZodLiteral<"object">;
        properties: z.ZodRecord<z.ZodString, z.ZodObject<{
            type: z.ZodString;
            enum: z.ZodOptional<z.ZodArray<z.ZodString, "many">>;
            description: z.ZodOptional<z.ZodString>;
        }, "strip", z.ZodTypeAny, {
            type: string;
            enum?: string[] | undefined;
            description?: string | undefined;
        }, {
            type: string;
            enum?: string[] | undefined;
            description?: string | undefined;
        }>>;
        required: z.ZodOptional<z.ZodArray<z.ZodString, "many">>;
    }, "strip", z.ZodTypeAny, {
        type: "object";
        properties: Record<string, {
            type: string;
            enum?: string[] | undefined;
            description?: string | undefined;
        }>;
        required?: string[] | undefined;
    }, {
        type: "object";
        properties: Record<string, {
            type: string;
            enum?: string[] | undefined;
            description?: string | undefined;
        }>;
        required?: string[] | undefined;
    }>;
    required: z.ZodOptional<z.ZodArray<z.ZodString, "many">>;
}, "strip", z.ZodTypeAny, {
    description: string;
    name: string;
    parameters: {
        type: "object";
        properties: Record<string, {
            type: string;
            enum?: string[] | undefined;
            description?: string | undefined;
        }>;
        required?: string[] | undefined;
    };
    required?: string[] | undefined;
}, {
    description: string;
    name: string;
    parameters: {
        type: "object";
        properties: Record<string, {
            type: string;
            enum?: string[] | undefined;
            description?: string | undefined;
        }>;
        required?: string[] | undefined;
    };
    required?: string[] | undefined;
}>;
export type ActionSchema = z.infer<typeof ActionSchemaSchema>;
export declare const ActionsSchema: z.ZodRecord<z.ZodString, z.ZodObject<{
    default_enabled: z.ZodOptional<z.ZodBoolean>;
    required_scopes: z.ZodOptional<z.ZodArray<z.ZodString, "many">>;
    schema: z.ZodObject<{
        name: z.ZodString;
        description: z.ZodString;
        parameters: z.ZodObject<{
            type: z.ZodLiteral<"object">;
            properties: z.ZodRecord<z.ZodString, z.ZodObject<{
                type: z.ZodString;
                enum: z.ZodOptional<z.ZodArray<z.ZodString, "many">>;
                description: z.ZodOptional<z.ZodString>;
            }, "strip", z.ZodTypeAny, {
                type: string;
                enum?: string[] | undefined;
                description?: string | undefined;
            }, {
                type: string;
                enum?: string[] | undefined;
                description?: string | undefined;
            }>>;
            required: z.ZodOptional<z.ZodArray<z.ZodString, "many">>;
        }, "strip", z.ZodTypeAny, {
            type: "object";
            properties: Record<string, {
                type: string;
                enum?: string[] | undefined;
                description?: string | undefined;
            }>;
            required?: string[] | undefined;
        }, {
            type: "object";
            properties: Record<string, {
                type: string;
                enum?: string[] | undefined;
                description?: string | undefined;
            }>;
            required?: string[] | undefined;
        }>;
        required: z.ZodOptional<z.ZodArray<z.ZodString, "many">>;
    }, "strip", z.ZodTypeAny, {
        description: string;
        name: string;
        parameters: {
            type: "object";
            properties: Record<string, {
                type: string;
                enum?: string[] | undefined;
                description?: string | undefined;
            }>;
            required?: string[] | undefined;
        };
        required?: string[] | undefined;
    }, {
        description: string;
        name: string;
        parameters: {
            type: "object";
            properties: Record<string, {
                type: string;
                enum?: string[] | undefined;
                description?: string | undefined;
            }>;
            required?: string[] | undefined;
        };
        required?: string[] | undefined;
    }>;
}, "strip", z.ZodTypeAny, {
    schema: {
        description: string;
        name: string;
        parameters: {
            type: "object";
            properties: Record<string, {
                type: string;
                enum?: string[] | undefined;
                description?: string | undefined;
            }>;
            required?: string[] | undefined;
        };
        required?: string[] | undefined;
    };
    default_enabled?: boolean | undefined;
    required_scopes?: string[] | undefined;
}, {
    schema: {
        description: string;
        name: string;
        parameters: {
            type: "object";
            properties: Record<string, {
                type: string;
                enum?: string[] | undefined;
                description?: string | undefined;
            }>;
            required?: string[] | undefined;
        };
        required?: string[] | undefined;
    };
    default_enabled?: boolean | undefined;
    required_scopes?: string[] | undefined;
}>>;
export type Actions = z.infer<typeof ActionsSchema>;
export declare const ProviderSpecificationSchema: z.ZodObject<{
    unique_key: z.ZodString;
    name: z.ZodString;
    base_url: z.ZodString;
    auth: z.ZodUnion<[z.ZodObject<{
        scheme: z.ZodUnion<[z.ZodLiteral<AuthScheme.OAuth1>, z.ZodLiteral<AuthScheme.OAuth2>]>;
        authorization_url: z.ZodString;
        authorization_params: z.ZodOptional<z.ZodRecord<z.ZodString, z.ZodString>>;
        scope_separator: z.ZodOptional<z.ZodString>;
        default_scopes: z.ZodOptional<z.ZodArray<z.ZodString, "many">>;
        token_url: z.ZodString;
        token_params: z.ZodOptional<z.ZodRecord<z.ZodString, z.ZodString>>;
        redirect_uri_metadata: z.ZodOptional<z.ZodArray<z.ZodString, "many">>;
        token_response_metadata: z.ZodOptional<z.ZodArray<z.ZodString, "many">>;
        token_expiration_buffer: z.ZodOptional<z.ZodNumber>;
    }, "strip", z.ZodTypeAny, {
        scheme: AuthScheme.OAuth2 | AuthScheme.OAuth1;
        authorization_url: string;
        token_url: string;
        authorization_params?: Record<string, string> | undefined;
        scope_separator?: string | undefined;
        default_scopes?: string[] | undefined;
        token_params?: Record<string, string> | undefined;
        redirect_uri_metadata?: string[] | undefined;
        token_response_metadata?: string[] | undefined;
        token_expiration_buffer?: number | undefined;
    }, {
        scheme: AuthScheme.OAuth2 | AuthScheme.OAuth1;
        authorization_url: string;
        token_url: string;
        authorization_params?: Record<string, string> | undefined;
        scope_separator?: string | undefined;
        default_scopes?: string[] | undefined;
        token_params?: Record<string, string> | undefined;
        redirect_uri_metadata?: string[] | undefined;
        token_response_metadata?: string[] | undefined;
        token_expiration_buffer?: number | undefined;
    }>, z.ZodObject<{
        scheme: z.ZodUnion<[z.ZodLiteral<AuthScheme.Basic>, z.ZodLiteral<AuthScheme.ApiKey>]>;
    }, "strip", z.ZodTypeAny, {
        scheme: AuthScheme.Basic | AuthScheme.ApiKey;
    }, {
        scheme: AuthScheme.Basic | AuthScheme.ApiKey;
    }>, z.ZodObject<{
        scheme: z.ZodLiteral<AuthScheme.None>;
    }, "strip", z.ZodTypeAny, {
        scheme: AuthScheme.None;
    }, {
        scheme: AuthScheme.None;
    }>]>;
    headers: z.ZodOptional<z.ZodRecord<z.ZodString, z.ZodString>>;
    retry: z.ZodOptional<z.ZodObject<{
        at: z.ZodOptional<z.ZodString>;
        after: z.ZodOptional<z.ZodString>;
    }, "strip", z.ZodTypeAny, {
        at?: string | undefined;
        after?: string | undefined;
    }, {
        at?: string | undefined;
        after?: string | undefined;
    }>>;
    logo_url: z.ZodString;
    logo_url_dark_mode: z.ZodOptional<z.ZodString>;
    docs_url: z.ZodOptional<z.ZodString>;
    collections: z.ZodOptional<z.ZodRecord<z.ZodString, z.ZodObject<{
        default_enabled: z.ZodOptional<z.ZodBoolean>;
        default_sync_frequency: z.ZodOptional<z.ZodString>;
        default_auto_start_sync: z.ZodOptional<z.ZodBoolean>;
        required_scopes: z.ZodOptional<z.ZodArray<z.ZodString, "many">>;
        has_multimodal_properties: z.ZodBoolean;
        has_references: z.ZodBoolean;
        schema: z.ZodObject<{
            name: z.ZodString;
            description: z.ZodString;
            properties: z.ZodRecord<z.ZodString, z.ZodObject<{
                type: z.ZodUnion<[z.ZodLiteral<"string">, z.ZodLiteral<"number">, z.ZodLiteral<"boolean">, z.ZodLiteral<"integer">]>;
                format: z.ZodOptional<z.ZodUnion<[z.ZodLiteral<"date">, z.ZodLiteral<"date-time">]>>;
                description: z.ZodOptional<z.ZodString>;
                index_searchable: z.ZodOptional<z.ZodBoolean>;
                index_filterable: z.ZodOptional<z.ZodBoolean>;
                vector_searchable: z.ZodOptional<z.ZodBoolean>;
                embedding_model: z.ZodOptional<z.ZodUnion<[z.ZodLiteral<"text">, z.ZodLiteral<"multimodal">]>>;
            }, "strip", z.ZodTypeAny, {
                type: "string" | "number" | "boolean" | "integer";
                format?: "date" | "date-time" | undefined;
                description?: string | undefined;
                index_searchable?: boolean | undefined;
                index_filterable?: boolean | undefined;
                vector_searchable?: boolean | undefined;
                embedding_model?: "text" | "multimodal" | undefined;
            }, {
                type: "string" | "number" | "boolean" | "integer";
                format?: "date" | "date-time" | undefined;
                description?: string | undefined;
                index_searchable?: boolean | undefined;
                index_filterable?: boolean | undefined;
                vector_searchable?: boolean | undefined;
                embedding_model?: "text" | "multimodal" | undefined;
            }>>;
            required: z.ZodOptional<z.ZodArray<z.ZodString, "many">>;
        }, "strip", z.ZodTypeAny, {
            description: string;
            name: string;
            properties: Record<string, {
                type: "string" | "number" | "boolean" | "integer";
                format?: "date" | "date-time" | undefined;
                description?: string | undefined;
                index_searchable?: boolean | undefined;
                index_filterable?: boolean | undefined;
                vector_searchable?: boolean | undefined;
                embedding_model?: "text" | "multimodal" | undefined;
            }>;
            required?: string[] | undefined;
        }, {
            description: string;
            name: string;
            properties: Record<string, {
                type: "string" | "number" | "boolean" | "integer";
                format?: "date" | "date-time" | undefined;
                description?: string | undefined;
                index_searchable?: boolean | undefined;
                index_filterable?: boolean | undefined;
                vector_searchable?: boolean | undefined;
                embedding_model?: "text" | "multimodal" | undefined;
            }>;
            required?: string[] | undefined;
        }>;
    }, "strip", z.ZodTypeAny, {
        has_multimodal_properties: boolean;
        has_references: boolean;
        schema: {
            description: string;
            name: string;
            properties: Record<string, {
                type: "string" | "number" | "boolean" | "integer";
                format?: "date" | "date-time" | undefined;
                description?: string | undefined;
                index_searchable?: boolean | undefined;
                index_filterable?: boolean | undefined;
                vector_searchable?: boolean | undefined;
                embedding_model?: "text" | "multimodal" | undefined;
            }>;
            required?: string[] | undefined;
        };
        default_enabled?: boolean | undefined;
        default_sync_frequency?: string | undefined;
        default_auto_start_sync?: boolean | undefined;
        required_scopes?: string[] | undefined;
    }, {
        has_multimodal_properties: boolean;
        has_references: boolean;
        schema: {
            description: string;
            name: string;
            properties: Record<string, {
                type: "string" | "number" | "boolean" | "integer";
                format?: "date" | "date-time" | undefined;
                description?: string | undefined;
                index_searchable?: boolean | undefined;
                index_filterable?: boolean | undefined;
                vector_searchable?: boolean | undefined;
                embedding_model?: "text" | "multimodal" | undefined;
            }>;
            required?: string[] | undefined;
        };
        default_enabled?: boolean | undefined;
        default_sync_frequency?: string | undefined;
        default_auto_start_sync?: boolean | undefined;
        required_scopes?: string[] | undefined;
    }>>>;
    actions: z.ZodOptional<z.ZodRecord<z.ZodString, z.ZodObject<{
        default_enabled: z.ZodOptional<z.ZodBoolean>;
        required_scopes: z.ZodOptional<z.ZodArray<z.ZodString, "many">>;
        schema: z.ZodObject<{
            name: z.ZodString;
            description: z.ZodString;
            parameters: z.ZodObject<{
                type: z.ZodLiteral<"object">;
                properties: z.ZodRecord<z.ZodString, z.ZodObject<{
                    type: z.ZodString;
                    enum: z.ZodOptional<z.ZodArray<z.ZodString, "many">>;
                    description: z.ZodOptional<z.ZodString>;
                }, "strip", z.ZodTypeAny, {
                    type: string;
                    enum?: string[] | undefined;
                    description?: string | undefined;
                }, {
                    type: string;
                    enum?: string[] | undefined;
                    description?: string | undefined;
                }>>;
                required: z.ZodOptional<z.ZodArray<z.ZodString, "many">>;
            }, "strip", z.ZodTypeAny, {
                type: "object";
                properties: Record<string, {
                    type: string;
                    enum?: string[] | undefined;
                    description?: string | undefined;
                }>;
                required?: string[] | undefined;
            }, {
                type: "object";
                properties: Record<string, {
                    type: string;
                    enum?: string[] | undefined;
                    description?: string | undefined;
                }>;
                required?: string[] | undefined;
            }>;
            required: z.ZodOptional<z.ZodArray<z.ZodString, "many">>;
        }, "strip", z.ZodTypeAny, {
            description: string;
            name: string;
            parameters: {
                type: "object";
                properties: Record<string, {
                    type: string;
                    enum?: string[] | undefined;
                    description?: string | undefined;
                }>;
                required?: string[] | undefined;
            };
            required?: string[] | undefined;
        }, {
            description: string;
            name: string;
            parameters: {
                type: "object";
                properties: Record<string, {
                    type: string;
                    enum?: string[] | undefined;
                    description?: string | undefined;
                }>;
                required?: string[] | undefined;
            };
            required?: string[] | undefined;
        }>;
    }, "strip", z.ZodTypeAny, {
        schema: {
            description: string;
            name: string;
            parameters: {
                type: "object";
                properties: Record<string, {
                    type: string;
                    enum?: string[] | undefined;
                    description?: string | undefined;
                }>;
                required?: string[] | undefined;
            };
            required?: string[] | undefined;
        };
        default_enabled?: boolean | undefined;
        required_scopes?: string[] | undefined;
    }, {
        schema: {
            description: string;
            name: string;
            parameters: {
                type: "object";
                properties: Record<string, {
                    type: string;
                    enum?: string[] | undefined;
                    description?: string | undefined;
                }>;
                required?: string[] | undefined;
            };
            required?: string[] | undefined;
        };
        default_enabled?: boolean | undefined;
        required_scopes?: string[] | undefined;
    }>>>;
}, "strip", z.ZodTypeAny, {
    name: string;
    unique_key: string;
    base_url: string;
    auth: {
        scheme: AuthScheme.None;
    } | {
        scheme: AuthScheme.Basic | AuthScheme.ApiKey;
    } | {
        scheme: AuthScheme.OAuth2 | AuthScheme.OAuth1;
        authorization_url: string;
        token_url: string;
        authorization_params?: Record<string, string> | undefined;
        scope_separator?: string | undefined;
        default_scopes?: string[] | undefined;
        token_params?: Record<string, string> | undefined;
        redirect_uri_metadata?: string[] | undefined;
        token_response_metadata?: string[] | undefined;
        token_expiration_buffer?: number | undefined;
    };
    logo_url: string;
    headers?: Record<string, string> | undefined;
    retry?: {
        at?: string | undefined;
        after?: string | undefined;
    } | undefined;
    logo_url_dark_mode?: string | undefined;
    docs_url?: string | undefined;
    collections?: Record<string, {
        has_multimodal_properties: boolean;
        has_references: boolean;
        schema: {
            description: string;
            name: string;
            properties: Record<string, {
                type: "string" | "number" | "boolean" | "integer";
                format?: "date" | "date-time" | undefined;
                description?: string | undefined;
                index_searchable?: boolean | undefined;
                index_filterable?: boolean | undefined;
                vector_searchable?: boolean | undefined;
                embedding_model?: "text" | "multimodal" | undefined;
            }>;
            required?: string[] | undefined;
        };
        default_enabled?: boolean | undefined;
        default_sync_frequency?: string | undefined;
        default_auto_start_sync?: boolean | undefined;
        required_scopes?: string[] | undefined;
    }> | undefined;
    actions?: Record<string, {
        schema: {
            description: string;
            name: string;
            parameters: {
                type: "object";
                properties: Record<string, {
                    type: string;
                    enum?: string[] | undefined;
                    description?: string | undefined;
                }>;
                required?: string[] | undefined;
            };
            required?: string[] | undefined;
        };
        default_enabled?: boolean | undefined;
        required_scopes?: string[] | undefined;
    }> | undefined;
}, {
    name: string;
    unique_key: string;
    base_url: string;
    auth: {
        scheme: AuthScheme.None;
    } | {
        scheme: AuthScheme.Basic | AuthScheme.ApiKey;
    } | {
        scheme: AuthScheme.OAuth2 | AuthScheme.OAuth1;
        authorization_url: string;
        token_url: string;
        authorization_params?: Record<string, string> | undefined;
        scope_separator?: string | undefined;
        default_scopes?: string[] | undefined;
        token_params?: Record<string, string> | undefined;
        redirect_uri_metadata?: string[] | undefined;
        token_response_metadata?: string[] | undefined;
        token_expiration_buffer?: number | undefined;
    };
    logo_url: string;
    headers?: Record<string, string> | undefined;
    retry?: {
        at?: string | undefined;
        after?: string | undefined;
    } | undefined;
    logo_url_dark_mode?: string | undefined;
    docs_url?: string | undefined;
    collections?: Record<string, {
        has_multimodal_properties: boolean;
        has_references: boolean;
        schema: {
            description: string;
            name: string;
            properties: Record<string, {
                type: "string" | "number" | "boolean" | "integer";
                format?: "date" | "date-time" | undefined;
                description?: string | undefined;
                index_searchable?: boolean | undefined;
                index_filterable?: boolean | undefined;
                vector_searchable?: boolean | undefined;
                embedding_model?: "text" | "multimodal" | undefined;
            }>;
            required?: string[] | undefined;
        };
        default_enabled?: boolean | undefined;
        default_sync_frequency?: string | undefined;
        default_auto_start_sync?: boolean | undefined;
        required_scopes?: string[] | undefined;
    }> | undefined;
    actions?: Record<string, {
        schema: {
            description: string;
            name: string;
            parameters: {
                type: "object";
                properties: Record<string, {
                    type: string;
                    enum?: string[] | undefined;
                    description?: string | undefined;
                }>;
                required?: string[] | undefined;
            };
            required?: string[] | undefined;
        };
        default_enabled?: boolean | undefined;
        required_scopes?: string[] | undefined;
    }> | undefined;
}>;
export type ProviderSpecification = z.infer<typeof ProviderSpecificationSchema>;
export type InternalProxyOptions = Omit<ProxyOptions, 'linkedAccountId'>;
export type MethodProxyOptions = Omit<InternalProxyOptions, 'method'>;
export interface BaseContext {
    proxy<T = any>(options: InternalProxyOptions): Promise<AxiosResponse<T>>;
    get<T = any>(options: MethodProxyOptions): Promise<AxiosResponse<T>>;
    post<T = any>(options: MethodProxyOptions): Promise<AxiosResponse<T>>;
    patch<T = any>(options: MethodProxyOptions): Promise<AxiosResponse<T>>;
    put<T = any>(options: MethodProxyOptions): Promise<AxiosResponse<T>>;
    delete<T = any>(options: MethodProxyOptions): Promise<AxiosResponse<T>>;
}
export interface SyncContext extends BaseContext {
    lastSyncedAt: number | null;
}
export interface ActionContext extends BaseContext {
}
