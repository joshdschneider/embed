import { AuthScheme, OAuth, OAuth1, OAuth2, ProviderSpecification } from '@embed/providers';
import type { Integration, LinkToken } from '@embed/shared';
import {
  Branding,
  DEFAULT_ERROR_MESSAGE,
  LogLevel,
  OAuth1Client,
  actionService,
  activityService,
  collectionService,
  environmentService,
  errorService,
  getSimpleOAuth2ClientConfig,
  integrationService,
  linkedAccountService,
  missesInterpolationParam,
  now,
  parseRawCredentials,
  providerService,
} from '@embed/shared';
import crypto from 'crypto';
import type { Request, Response } from 'express';
import SimpleOAuth2 from 'simple-oauth2';
import publisher from '../clients/publisher.client';
import linkedAccountHook from '../hooks/linkedAccount.hook';
import linkTokenService from '../services/linkToken.service';
import { extractConfigurationKeys, getOauthCallbackUrl } from '../utils/helpers';

class OAuthController {
  public async authorize(req: Request, res: Response) {
    const token = req.query['token'];
    if (!token || typeof token !== 'string') {
      return await publisher.publishError(res, {
        error: 'Link token missing',
      });
    }

    const linkToken = await linkTokenService.getLinkTokenById(token);
    if (!linkToken) {
      return await publisher.publishError(res, {
        error: 'Invalid link token',
      });
    }

    const linkMethod = linkToken.link_method || undefined;
    const wsClientId = linkToken.websocket_client_id || undefined;
    const redirectUrl = linkToken.redirect_url || undefined;
    const prefersDarkMode = linkToken.prefers_dark_mode || false;

    const activityId = await activityService.findActivityIdByLinkToken(linkToken.id);
    const branding = await environmentService.getEnvironmentBranding(linkToken.environment_id);

    try {
      if (linkToken.expires_at < now()) {
        const errorMessage = 'Link token expired';

        await activityService.createActivityLog(activityId, {
          timestamp: now(),
          level: LogLevel.Error,
          message: errorMessage,
        });

        return await publisher.publishError(res, {
          error: errorMessage,
          wsClientId,
          linkMethod,
          redirectUrl,
          branding,
          prefersDarkMode,
        });
      }

      const integration = await integrationService.getIntegrationByKey(
        linkToken.integration_key,
        linkToken.environment_id
      );

      if (!integration) {
        throw new Error('Failed to retrieve integration');
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
          linkMethod,
          redirectUrl,
          branding,
          prefersDarkMode,
        });
      }

      const provider = await providerService.getProviderSpec(integration.unique_key);
      if (!provider) {
        throw new Error('Failed to retrieve provider specification');
      }

      const scopesArray = await this.getScopes(integration, provider);
      const scopes = scopesArray.join((provider.auth as OAuth).scope_separator || ' ');

      const updatedLinkToken = await linkTokenService.updateLinkToken(linkToken.id, {
        code_verifier: crypto.randomBytes(24).toString('hex'),
        updated_at: now(),
      });

      if (!updatedLinkToken) {
        throw new Error('Failed to update link token');
      }

      await activityService.createActivityLog(activityId, {
        timestamp: now(),
        level: LogLevel.Info,
        message: `Initiating OAuth authorization flow for ${provider.name}`,
      });

