import { AuthScheme, OAuth, OAuth1, OAuth2, ProviderSpecification } from '@embed/providers';
import type { ConnectToken, Integration } from '@embed/shared';
import {
  Branding,
  DEFAULT_ERROR_MESSAGE,
  LogLevel,
  OAuth1Client,
  Resource,
  actionService,
  activityService,
  collectionService,
  connectionService,
  environmentService,
  errorService,
  generateId,
  getSimpleOAuth2ClientConfig,
  integrationService,
  missesInterpolationParam,
  now,
  parseRawCredentials,
  providerService,
} from '@embed/shared';
import crypto from 'crypto';
import type { Request, Response } from 'express';
import SimpleOAuth2 from 'simple-oauth2';
import publisher from '../clients/publisher.client';
import connectionHook from '../hooks/connection.hook';
import connectTokenService from '../services/connectToken.service';
import { extractConfigurationKeys, getOauthCallbackUrl } from '../utils/helpers';
import connectController from './connect.controller';

class OAuthController {
  public async authorize(req: Request, res: Response) {
    const token = req.query['token'];
    if (!token || typeof token !== 'string') {
      return await publisher.publishError(res, {
        error: 'Connect token missing',
      });
    }

    const connectToken = await connectTokenService.getConnectTokenById(token);
    if (!connectToken) {
      return await publisher.publishError(res, {
        error: 'Invalid connect token',
      });
    }

    const connectMethod = connectToken.connect_method || undefined;
    const wsClientId = connectToken.websocket_client_id || undefined;
    const redirectUrl = connectToken.redirect_url || undefined;
    const prefersDarkMode = connectToken.prefers_dark_mode || false;

    const activityId = await activityService.findActivityIdByConnectToken(connectToken.id);
    const branding = await environmentService.getEnvironmentBranding(connectToken.environment_id);

    try {
      if (connectToken.expires_at < now()) {
        const errorMessage = 'Connect token expired';
        await activityService.createActivityLog(activityId, {
          timestamp: now(),
          level: LogLevel.Error,
          message: errorMessage,
        });

        return await publisher.publishError(res, {
          error: errorMessage,
          wsClientId,
          connectMethod,
          redirectUrl,
          branding,
          prefersDarkMode,
        });
      }

      const integration = await integrationService.getIntegrationById(connectToken.integration_id);
      if (!integration) {
        throw new Error(`Failed to retrieve integration with ID ${connectToken.integration_id}`);
      }

      if (!integration.is_enabled) {
        const errorMessage = 'Integration is disabled';
        await activityService.createActivityLog(activityId, {
          timestamp: now(),
          level: LogLevel.Error,
          message: errorMessage,
        });

        return await publisher.publishError(res, {
          error: errorMessage,
          wsClientId,
          connectMethod,
          redirectUrl,
          branding,
          prefersDarkMode,
        });
      }

      const provider = await providerService.getProviderSpec(integration.provider_key);
      if (!provider) {
        throw new Error('Failed to retrieve provider specification');
      }

      const scopesArray = await this.getScopes(integration, provider);
      const authSpec = provider.auth.find((auth) => auth.scheme === integration.auth_scheme);
      if (!authSpec) {
        throw new Error('Provider auth configuration not found');
      }

      const scopes = scopesArray.join((authSpec as OAuth).scope_separator || ' ');
      const updatedConnectToken = await connectTokenService.updateConnectToken(connectToken.id, {
        code_verifier: crypto.randomBytes(24).toString('hex'),
        updated_at: now(),
      });

      if (!updatedConnectToken) {
        throw new Error('Failed to update connect token');
      }

      await activityService.createActivityLog(activityId, {
        timestamp: now(),
        level: LogLevel.Info,
        message: `Initiating OAuth authorization flow for ${provider.name}`,
      });

      if (integration.auth_scheme === AuthScheme.OAuth2) {
        return this.oauth2Request(res, {
          authSpec: authSpec as OAuth2,
          scopes,
          integration,
          connectToken: updatedConnectToken,
          activityId,
          branding,
        });
      } else if (integration.auth_scheme === AuthScheme.OAuth1) {
        return this.oauth1Request(res, {
          authSpec: authSpec as OAuth1,
          scopes,
          integration,
          connectToken: updatedConnectToken,
          activityId,
          branding,
        });
      } else {
        throw new Error(`Unsupported auth scheme: ${integration.auth_scheme}`);
      }
    } catch (err) {
      await errorService.reportError(err);
      await activityService.createActivityLog(activityId, {
        timestamp: now(),
        level: LogLevel.Error,
        message: 'Internal server error',
      });

      return await publisher.publishError(res, {
        error: DEFAULT_ERROR_MESSAGE,
        wsClientId,
        connectMethod,
        redirectUrl,
        branding,
        prefersDarkMode,
      });
    }
  }

