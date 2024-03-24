"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.ProviderSpecificationSchema = exports.ActionsSchema = exports.ActionSchemaSchema = exports.ActionPropertySchema = exports.CollectionsSchema = exports.CollectionSchemaSchema = exports.CollectionPropertySchema = exports.RetrySchema = exports.AuthSchema = exports.OAuth1Schema = exports.OAuth2Schema = exports.OAuthBodyFormat = exports.OAuthAuthorizationMethod = exports.OAuthSchema = exports.ApiAuthSchema = exports.NoAuthSchema = exports.AuthScheme = void 0;
const zod_1 = require("zod");
var AuthScheme;
(function (AuthScheme) {
    AuthScheme["OAuth2"] = "oauth2";
    AuthScheme["OAuth1"] = "oauth1";
    AuthScheme["Basic"] = "basic";
    AuthScheme["ApiKey"] = "api_key";
    AuthScheme["None"] = "none";
})(AuthScheme || (exports.AuthScheme = AuthScheme = {}));
exports.NoAuthSchema = zod_1.z.object({
    scheme: zod_1.z.literal(AuthScheme.None),
});
exports.ApiAuthSchema = zod_1.z.object({
    scheme: zod_1.z.union([zod_1.z.literal(AuthScheme.Basic), zod_1.z.literal(AuthScheme.ApiKey)]),
});
exports.OAuthSchema = zod_1.z.object({
    scheme: zod_1.z.union([zod_1.z.literal(AuthScheme.OAuth1), zod_1.z.literal(AuthScheme.OAuth2)]),
    authorization_url: zod_1.z.string(),
    authorization_params: zod_1.z.record(zod_1.z.string()).optional(),
    scope_separator: zod_1.z.string().optional(),
    default_scopes: zod_1.z.array(zod_1.z.string()).optional(),
    token_url: zod_1.z.string(),
    token_params: zod_1.z.record(zod_1.z.string()).optional(),
    redirect_uri_metadata: zod_1.z.array(zod_1.z.string()).optional(),
    token_response_metadata: zod_1.z.array(zod_1.z.string()).optional(),
    token_expiration_buffer: zod_1.z.number().optional(),
});
var OAuthAuthorizationMethod;
(function (OAuthAuthorizationMethod) {
    OAuthAuthorizationMethod["BODY"] = "body";
    OAuthAuthorizationMethod["HEADER"] = "header";
})(OAuthAuthorizationMethod || (exports.OAuthAuthorizationMethod = OAuthAuthorizationMethod = {}));
var OAuthBodyFormat;
(function (OAuthBodyFormat) {
    OAuthBodyFormat["FORM"] = "form";
    OAuthBodyFormat["JSON"] = "json";
})(OAuthBodyFormat || (exports.OAuthBodyFormat = OAuthBodyFormat = {}));
exports.OAuth2Schema = exports.OAuthSchema.extend({
    scheme: zod_1.z.literal(AuthScheme.OAuth2),
    disable_pkce: zod_1.z.boolean().optional(),
    token_params: zod_1.z
        .object({ grant_type: zod_1.z.enum(['authorization_code', 'client_credentials']).optional() })
        .optional(),
    refresh_params: zod_1.z.object({ grant_type: zod_1.z.literal('refresh_token') }).optional(),
    authorization_method: zod_1.z.nativeEnum(OAuthAuthorizationMethod).optional(),
    body_format: zod_1.z.nativeEnum(OAuthBodyFormat).optional(),
    refresh_url: zod_1.z.string().optional(),
    token_request_auth_method: zod_1.z.literal('basic').optional(),
});
exports.OAuth1Schema = exports.OAuthSchema.extend({
    scheme: zod_1.z.literal(AuthScheme.OAuth1),
    request_url: zod_1.z.string(),
    request_params: zod_1.z.record(zod_1.z.string()).optional(),
    request_http_method: zod_1.z.enum(['GET', 'PUT', 'POST']).optional(),
    token_http_method: zod_1.z.enum(['GET', 'PUT', 'POST']).optional(),
    signature_method: zod_1.z.enum(['HMAC-SHA1', 'RSA-SHA1', 'PLAINTEXT']),
});
exports.AuthSchema = zod_1.z.union([exports.OAuthSchema, exports.ApiAuthSchema, exports.NoAuthSchema]);
exports.RetrySchema = zod_1.z.object({
    at: zod_1.z.string().optional(),
    after: zod_1.z.string().optional(),
});
exports.CollectionPropertySchema = zod_1.z.object({
    type: zod_1.z.union([
        zod_1.z.literal('string'),
        zod_1.z.literal('number'),
        zod_1.z.literal('boolean'),
        zod_1.z.literal('integer'),
    ]),
    format: zod_1.z.union([zod_1.z.literal('date'), zod_1.z.literal('date-time')]).optional(),
    description: zod_1.z.string().optional(),
    index_searchable: zod_1.z.boolean().optional(),
    index_filterable: zod_1.z.boolean().optional(),
    vector_searchable: zod_1.z.boolean().optional(),
    embedding_model: zod_1.z.union([zod_1.z.literal('text'), zod_1.z.literal('multimodal')]).optional(),
});
exports.CollectionSchemaSchema = zod_1.z.object({
    name: zod_1.z.string(),
    description: zod_1.z.string(),
    properties: zod_1.z.record(exports.CollectionPropertySchema),
    required: zod_1.z.array(zod_1.z.string()).optional(),
});
exports.CollectionsSchema = zod_1.z.record(zod_1.z.object({
    default_enabled: zod_1.z.boolean().optional(),
    default_sync_frequency: zod_1.z.string().optional(),
    default_auto_start_sync: zod_1.z.boolean().optional(),
    required_scopes: zod_1.z.array(zod_1.z.string()).optional(),
    has_multimodal_properties: zod_1.z.boolean(),
    has_references: zod_1.z.boolean(),
    schema: exports.CollectionSchemaSchema,
}));
exports.ActionPropertySchema = zod_1.z.object({
    type: zod_1.z.string(),
    enum: zod_1.z.array(zod_1.z.string()).optional(),
    description: zod_1.z.string().optional(),
});
exports.ActionSchemaSchema = zod_1.z.object({
    name: zod_1.z.string(),
    description: zod_1.z.string(),
    parameters: zod_1.z.object({
        type: zod_1.z.literal('object'),
        properties: zod_1.z.record(exports.ActionPropertySchema),
        required: zod_1.z.array(zod_1.z.string()).optional(),
    }),
    required: zod_1.z.array(zod_1.z.string()).optional(),
});
exports.ActionsSchema = zod_1.z.record(zod_1.z.object({
    default_enabled: zod_1.z.boolean().optional(),
    required_scopes: zod_1.z.array(zod_1.z.string()).optional(),
    schema: exports.ActionSchemaSchema,
}));
exports.ProviderSpecificationSchema = zod_1.z.object({
    unique_key: zod_1.z.string(),
    name: zod_1.z.string(),
    base_url: zod_1.z.string(),
    auth: exports.AuthSchema,
    headers: zod_1.z.record(zod_1.z.string()).optional(),
    retry: exports.RetrySchema.optional(),
    logo_url: zod_1.z.string(),
    logo_url_dark_mode: zod_1.z.string().optional(),
    docs_url: zod_1.z.string().optional(),
    collections: exports.CollectionsSchema.optional(),
    actions: exports.ActionsSchema.optional(),
});
//# sourceMappingURL=types.js.map