      if (provider.auth.scheme === AuthScheme.OAuth2) {
        return this.oauth2Request(res, {
          authSpec: provider.auth as OAuth2,
          scopes,
          integration,
          linkToken: updatedLinkToken,
          activityId,
          branding,
        });
      } else if (provider.auth.scheme === AuthScheme.OAuth1) {
        return this.oauth1Request(res, {
          authSpec: provider.auth as OAuth1,
          scopes,
          integration,
          linkToken: updatedLinkToken,
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
        linkMethod,
        redirectUrl,
        branding,
        prefersDarkMode,
      });
    }
  }

  private async oauth2Request(
    res: Response,
    {
      linkToken,
      authSpec,
      scopes,
      integration,
      activityId,
      branding,
    }: {
      linkToken: LinkToken;
      authSpec: OAuth2;
      scopes: string;
      integration: Integration;
      activityId: string | null;
      branding: Branding;
    }
  ) {
    const linkMethod = linkToken.link_method || undefined;
    const wsClientId = linkToken.websocket_client_id || undefined;
    const redirectUrl = linkToken.redirect_url || undefined;
    const prefersDarkMode = linkToken.prefers_dark_mode || false;

    try {
      if (integration.has_oauth_credentials) {
        if (integration.oauth_client_id == null || integration.oauth_client_secret == null) {
          const errorMessage = `OAuth credentials missing for ${integration.unique_key}`;

          await activityService.createActivityLog(activityId, {
            timestamp: now(),
            level: LogLevel.Error,
            message: errorMessage,
          });

          return await publisher.publishError(res, {
            error: errorMessage,
            wsClientId,
            linkMethod,
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
          !linkToken.configuration ||
          missesInterpolationParam(
            authSpec.authorization_url,
            linkToken.configuration as Record<string, string>
          ) ||
          missesInterpolationParam(
            authSpec.token_url,
            linkToken.configuration as Record<string, string>
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
              configuration: linkToken.configuration,
            },
          });

          return await publisher.publishError(res, {
            error: errorMessage,
            wsClientId,
            linkMethod,
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
            .update(linkToken.code_verifier!)
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
          linkToken.configuration as Record<string, string>
        );

        const authorizationCode = new SimpleOAuth2.AuthorizationCode(simpleOAuth2ClientConfig);

        const authorizationUri = authorizationCode.authorizeURL({
          redirect_uri: callbackUrl,
          scope: scopes,
          state: linkToken.id,
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
        linkMethod,
        redirectUrl,
        branding,
        prefersDarkMode,
      });
    }
  }

  private async oauth1Request(
    res: Response,
    {
      linkToken,
      authSpec,
      scopes,
      integration,
      activityId,
      branding,
    }: {
      linkToken: LinkToken;
      authSpec: OAuth1;
      scopes: string;
      integration: Integration;
      activityId: string | null;
      branding: Branding;
    }
  ) {
    const linkMethod = linkToken.link_method || undefined;
    const wsClientId = linkToken.websocket_client_id || undefined;
    const redirectUrl = linkToken.redirect_url || undefined;
    const prefersDarkMode = linkToken.prefers_dark_mode || false;

    try {
      const callbackUrl = getOauthCallbackUrl();
      const callbackParams = new URLSearchParams({ state: linkToken.id });
      const oauth1CallbackURL = `${callbackUrl}?${callbackParams.toString()}`;

      const oauth1Client = new OAuth1Client({
        integration,
        specification: authSpec,
        scopes,
        callbackUrl: oauth1CallbackURL,
      });

      const requestToken = await oauth1Client.getOAuthRequestToken();

      const updatedLinkToken = await linkTokenService.updateLinkToken(linkToken.id, {
        request_token_secret: requestToken.request_token_secret,
        updated_at: now(),
      });

      if (!updatedLinkToken) {
        throw new Error('Failed to update link token');
      }

      const redirectUrl = oauth1Client.getAuthorizationURL(requestToken);

      await activityService.createActivityLog(activityId, {
        timestamp: now(),
        level: LogLevel.Info,
        message: `Redirecting to ${integration.unique_key} OAuth authorization URL`,
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
        linkMethod,
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

    const linkToken = await linkTokenService.getLinkTokenById(state);

    if (!linkToken) {
      const err = new Error('Failed to retrieve link token from OAuth callback');
      await errorService.reportError(err);

      return await publisher.publishError(res, {
        error: DEFAULT_ERROR_MESSAGE,
      });
    }

    const linkMethod = linkToken.link_method || undefined;
    const wsClientId = linkToken.websocket_client_id || undefined;
    const redirectUrl = linkToken.redirect_url || undefined;
    const prefersDarkMode = linkToken.prefers_dark_mode || false;

    const activityId = await activityService.findActivityIdByLinkToken(linkToken.id);
    const branding = await environmentService.getEnvironmentBranding(linkToken.environment_id);

    try {
      if (!linkToken.integration_key) {
        throw new Error('Integration provider missing from link token');
      }

      const integration = await integrationService.getIntegrationByKey(
        linkToken.integration_key,
        linkToken.environment_id
      );

      if (!integration) {
        throw new Error('Failed to retrieve integration');
      }

      const provider = await providerService.getProviderSpec(linkToken.integration_key);
      if (!provider) {
        throw new Error('Failed to retrieve provider specification');
      }

      const scopesArray = await this.getScopes(integration, provider);
      const scopes = scopesArray.join((provider.auth as OAuth).scope_separator || ' ');

      await activityService.createActivityLog(activityId, {
        timestamp: now(),
        level: LogLevel.Info,
        message: `OAuth callback received from ${provider.name}`,
      });

      const authSpec = provider.auth;
      if (authSpec.scheme === AuthScheme.OAuth2) {
        return this.oauth2Callback(req, res, {
          linkToken,
          authSpec: authSpec as OAuth2,
          integration,
          activityId,
          branding,
        });
      } else if (authSpec.scheme === AuthScheme.OAuth1) {
        return this.oauth1Callback(req, res, {
          linkToken,
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
        linkMethod,
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
      linkToken,
      authSpec,
      integration,
      activityId,
      branding,
    }: {
      linkToken: LinkToken;
      authSpec: OAuth2;
      integration: Integration;
      activityId: string | null;
      branding: Branding;
    }
  ): Promise<void> {
    const { code } = req.query;
    const linkMethod = linkToken.link_method || undefined;
    const wsClientId = linkToken.websocket_client_id || undefined;
    const redirectUrl = linkToken.redirect_url || undefined;
    const prefersDarkMode = linkToken.prefers_dark_mode || false;

    try {
      if (!code || typeof code !== 'string') {
        throw new Error('Invalid code parameter received from OAuth callback');
      }

      const callbackUrl = getOauthCallbackUrl();
      const callbackMetadata = this.getMetadataFromOAuthCallback(req.query, authSpec);

      const simpleOAuth2ClientConfig = getSimpleOAuth2ClientConfig(
        integration,
        authSpec,
        linkToken.configuration as Record<string, string>
      );

      const authorizationCode = new SimpleOAuth2.AuthorizationCode(simpleOAuth2ClientConfig);

      let tokenParams: Record<string, string> = {};
      if (authSpec.token_params !== undefined) {
        const clone = JSON.parse(JSON.stringify(authSpec.token_params));
        tokenParams = clone;
      }

      if (!authSpec.disable_pkce) {
        tokenParams['code_verifier'] = linkToken.code_verifier!;
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
      const config = typeof linkToken.configuration === 'object' ? linkToken.configuration : {};
      const linkedAccountId =
        linkToken.linked_account_id || linkedAccountService.generateId(integration.unique_key);

      const response = await linkedAccountService.upsertLinkedAccount({
        id: linkedAccountId,
        environment_id: linkToken.environment_id,
        integration_key: integration.unique_key,
        configuration: { ...config, ...tokenMetadata, ...callbackMetadata },
        credentials: JSON.stringify(parsedCredentials),
        credentials_iv: null,
        credentials_tag: null,
        metadata: null,
        created_at: now(),
        updated_at: now(),
        deleted_at: null,
      });

      if (!response) {
        throw new Error(`Failed to upsert linked account for link token ${linkToken.id}`);
      }

      await activityService.updateActivity(activityId, {
        linked_account_id: response.linkedAccount.id,
      });

      await activityService.createActivityLog(activityId, {
        timestamp: now(),
        level: LogLevel.Info,
        message: `Linked account ${response.action} with OAuth2 credentials`,
      });

      await linkTokenService.deleteLinkToken(linkToken.id);

      if (response.action === 'created') {
        linkedAccountHook.linkedAccountCreated({
          environmentId: linkToken.environment_id,
          linkedAccount: response.linkedAccount,
          activityId,
        });
      } else if (response.action === 'updated') {
        linkedAccountHook.linkedAccountUpdated({
          environmentId: linkToken.environment_id,
          linkedAccount: response.linkedAccount,
          activityId,
        });
      } else {
        throw new Error('Invalid action returned from linked account upsert');
      }

      return await publisher.publishSuccess(res, {
        linkedAccountId: response.linkedAccount.id,
        wsClientId,
        linkMethod,
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
        linkMethod,
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
      linkToken,
      authSpec,
      scopes,
      integration,
      activityId,
      branding,
    }: {
      linkToken: LinkToken;
      authSpec: OAuth1;
      scopes: string;
      integration: Integration;
      activityId: string | null;
      branding: Branding;
    }
  ): Promise<void> {
    const { oauth_token, oauth_verifier } = req.query;
    const linkMethod = linkToken.link_method || undefined;
    const wsClientId = linkToken.websocket_client_id || undefined;
    const redirectUrl = linkToken.redirect_url || undefined;
    const prefersDarkMode = linkToken.prefers_dark_mode || false;

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

      const oauthTokenSecret = linkToken.request_token_secret!;
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
      const config = typeof linkToken.configuration === 'object' ? linkToken.configuration : {};
      const linkedAccountId =
        linkToken.linked_account_id || linkedAccountService.generateId(integration.unique_key);

      const response = await linkedAccountService.upsertLinkedAccount({
        id: linkedAccountId,
        environment_id: linkToken.environment_id,
        integration_key: integration.unique_key,
        configuration: { ...config, ...callbackMetadata },
        credentials: JSON.stringify(parsedCredentials),
        credentials_iv: null,
        credentials_tag: null,
        metadata: null,
        created_at: now(),
        updated_at: now(),
        deleted_at: null,
      });

      if (!response) {
        throw new Error(`Failed to upsert linked account for link token ${linkToken.id}`);
      }

      await activityService.updateActivity(activityId, {
        linked_account_id: response.linkedAccount.id,
      });

      await activityService.createActivityLog(activityId, {
        timestamp: now(),
        level: LogLevel.Info,
        message: `Linked account ${response.action} with OAuth1 credentials`,
      });

      await linkTokenService.deleteLinkToken(linkToken.id);

      if (response.action === 'created') {
        linkedAccountHook.linkedAccountCreated({
          environmentId: linkToken.environment_id,
          linkedAccount: response.linkedAccount,
          activityId,
        });
      } else if (response.action === 'updated') {
        linkedAccountHook.linkedAccountUpdated({
          environmentId: linkToken.environment_id,
          linkedAccount: response.linkedAccount,
          activityId,
        });
      } else {
        throw new Error('Invalid action returned from linked account upsert');
      }

      return await publisher.publishSuccess(res, {
        linkedAccountId: response.linkedAccount.id,
        wsClientId,
        linkMethod,
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
        linkMethod,
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
    if (integration.additional_scopes) {
      integration.additional_scopes.split(',').forEach((scope) => scopes.add(scope));
    }

    if (providerSpec.collections) {
      const collections = await collectionService.listCollections(
        integration.unique_key,
        integration.environment_id
      );

      const enabledKeys = collections?.filter((c) => c.is_enabled).map((c) => c.unique_key) || [];
      const allEnabledCollections = Object.entries(providerSpec.collections)
        .filter(([k, v]) => enabledKeys.includes(k))
        .map(([k, v]) => ({ ...v }));

      allEnabledCollections.forEach((c) => {
        c.required_scopes?.forEach((scope) => scopes.add(scope));
      });
    }

    if (providerSpec.actions) {
      const actions = await actionService.listActions(
        integration.unique_key,
        integration.environment_id
      );

      const enabledKeys = actions?.filter((a) => a.is_enabled).map((a) => a.unique_key) || [];
      const allEnabledActions = Object.entries(providerSpec.actions)
        .filter(([k, v]) => enabledKeys.includes(k))
        .map(([k, v]) => ({ ...v }));

      allEnabledActions.forEach((a) => {
        a.required_scopes?.forEach((scope) => scopes.add(scope));
      });
    }

    if (
      providerSpec.auth.scheme === AuthScheme.OAuth2 ||
      providerSpec.auth.scheme === AuthScheme.OAuth1
    ) {
      providerSpec.auth.default_scopes?.forEach((scope) => scopes.add(scope));
    }

    return Array.from(scopes);
  }
}

export default new OAuthController();