  private async oauth2Request(
    res: Response,
    {
      connectToken,
      authSpec,
      scopes,
      integration,
      activityId,
      branding,
    }: {
      connectToken: ConnectToken;
      authSpec: OAuth2;
      scopes: string;
      integration: Integration;
      activityId: string | null;
      branding: Branding;
    }
  ) {
    const connectMethod = connectToken.connect_method || undefined;
    const wsClientId = connectToken.websocket_client_id || undefined;
    const redirectUrl = connectToken.redirect_url || undefined;
    const prefersDarkMode = connectToken.prefers_dark_mode || false;

    try {
      if (!integration.is_using_test_credentials) {
        if (!integration.oauth_client_id || !integration.oauth_client_secret) {
          const errorMessage = `OAuth credentials missing for integration ${integration.id}`;
          await activityService.createActivityLog(activityId, {
            timestamp: now(),
            level: LogLevel.Error,
            message: errorMessage,
          });

          return await publisher.publishError(res, {
            error: errorMessage,
            wsClientId,
            connectMethod,
            redirectUrl,
            branding,
            prefersDarkMode,
          });
        }
      }

      const authorizationUrlKeys = extractConfigurationKeys(authSpec.authorization_url);
      const tokenUrlKeys = extractConfigurationKeys(authSpec.token_url);
      if (authorizationUrlKeys.length > 0 || tokenUrlKeys.length > 0) {
        if (
          !connectToken.configuration ||
          missesInterpolationParam(
            authSpec.authorization_url,
            connectToken.configuration as Record<string, string>
          ) ||
          missesInterpolationParam(
            authSpec.token_url,
            connectToken.configuration as Record<string, string>
          )
        ) {
          const errorMessage = 'Missing configuration fields';
          await activityService.createActivityLog(activityId, {
            timestamp: now(),
            level: LogLevel.Error,
            message: errorMessage,
            payload: {
              authorization_url: authSpec.authorization_url,
              token_url: authSpec.token_url,
              configuration: connectToken.configuration,
            },
          });

          return await publisher.publishError(res, {
            error: errorMessage,
            wsClientId,
            connectMethod,
            redirectUrl,
            branding,
            prefersDarkMode,
          });
        }
      }

      if (
        authSpec.token_params == undefined ||
        authSpec.token_params.grant_type == undefined ||
        authSpec.token_params.grant_type == 'authorization_code'
      ) {
        let authParams: Record<string, string | undefined> = authSpec.authorization_params || {};
        if (!authSpec.disable_pkce) {
          const h = crypto
            .createHash('sha256')
            .update(connectToken.code_verifier!)
            .digest('base64')
            .replace(/\+/g, '-')
            .replace(/\//g, '_')
            .replace(/=+$/, '');
          authParams['code_challenge'] = h;
          authParams['code_challenge_method'] = 'S256';
        }

        Object.keys(authParams).forEach((key) =>
          authParams[key] === undefined ? delete authParams[key] : {}
        );

        const callbackUrl = getOauthCallbackUrl();
        const simpleOAuth2ClientConfig = getSimpleOAuth2ClientConfig(
          integration,
          authSpec,
          connectToken.configuration as Record<string, string>
        );

        const authorizationCode = new SimpleOAuth2.AuthorizationCode(simpleOAuth2ClientConfig);
        const authorizationUri = authorizationCode.authorizeURL({
          redirect_uri: callbackUrl,
          scope: scopes,
          state: connectToken.id,
          ...authParams,
        });

        await activityService.createActivityLog(activityId, {
          timestamp: now(),
          level: LogLevel.Info,
          message: `Redirecting to OAuth authorization URL`,
          payload: { authorization_url: authorizationUri },
        });

        res.redirect(authorizationUri);
      } else {
        throw new Error(`Unsupported grant type: ${authSpec.token_params.grant_type}`);
      }
    } catch (err) {
      await errorService.reportError(err);

      await activityService.createActivityLog(activityId, {
        timestamp: now(),
        level: LogLevel.Error,
        message: 'Internal server error',
      });

      return await publisher.publishError(res, {
        error: DEFAULT_ERROR_MESSAGE,
        wsClientId,
        connectMethod,
        redirectUrl,
        branding,
        prefersDarkMode,
      });
    }
  }

  private async oauth1Request(
    res: Response,
    {
      connectToken,
      authSpec,
      scopes,
      integration,
      activityId,
      branding,
    }: {
      connectToken: ConnectToken;
      authSpec: OAuth1;
      scopes: string;
      integration: Integration;
      activityId: string | null;
      branding: Branding;
    }
  ) {
    const connectMethod = connectToken.connect_method || undefined;
    const wsClientId = connectToken.websocket_client_id || undefined;
    const redirectUrl = connectToken.redirect_url || undefined;
    const prefersDarkMode = connectToken.prefers_dark_mode || false;

    try {
      const callbackUrl = getOauthCallbackUrl();
      const callbackParams = new URLSearchParams({ state: connectToken.id });
      const oauth1CallbackURL = `${callbackUrl}?${callbackParams.toString()}`;

      const oauth1Client = new OAuth1Client({
        integration,
        specification: authSpec,
        scopes,
        callbackUrl: oauth1CallbackURL,
      });

      const requestToken = await oauth1Client.getOAuthRequestToken();
      const updatedConnectToken = await connectTokenService.updateConnectToken(connectToken.id, {
        request_token_secret: requestToken.request_token_secret,
        updated_at: now(),
      });

      if (!updatedConnectToken) {
        throw new Error('Failed to update connect token');
      }

      const redirectUrl = oauth1Client.getAuthorizationURL(requestToken);
      await activityService.createActivityLog(activityId, {
        timestamp: now(),
        level: LogLevel.Info,
        message: `Redirecting to ${integration.provider_key} OAuth authorization URL`,
        payload: { authorization_url: redirectUrl },
      });

      return res.redirect(redirectUrl);
    } catch (err) {
      await errorService.reportError(err);
      await activityService.createActivityLog(activityId, {
        timestamp: now(),
        level: LogLevel.Error,
        message: 'Internal server error',
      });

      return await publisher.publishError(res, {
        error: DEFAULT_ERROR_MESSAGE,
        wsClientId,
        connectMethod,
        redirectUrl,
        branding,
        prefersDarkMode,
      });
    }
  }

  public async callback(req: Request, res: Response) {
    const { state } = req.query;
    if (!state || typeof state !== 'string') {
      const err = new Error('Invalid state parameter received from OAuth callback');
      await errorService.reportError(err);

      return await publisher.publishError(res, {
        error: DEFAULT_ERROR_MESSAGE,
      });
    }

    const connectToken = await connectTokenService.getConnectTokenById(state);
    if (!connectToken) {
      const err = new Error('Failed to retrieve connect token from OAuth callback');
      await errorService.reportError(err);

      return await publisher.publishError(res, {
        error: DEFAULT_ERROR_MESSAGE,
      });
    }

    const connectMethod = connectToken.connect_method || undefined;
    const wsClientId = connectToken.websocket_client_id || undefined;
    const redirectUrl = connectToken.redirect_url || undefined;
    const prefersDarkMode = connectToken.prefers_dark_mode || false;

    const activityId = await activityService.findActivityIdByConnectToken(connectToken.id);
    const branding = await environmentService.getEnvironmentBranding(connectToken.environment_id);

    try {
      const integration = await integrationService.getIntegrationById(connectToken.integration_id);
      if (!integration) {
        throw new Error('Failed to retrieve integration');
      }

      const provider = await providerService.getProviderSpec(integration.provider_key);
      if (!provider) {
        throw new Error('Failed to retrieve provider specification');
      }

      const scopesArray = await this.getScopes(integration, provider);
      const authSpec = provider.auth.find((auth) => auth.scheme === integration.auth_scheme);
      if (!authSpec) {
        throw new Error('Provider auth configuration not found');
      }

      const scopes = scopesArray.join((authSpec as OAuth).scope_separator || ' ');
      await activityService.createActivityLog(activityId, {
        timestamp: now(),
        level: LogLevel.Info,
        message: `OAuth callback received from ${provider.name}`,
      });

      if (authSpec.scheme === AuthScheme.OAuth2) {
        return this.oauth2Callback(req, res, {
          connectToken,
          authSpec: authSpec as OAuth2,
          integration,
          activityId,
          branding,
        });
      } else if (authSpec.scheme === AuthScheme.OAuth1) {
        return this.oauth1Callback(req, res, {
          connectToken,
          authSpec: authSpec as OAuth1,
          scopes,
          integration,
          activityId,
          branding,
        });
      } else {
        throw new Error('Invalid auth scheme');
      }
    } catch (err) {
      await errorService.reportError(err);
      await activityService.createActivityLog(activityId, {
        timestamp: now(),
        level: LogLevel.Error,
        message: 'Internal server error',
      });

      return await publisher.publishError(res, {
        error: DEFAULT_ERROR_MESSAGE,
        wsClientId,
        connectMethod,
        redirectUrl,
        branding,
        prefersDarkMode,
      });
    }
  }

  public async oauth2Callback(
    req: Request,
    res: Response,
    {
      connectToken,
      authSpec,
      integration,
      activityId,
      branding,
    }: {
      connectToken: ConnectToken;
      authSpec: OAuth2;
      integration: Integration;
      activityId: string | null;
      branding: Branding;
    }
  ): Promise<void> {
    const { code } = req.query;
    const connectMethod = connectToken.connect_method || undefined;
    const wsClientId = connectToken.websocket_client_id || undefined;
    const redirectUrl = connectToken.redirect_url || undefined;
    const prefersDarkMode = connectToken.prefers_dark_mode || false;

    try {
      if (!code || typeof code !== 'string') {
        throw new Error('Invalid code parameter received from OAuth callback');
      }

      const callbackUrl = getOauthCallbackUrl();
      const callbackMetadata = this.getMetadataFromOAuthCallback(req.query, authSpec);

      const simpleOAuth2ClientConfig = getSimpleOAuth2ClientConfig(
        integration,
        authSpec,
        connectToken.configuration as Record<string, string>
      );

      const authorizationCode = new SimpleOAuth2.AuthorizationCode(simpleOAuth2ClientConfig);

      let tokenParams: Record<string, string> = {};
      if (authSpec.token_params !== undefined) {
        const clone = JSON.parse(JSON.stringify(authSpec.token_params));
        tokenParams = clone;
      }

      if (!authSpec.disable_pkce) {
        tokenParams['code_verifier'] = connectToken.code_verifier!;
      }

      const headers: Record<string, string> = {};
      const { oauth_client_id, oauth_client_secret } =
        integrationService.getIntegrationOauthCredentials(integration);
      if (authSpec.token_request_auth_method === 'basic') {
        headers['Authorization'] =
          'Basic ' + Buffer.from(oauth_client_id + ':' + oauth_client_secret).toString('base64');
      }

      const accessToken = await authorizationCode.getToken(
        { code: code, redirect_uri: callbackUrl, ...tokenParams },
        { headers }
      );

      const rawCredentials = accessToken.token;
      const parsedCredentials = parseRawCredentials(rawCredentials, AuthScheme.OAuth2);
      const tokenMetadata = this.getMetadataFromOAuthToken(rawCredentials, authSpec);
      const config =
        typeof connectToken.configuration === 'object' ? connectToken.configuration : {};

      const connectionType = await connectController.getConnectionTypeFromToken(
        connectToken.type,
        integration.provider_key
      );

      const response = await connectionService.upsertConnection({
        environment_id: connectToken.environment_id,
        id: connectToken.connection_id || generateId(Resource.Connection),
        display_name: connectToken.display_name || null,
        type: connectionType,
        auth_scheme: integration.auth_scheme,
        integration_id: integration.id,
        credentials: JSON.stringify(parsedCredentials),
        credentials_hash: null,
        credentials_iv: null,
        credentials_tag: null,
        configuration: { ...config, ...tokenMetadata, ...callbackMetadata },
        inclusions: connectToken.inclusions || null,
        exclusions: connectToken.exclusions || null,
        metadata: connectToken.metadata || null,
        created_at: now(),
        updated_at: now(),
        deleted_at: null,
      });

      if (!response) {
        throw new Error(`Failed to upsert connection`);
      }

      await activityService.updateActivity(activityId, {
        connection_id: response.connection.id,
      });

      await activityService.createActivityLog(activityId, {
        timestamp: now(),
        level: LogLevel.Info,
        message: `Connection ${response.action} with OAuth2 credentials`,
      });

      await connectTokenService.deleteConnectToken(connectToken.id);

      if (response.action === 'created') {
        connectionHook.connectionCreated({ connection: response.connection, activityId });
      } else if (response.action === 'updated') {
        connectionHook.connectionUpdated({ connection: response.connection, activityId });
      } else {
        throw new Error('Invalid action returned from connection upsert');
      }

      return await publisher.publishSuccess(res, {
        connectionId: response.connection.id,
        wsClientId,
        connectMethod,
        redirectUrl,
        branding,
        prefersDarkMode,
      });
    } catch (err) {
      await errorService.reportError(err);
      await activityService.createActivityLog(activityId, {
        timestamp: now(),
        level: LogLevel.Error,
        message: 'Internal server error',
      });

      return await publisher.publishError(res, {
        error: DEFAULT_ERROR_MESSAGE,
        wsClientId,
        connectMethod,
        redirectUrl,
        branding,
        prefersDarkMode,
      });
    }
  }

  public async oauth1Callback(
    req: Request,
    res: Response,
    {
      connectToken,
      authSpec,
      scopes,
      integration,
      activityId,
      branding,
    }: {
      connectToken: ConnectToken;
      authSpec: OAuth1;
      scopes: string;
      integration: Integration;
      activityId: string | null;
      branding: Branding;
    }
  ): Promise<void> {
    const { oauth_token, oauth_verifier } = req.query;
    const connectMethod = connectToken.connect_method || undefined;
    const wsClientId = connectToken.websocket_client_id || undefined;
    const redirectUrl = connectToken.redirect_url || undefined;
    const prefersDarkMode = connectToken.prefers_dark_mode || false;

    try {
      const callbackMetadata = this.getMetadataFromOAuthCallback(req.query, authSpec);
      if (
        !oauth_token ||
        !oauth_verifier ||
        typeof oauth_token !== 'string' ||
        typeof oauth_verifier !== 'string'
      ) {
        throw new Error('Invalid OAuth1 token/verifier');
      }

      const oauthTokenSecret = connectToken.request_token_secret!;
      const oauth1Client = new OAuth1Client({
        integration,
        specification: authSpec,
        callbackUrl: '',
        scopes,
      });

      const accessTokenResult = await oauth1Client.getOAuthAccessToken({
        oauthToken: oauth_token,
        tokenSecret: oauthTokenSecret,
        tokenVerifier: oauth_verifier,
      });

      const parsedCredentials = parseRawCredentials(accessTokenResult, AuthScheme.OAuth1);
      const config =
        typeof connectToken.configuration === 'object' ? connectToken.configuration : {};

      const connectionType = await connectController.getConnectionTypeFromToken(
        connectToken.type,
        integration.provider_key
      );

      const response = await connectionService.upsertConnection({
        environment_id: connectToken.environment_id,
        id: connectToken.connection_id || generateId(Resource.Connection),
        display_name: connectToken.display_name || null,
        type: connectionType,
        auth_scheme: integration.auth_scheme,
        integration_id: integration.id,
        credentials: JSON.stringify(parsedCredentials),
        credentials_hash: null,
        credentials_iv: null,
        credentials_tag: null,
        configuration: { ...config, ...callbackMetadata },
        inclusions: connectToken.inclusions || null,
        exclusions: connectToken.exclusions || null,
        metadata: connectToken.metadata || null,
        created_at: now(),
        updated_at: now(),
        deleted_at: null,
      });

      if (!response) {
        throw new Error(`Failed to upsert connection`);
      }

      await activityService.updateActivity(activityId, {
        connection_id: response.connection.id,
      });

      await activityService.createActivityLog(activityId, {
        timestamp: now(),
        level: LogLevel.Info,
        message: `Connection ${response.action} with OAuth1 credentials`,
      });

      await connectTokenService.deleteConnectToken(connectToken.id);

      if (response.action === 'created') {
        connectionHook.connectionCreated({ connection: response.connection, activityId });
      } else if (response.action === 'updated') {
        connectionHook.connectionUpdated({ connection: response.connection, activityId });
      } else {
        throw new Error('Invalid action returned from connection upsert');
      }

      return await publisher.publishSuccess(res, {
        connectionId: response.connection.id,
        wsClientId,
        connectMethod,
        redirectUrl,
        branding,
        prefersDarkMode,
      });
    } catch (err) {
      await errorService.reportError(err);
      await activityService.createActivityLog(activityId, {
        timestamp: now(),
        level: LogLevel.Error,
        message: 'Internal server error',
      });

      return await publisher.publishError(res, {
        error: DEFAULT_ERROR_MESSAGE,
        wsClientId,
        connectMethod,
        redirectUrl,
        branding,
        prefersDarkMode,
      });
    }
  }

  private getMetadataFromOAuthCallback(queryParams: any, specification: OAuth) {
    if (!queryParams || !specification.redirect_uri_metadata) {
      return {};
    }

    const whitelistedKeys = specification.redirect_uri_metadata;
    const arr = Object.entries(queryParams).filter(
      ([k, v]) => typeof v === 'string' && whitelistedKeys.includes(k)
    );

    return arr != null && arr.length > 0 ? (Object.fromEntries(arr) as Record<string, string>) : {};
  }

  private getMetadataFromOAuthToken(queryParams: any, specification: OAuth): Record<string, any> {
    if (!queryParams || !specification.token_response_metadata) {
      return {};
    }

    const whitelistedKeys = specification.token_response_metadata;
    const getValueFromDotNotation = (obj: any, key: string): any => {
      return key.split('.').reduce((o, k) => (o && o[k] !== undefined ? o[k] : undefined), obj);
    };

    const arr = Object.entries(queryParams).filter(([k, v]) => {
      const isStringValueOrBoolean = typeof v === 'string' || typeof v === 'boolean';
      if (isStringValueOrBoolean && whitelistedKeys.includes(k)) {
        return true;
      }

      const dotNotationValue = getValueFromDotNotation(queryParams, k);
      return isStringValueOrBoolean && whitelistedKeys.includes(dotNotationValue);
    });

    const dotNotationArr = whitelistedKeys
      .map((key) => {
        const value = getValueFromDotNotation(queryParams, key);
        const isStringValueOrBoolean = typeof value === 'string' || typeof value === 'boolean';
        return isStringValueOrBoolean ? [key, value] : null;
      })
      .filter(Boolean);

    const combinedArr: [string, any][] = [...arr, ...dotNotationArr].filter(
      (item) => item !== null
    ) as [string, any][];

    return combinedArr.length > 0 ? (Object.fromEntries(combinedArr) as Record<string, any>) : {};
  }

  private async getScopes(
    integration: Integration,
    providerSpec: ProviderSpecification
  ): Promise<string[]> {
    const scopes = new Set<string>();
    if (integration.oauth_scopes) {
      integration.oauth_scopes.split(',').forEach((scope) => scopes.add(scope));
    }

    if (providerSpec.collections) {
      const collections = await collectionService.listCollections(integration.id);
      const enabledKeys = collections?.filter((c) => c.is_enabled).map((c) => c.unique_key) || [];
      const allEnabledCollections = providerSpec.collections
        .filter((c) => enabledKeys.includes(c.unique_key))
        .map((c) => ({ ...c }));

      allEnabledCollections.forEach((c) => {
        c.required_scopes?.forEach((scope) => scopes.add(scope));
      });
    }

    if (providerSpec.actions) {
      const actions = await actionService.listActions(integration.id);
      const enabledKeys = actions?.filter((a) => a.is_enabled).map((a) => a.unique_key) || [];
      const allEnabledActions = providerSpec.actions
        .filter((a) => enabledKeys.includes(a.unique_key))
        .map((a) => ({ ...a }));

      allEnabledActions.forEach((a) => {
        a.required_scopes?.forEach((scope) => scopes.add(scope));
      });
    }

    const authConfig = providerSpec.auth.find((auth) => auth.scheme === integration.auth_scheme);
    if (
      authConfig &&
      (authConfig.scheme === AuthScheme.OAuth2 || authConfig.scheme === AuthScheme.OAuth1) &&
      authConfig.default_scopes
    ) {
      authConfig.default_scopes.forEach((scope) => scopes.add(scope));
    }

    return Array.from(scopes);
  }
}

export default new OAuthController();
