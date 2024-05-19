import { AuthScheme, OAuth1, OAuth2 } from '@embed/providers';
import {
  DEFAULT_ERROR_MESSAGE,
  LogLevel,
  Resource,
  activityService,
  collectionService,
  connectionService,
  environmentService,
  errorService,
  generateId,
  getServerUrl,
  integrationService,
  now,
  providerService,
} from '@embed/shared';
import type { Request, Response } from 'express';
import publisher from '../clients/publisher.client';
import connectionHook from '../hooks/connection.hook';
import sessionTokenService from '../services/sessionToken.service';
import { PROVIDERS_THAT_SUPPORT_FILE_PICKER } from '../utils/constants';
import {
  appendParamsToUrl,
  extractConfigurationKeys,
  formatKeyToReadableText,
} from '../utils/helpers';
import { ApiKeyTemplateData, BasicTemplateData, ConfigTemplateData } from '../utils/types';

class SessionController {
  public async routeView(req: Request, res: Response) {
    const token = req.params['token'];
    let connectMethod = req.query['connect_method'] as string | undefined;
    let wsClientId = req.query['ws_client_id'] as string | undefined;
    let redirectUrl = req.query['redirect_url'] as string | undefined;
    let prefersDarkMode = req.query['prefers_dark_mode'] === 'true';
    res.setHeader('Content-Security-Policy', '');

    if (!token) {
      return await publisher.publishError(res, {
        error: 'Session token missing',
        connectMethod,
        wsClientId,
        redirectUrl,
        prefersDarkMode,
      });
    }

    const sessionToken = await sessionTokenService.getSessionTokenById(token);
    if (!sessionToken) {
      return await publisher.publishError(res, {
        error: 'Invalid session token',
        wsClientId,
        connectMethod,
        redirectUrl,
        prefersDarkMode,
      });
    }

    if (connectMethod || wsClientId || redirectUrl || prefersDarkMode) {
      const updatedSessionToken = await sessionTokenService.updateSessionToken(sessionToken.id, {
        connect_method: connectMethod,
        websocket_client_id: wsClientId,
        redirect_url: redirectUrl,
        prefers_dark_mode: prefersDarkMode,
      });

      if (updatedSessionToken) {
        connectMethod = updatedSessionToken.connect_method || undefined;
        wsClientId = updatedSessionToken.websocket_client_id || undefined;
        redirectUrl = updatedSessionToken.redirect_url || undefined;
        prefersDarkMode = updatedSessionToken.prefers_dark_mode || false;
      }
    }

    const activityId = await activityService.findActivityIdBySessionToken(sessionToken.id);
    const branding = await environmentService.getEnvironmentBranding(sessionToken.environment_id);

    try {
      if (sessionToken.expires_at < now()) {
        const errorMessage = 'Session token expired';
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

      const integration = await integrationService.getIntegrationById(sessionToken.integration_id);
      if (!integration) {
        throw new Error(`Failed to retrieve integration with ID ${sessionToken.integration_id}`);
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

      const serverUrl = getServerUrl();
      if (!serverUrl) {
        throw new Error('SERVER_URL is undefined');
      }

      const authScheme = sessionToken.auth_scheme;
      const baseUrl = `${serverUrl}/session/${token}`;

      switch (authScheme) {
        case AuthScheme.OAuth1:
        case AuthScheme.OAuth2:
          const oauthUrl = `${baseUrl}/oauth`;
          await activityService.createActivityLog(activityId, {
            timestamp: now(),
            level: LogLevel.Info,
            message: `Redirecting to OAuth flow`,
          });

          return res.redirect(oauthUrl);
        case AuthScheme.ApiKey:
          const apiKeyUrl = `${baseUrl}/api-key`;
          await activityService.createActivityLog(activityId, {
            timestamp: now(),
            level: LogLevel.Info,
            message: `Redirecting to API key auth`,
          });

          return res.redirect(apiKeyUrl);
        case AuthScheme.Basic:
          const basicUrl = `${baseUrl}/basic`;
          await activityService.createActivityLog(activityId, {
            timestamp: now(),
            level: LogLevel.Info,
            message: `Redirecting to basic auth`,
          });

          return res.redirect(basicUrl);
        case AuthScheme.None:
          await activityService.createActivityLog(activityId, {
            timestamp: now(),
            level: LogLevel.Info,
            message: `Upserting connection without credentials`,
          });

          const response = await connectionService.upsertConnection({
            environment_id: sessionToken.environment_id,
            id: sessionToken.connection_id || generateId(Resource.Connection),
            display_name: sessionToken.display_name || null,
            auth_scheme: AuthScheme.None,
            integration_id: integration.id,
            credentials: JSON.stringify({ type: AuthScheme.None }),
            credentials_hash: null,
            credentials_iv: null,
            credentials_tag: null,
            configuration: sessionToken.configuration || null,
            inclusions: sessionToken.inclusions || null,
            exclusions: sessionToken.exclusions || null,
            metadata: sessionToken.metadata || null,
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
            message: `Connection ${response.action} without credentials`,
          });

          await sessionTokenService.deleteSessionToken(sessionToken.id);

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
        default:
          throw new Error(
            `Unsupported auth scheme ${authScheme} for provider ${integration.provider_key}`
          );
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

  public async oauthView(req: Request, res: Response) {
    const token = req.params['token'];
    if (!token) {
      return await publisher.publishError(res, {
        error: 'Session token missing',
      });
    }

    const sessionToken = await sessionTokenService.getSessionTokenById(token);
    if (!sessionToken) {
      return await publisher.publishError(res, {
        error: 'Invalid session token',
      });
    }

    const connectMethod = sessionToken.connect_method || undefined;
    const wsClientId = sessionToken.websocket_client_id || undefined;
    const redirectUrl = sessionToken.redirect_url || undefined;
    const prefersDarkMode = sessionToken.prefers_dark_mode || false;

    const activityId = await activityService.findActivityIdBySessionToken(sessionToken.id);
    const branding = await environmentService.getEnvironmentBranding(sessionToken.environment_id);

    try {
      if (sessionToken.expires_at < now()) {
        const errorMessage = 'Session token expired';
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

      const serverUrl = getServerUrl();
      if (!serverUrl) {
        throw new Error('SERVER_URL is undefined');
      }

      const integration = await integrationService.getIntegrationById(sessionToken.integration_id);
      if (!integration) {
        throw new Error(`Failed to retrieve integration with ID ${sessionToken.integration_id}`);
      }

      if (
        !integration.auth_schemes.includes(AuthScheme.OAuth2) &&
        !integration.auth_schemes.includes(AuthScheme.OAuth1)
      ) {
        throw new Error(`Invalid auth scheme for integration ${integration.id}`);
      }

      const providerSpec = await providerService.getProviderSpec(integration.provider_key);
      if (!providerSpec) {
        throw new Error(`Provider specification not found for ${integration.provider_key}`);
      }

      const authSpec = providerSpec.auth.find((auth) => auth.scheme === sessionToken.auth_scheme);
      if (!authSpec) {
        throw new Error(
          `Auth scheme ${sessionToken.auth_scheme} not found in provider specification`
        );
      }

      const auth = authSpec as OAuth1 | OAuth2;
      const authorizationUrlKeys = extractConfigurationKeys(auth.authorization_url);
      const tokenUrlKeys = extractConfigurationKeys(auth.token_url);
      const keys = [...new Set([...authorizationUrlKeys, ...tokenUrlKeys])];

      if (keys.length > 0) {
        await activityService.createActivityLog(activityId, {
          timestamp: now(),
          level: LogLevel.Info,
          message: `Collecting required fields for ${providerSpec.name} OAuth from user`,
          payload: { configuration_fields: keys },
        });

        const data: ConfigTemplateData = {
          server_url: serverUrl,
          session_token: token,
          integration: {
            provider_key: integration.provider_key,
            name: providerSpec.name,
            logo_url: providerSpec.logo_url,
            logo_url_dark_mode: providerSpec.logo_url_dark_mode,
          },
          configuration_fields: keys.map((key) => ({
            name: key,
            label: formatKeyToReadableText(key),
            help_link: undefined,
          })),
          branding,
          prefers_dark_mode: prefersDarkMode,
        };

        return res.render('config', data);
      }

      const oauthUrl = appendParamsToUrl(`${serverUrl}/oauth/authorize`, {
        token: token,
      });

      res.redirect(oauthUrl);
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

  public async upsertOauthConfig(req: Request, res: Response) {
    const token = req.params['token'];
    const config = req.body;

    if (!token) {
      return await publisher.publishError(res, {
        error: 'Session token missing',
      });
    }

    const sessionToken = await sessionTokenService.getSessionTokenById(token);
    if (!sessionToken) {
      return await publisher.publishError(res, {
        error: 'Invalid session token',
      });
    }

    const connectMethod = sessionToken.connect_method || undefined;
    const wsClientId = sessionToken.websocket_client_id || undefined;
    const redirectUrl = sessionToken.redirect_url || undefined;
    const prefersDarkMode = sessionToken.prefers_dark_mode || false;

    const activityId = await activityService.findActivityIdBySessionToken(sessionToken.id);
    const branding = await environmentService.getEnvironmentBranding(sessionToken.environment_id);

    try {
      if (!config || typeof config !== 'object') {
        const errorMessage = 'Configuration missing or invalid';
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

      if (sessionToken.expires_at < now()) {
        const errorMessage = 'Session token expired';
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

      const serverUrl = getServerUrl();
      if (!serverUrl) {
        throw new Error('SERVER_URL is undefined');
      }

      const updatedSessionToken = await sessionTokenService.updateSessionToken(sessionToken.id, {
        configuration: config,
      });

      if (!updatedSessionToken) {
        throw new Error(`Failed to update session token ${sessionToken.id}`);
      }

      await activityService.createActivityLog(activityId, {
        timestamp: now(),
        level: LogLevel.Info,
        message: 'Configuration received from user',
        payload: { configuration: config },
      });

      const oauthUrl = appendParamsToUrl(`${serverUrl}/oauth/authorize`, {
        token: token,
      });

      res.redirect(oauthUrl);
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

  public async apiKeyAuthView(req: Request, res: Response) {
    const nonce = res.locals['nonce'];
    const token = req.params['token'];

    if (!token) {
      return await publisher.publishError(res, {
        error: 'Session token missing',
      });
    }

    const sessionToken = await sessionTokenService.getSessionTokenById(token);
    if (!sessionToken) {
      return await publisher.publishError(res, {
        error: 'Invalid session token',
      });
    }

    const connectMethod = sessionToken.connect_method || undefined;
    const wsClientId = sessionToken.websocket_client_id || undefined;
    const redirectUrl = sessionToken.redirect_url || undefined;
    const prefersDarkMode = sessionToken.prefers_dark_mode || false;

    const activityId = await activityService.findActivityIdBySessionToken(sessionToken.id);
    const branding = await environmentService.getEnvironmentBranding(sessionToken.environment_id);

    try {
      if (sessionToken.expires_at < now()) {
        const errorMessage = 'Session token expired';
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

      const serverUrl = getServerUrl();
      if (!serverUrl) {
        throw new Error('SERVER_URL is undefined');
      }

      const integration = await integrationService.getIntegrationById(sessionToken.integration_id);
      if (!integration) {
        throw new Error(`Failed to retrieve integration with ID ${sessionToken.integration_id}`);
      } else if (!integration.auth_schemes.includes(AuthScheme.ApiKey)) {
        throw new Error(`Invalid auth scheme for integration ${integration.id}`);
      }

      const providerSpec = await providerService.getProviderSpec(integration.provider_key);
      if (!providerSpec) {
        throw new Error(`Provider specification not found for ${integration.provider_key}`);
      }

      const apiKeyAuth = providerSpec.auth.find((auth) => auth.scheme === AuthScheme.ApiKey) as {
        scheme: AuthScheme.ApiKey;
        help_link: string | undefined;
      };

      await activityService.createActivityLog(activityId, {
        timestamp: now(),
        level: LogLevel.Info,
        message: `User viewed API key input screen`,
      });

      const data: ApiKeyTemplateData = {
        server_url: serverUrl,
        session_token: token,
        integration: {
          provider_key: integration.provider_key,
          name: providerSpec.name,
          logo_url: providerSpec.logo_url,
          logo_url_dark_mode: providerSpec.logo_url_dark_mode,
          help_link: apiKeyAuth.help_link,
        },
        branding,
        prefers_dark_mode: prefersDarkMode,
        nonce,
      };

      res.render('api-key', data);
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

  public async upsertApiKey(req: Request, res: Response) {
    const token = req.params['token'];
    const apiKey = req.body['key'];

    if (!token) {
      return await publisher.publishError(res, {
        error: 'Session token missing',
      });
    }

    const sessionToken = await sessionTokenService.getSessionTokenById(token);
    if (!sessionToken) {
      return await publisher.publishError(res, {
        error: 'Invalid session token',
      });
    }

    const connectMethod = sessionToken.connect_method || undefined;
    const wsClientId = sessionToken.websocket_client_id || undefined;
    const redirectUrl = sessionToken.redirect_url || undefined;
    const prefersDarkMode = sessionToken.prefers_dark_mode || false;

    const activityId = await activityService.findActivityIdBySessionToken(sessionToken.id);
    const branding = await environmentService.getEnvironmentBranding(sessionToken.environment_id);

    try {
      if (!apiKey || typeof apiKey !== 'string') {
        const errorMessage = 'API key missing or invalid';
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

      if (sessionToken.expires_at < now()) {
        const errorMessage = 'Session token expired';
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

      const integration = await integrationService.getIntegrationById(sessionToken.integration_id);
      if (!integration) {
        throw new Error(`Failed to retrieve integration with ID ${sessionToken.integration_id}`);
      } else if (!integration.auth_schemes.includes(AuthScheme.ApiKey)) {
        throw new Error(`Invalid auth scheme for integration ${integration.id}`);
      }

      const response = await connectionService.upsertConnection({
        environment_id: sessionToken.environment_id,
        id: sessionToken.connection_id || generateId(Resource.Connection),
        display_name: sessionToken.display_name || null,
        auth_scheme: sessionToken.auth_scheme,
        integration_id: integration.id,
        credentials: JSON.stringify({ type: AuthScheme.ApiKey, apiKey }),
        credentials_hash: null,
        credentials_iv: null,
        credentials_tag: null,
        configuration: sessionToken.configuration || null,
        inclusions: sessionToken.inclusions || null,
        exclusions: sessionToken.exclusions || null,
        metadata: sessionToken.metadata || null,
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
        message: `Connection ${response.action} with API key credentials`,
      });

      const shouldUseFilePicker = await this.shouldUseFilePicker(
        integration.id,
        integration.provider_key
      );

      if (shouldUseFilePicker) {
        const serverUrl = getServerUrl();
        if (serverUrl) {
          const redirectUrl = `${serverUrl}/file-picker/${sessionToken.id}/files`;
          return res.redirect(
            `${redirectUrl}?connection_id=${response.connection.id}&action=${response.action}`
          );
        }
      }

      await sessionTokenService.deleteSessionToken(sessionToken.id);

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

  public async basicAuthView(req: Request, res: Response) {
    const nonce = res.locals['nonce'];
    const token = req.params['token'];
    if (!token) {
      return await publisher.publishError(res, {
        error: 'Session token missing',
      });
    }

    const sessionToken = await sessionTokenService.getSessionTokenById(token);
    if (!sessionToken) {
      return await publisher.publishError(res, {
        error: 'Invalid session token',
      });
    }

    const connectMethod = sessionToken.connect_method || undefined;
    const wsClientId = sessionToken.websocket_client_id || undefined;
    const redirectUrl = sessionToken.redirect_url || undefined;
    const prefersDarkMode = sessionToken.prefers_dark_mode || false;

    const activityId = await activityService.findActivityIdBySessionToken(sessionToken.id);
    const branding = await environmentService.getEnvironmentBranding(sessionToken.environment_id);

    try {
      if (sessionToken.expires_at < now()) {
        const errorMessage = 'Session token expired';
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

      const serverUrl = getServerUrl();
      if (!serverUrl) {
        throw new Error('SERVER_URL is undefined');
      }

      const integration = await integrationService.getIntegrationById(sessionToken.integration_id);
      if (!integration) {
        throw new Error(`Failed to retrieve integration with ID ${sessionToken.integration_id}`);
      } else if (!integration.auth_schemes.includes(AuthScheme.Basic)) {
        throw new Error(`Invalid auth scheme for integration ${integration.id}`);
      }

      const providerSpec = await providerService.getProviderSpec(integration.provider_key);
      if (!providerSpec) {
        throw new Error(`Provider specification not found for ${integration.provider_key}`);
      }

      const basicAuth = providerSpec.auth.find((auth) => auth.scheme === AuthScheme.Basic) as {
        scheme: AuthScheme.Basic;
        help_link: string | undefined;
      };

      await activityService.createActivityLog(activityId, {
        timestamp: now(),
        level: LogLevel.Info,
        message: `User viewed username/password input screen`,
      });

      const data: BasicTemplateData = {
        server_url: serverUrl,
        session_token: token,
        integration: {
          provider_key: integration.provider_key,
          name: providerSpec.name,
          logo_url: providerSpec.logo_url,
          logo_url_dark_mode: providerSpec.logo_url_dark_mode,
          help_link: basicAuth.help_link,
        },
        branding,
        prefers_dark_mode: prefersDarkMode,
        nonce,
      };

      res.render('basic', data);
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

  public async upsertBasic(req: Request, res: Response) {
    const token = req.params['token'];
    const username = req.body['username'];
    const password = req.body['password'];

    if (!token) {
      return await publisher.publishError(res, {
        error: 'Session token missing',
      });
    }

    const sessionToken = await sessionTokenService.getSessionTokenById(token);
    if (!sessionToken) {
      return await publisher.publishError(res, {
        error: 'Invalid session token',
      });
    }

    const connectMethod = sessionToken.connect_method || undefined;
    const wsClientId = sessionToken.websocket_client_id || undefined;
    const redirectUrl = sessionToken.redirect_url || undefined;
    const prefersDarkMode = sessionToken.prefers_dark_mode || false;

    const activityId = await activityService.findActivityIdBySessionToken(sessionToken.id);
    const branding = await environmentService.getEnvironmentBranding(sessionToken.environment_id);

    try {
      if (!username || typeof username !== 'string') {
        const errorMessage = 'Username missing or invalid';
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

      if (!password || typeof password !== 'string') {
        const errorMessage = 'Password missing or invalid';
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

      if (sessionToken.expires_at < now()) {
        const errorMessage = 'Session token expired';
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

      const integration = await integrationService.getIntegrationById(sessionToken.integration_id);
      if (!integration) {
        throw new Error(`Failed to retrieve integration with ID ${sessionToken.integration_id}`);
      } else if (!integration.auth_schemes.includes(AuthScheme.Basic)) {
        throw new Error(`Invalid auth scheme for integration ${integration.id}`);
      }

      const response = await connectionService.upsertConnection({
        environment_id: sessionToken.environment_id,
        id: sessionToken.connection_id || generateId(Resource.Connection),
        display_name: sessionToken.display_name || null,
        auth_scheme: sessionToken.auth_scheme,
        integration_id: integration.id,
        credentials: JSON.stringify({ type: AuthScheme.Basic, username, password }),
        credentials_hash: null,
        credentials_iv: null,
        credentials_tag: null,
        configuration: sessionToken.configuration || null,
        inclusions: sessionToken.inclusions || null,
        exclusions: sessionToken.exclusions || null,
        metadata: sessionToken.metadata || null,
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
        message: `Connection ${response.action} with basic credentials`,
      });

      const shouldUseFilePicker = await this.shouldUseFilePicker(
        integration.id,
        integration.provider_key
      );

      if (shouldUseFilePicker) {
        const serverUrl = getServerUrl();
        if (serverUrl) {
          const redirectUrl = `${serverUrl}/file-picker/${sessionToken.id}/files`;
          return res.redirect(
            `${redirectUrl}?connection_id=${response.connection.id}&action=${response.action}`
          );
        }
      }

      await sessionTokenService.deleteSessionToken(sessionToken.id);

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

  public async shouldUseFilePicker(integrationId: string, providerKey: string): Promise<boolean> {
    try {
      if (PROVIDERS_THAT_SUPPORT_FILE_PICKER.includes(providerKey)) {
        const filesCollection = await collectionService.retrieveCollection('files', integrationId);
        const filesConfig = filesCollection?.configuration as
          | { use_file_picker: boolean }
          | undefined;
        return filesConfig?.use_file_picker || false;
      } else {
        return false;
      }
    } catch (err) {
      await errorService.reportError(err);
      return false;
    }
  }
}

export default new SessionController();
