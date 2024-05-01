import { AuthScheme, OAuth1, OAuth2 } from '@embed/providers';
import {
  DEFAULT_ERROR_MESSAGE,
  LogLevel,
  Resource,
  activityService,
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
import connectTokenService from '../services/connectToken.service';
import {
  appendParamsToUrl,
  extractConfigurationKeys,
  formatKeyToReadableText,
} from '../utils/helpers';
import {
  ApiKeyTemplateData,
  BasicTemplateData,
  ConfigTemplateData,
  ConnectionType,
  ServiceAccountTemplateData,
} from '../utils/types';

class ConnectController {
  public async routeView(req: Request, res: Response) {
    const token = req.params['token'];
    let connectMethod = req.query['connect_method'] as string | undefined;
    let wsClientId = req.query['ws_client_id'] as string | undefined;
    let redirectUrl = req.query['redirect_url'] as string | undefined;
    let prefersDarkMode = req.query['prefers_dark_mode'] === 'true';
    res.setHeader('Content-Security-Policy', '');

    if (!token) {
      return await publisher.publishError(res, {
        error: 'Connect token missing',
        connectMethod,
        wsClientId,
        redirectUrl,
        prefersDarkMode,
      });
    }

    const connectToken = await connectTokenService.getConnectTokenById(token);
    if (!connectToken) {
      return await publisher.publishError(res, {
        error: 'Invalid connect token',
        wsClientId,
        connectMethod,
        redirectUrl,
        prefersDarkMode,
      });
    }

    if (connectMethod || wsClientId || redirectUrl || prefersDarkMode) {
      const updatedConnectToken = await connectTokenService.updateConnectToken(connectToken.id, {
        connect_method: connectMethod,
        websocket_client_id: wsClientId,
        redirect_url: redirectUrl,
        prefers_dark_mode: prefersDarkMode,
      });

      if (updatedConnectToken) {
        connectMethod = updatedConnectToken.connect_method || undefined;
        wsClientId = updatedConnectToken.websocket_client_id || undefined;
        redirectUrl = updatedConnectToken.redirect_url || undefined;
        prefersDarkMode = updatedConnectToken.prefers_dark_mode || false;
      }
    }

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

      const serverUrl = getServerUrl();
      if (!serverUrl) {
        throw new Error('SERVER_URL is undefined');
      }

      const authScheme = integration.auth_scheme;
      const baseUrl = `${serverUrl}/connect/${token}`;

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
        case AuthScheme.ServiceAccount:
          const serviceAccountUrl = `${baseUrl}/service-account`;
          await activityService.createActivityLog(activityId, {
            timestamp: now(),
            level: LogLevel.Info,
            message: `Redirecting to service account auth`,
          });

          return res.redirect(serviceAccountUrl);

        case AuthScheme.None:
          await activityService.createActivityLog(activityId, {
            timestamp: now(),
            level: LogLevel.Info,
            message: `Upserting connection without credentials`,
          });

          const connectionType = await this.getConnectionTypeFromToken(
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
            credentials: JSON.stringify({ type: AuthScheme.None }),
            credentials_hash: null,
            credentials_iv: null,
            credentials_tag: null,
            configuration: connectToken.configuration || null,
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
            message: `Connection ${response.action} without credentials`,
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

  public async getConnectionTypeFromToken(
    connectionType: string | null,
    providerKey: string
  ): Promise<ConnectionType> {
    if (connectionType && connectionType === ConnectionType.Organization) {
      const providerSpec = await providerService.getProviderSpec(providerKey);
      if (!providerSpec) {
        throw new Error(`Failed to get provider specifcation for ${providerKey}`);
      } else if (!providerSpec.can_have_organization_account) {
        throw new Error(`Integration ${providerKey} does not support organization connections`);
      }

      return ConnectionType.Organization;
    } else if (connectionType && connectionType !== ConnectionType.Individual) {
      throw new Error(`Invalid connection type ${connectionType}`);
    } else {
      return ConnectionType.Individual;
    }
  }

  public async oauthView(req: Request, res: Response) {
    const token = req.params['token'];
    if (!token) {
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

      const serverUrl = getServerUrl();
      if (!serverUrl) {
        throw new Error('SERVER_URL is undefined');
      }

      const integration = await integrationService.getIntegrationById(connectToken.integration_id);
      if (!integration) {
        throw new Error(`Failed to retrieve integration with ID ${connectToken.integration_id}`);
      } else if (
        integration.auth_scheme !== AuthScheme.OAuth2 &&
        integration.auth_scheme !== AuthScheme.OAuth1
      ) {
        throw new Error(`Invalid auth scheme ${integration.auth_scheme} for ${integration.id}`);
      }

      const providerSpec = await providerService.getProviderSpec(integration.provider_key);
      if (!providerSpec) {
        throw new Error(`Provider specification not found for ${integration.provider_key}`);
      }

      const authSpec = providerSpec.auth.find((auth) => auth.scheme === integration.auth_scheme);
      if (!authSpec) {
        throw new Error(
          `Auth scheme ${integration.auth_scheme} not found in provider specification`
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
          connect_token: token,
          integration: {
            provider_key: integration.provider_key,
            name: providerSpec.name,
            logo_url: providerSpec.logo_url,
            logo_url_dark_mode: providerSpec.logo_url_dark_mode,
          },
          configuration_fields: keys.map((key) => ({
            name: key,
            label: formatKeyToReadableText(key),
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

      const serverUrl = getServerUrl();
      if (!serverUrl) {
        throw new Error('SERVER_URL is undefined');
      }

      const updatedConnectToken = await connectTokenService.updateConnectToken(connectToken.id, {
        configuration: config,
      });

      if (!updatedConnectToken) {
        throw new Error(`Failed to update connect token ${connectToken.id}`);
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
    const token = req.params['token'];
    if (!token) {
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

      const serverUrl = getServerUrl();
      if (!serverUrl) {
        throw new Error('SERVER_URL is undefined');
      }

      const integration = await integrationService.getIntegrationById(connectToken.integration_id);
      if (!integration) {
        throw new Error(`Failed to retrieve integration with ID ${connectToken.integration_id}`);
      } else if (integration.auth_scheme !== AuthScheme.ApiKey) {
        throw new Error(`Invalid auth scheme ${integration.auth_scheme} for ${integration.id}`);
      }

      const providerSpec = await providerService.getProviderSpec(integration.provider_key);
      if (!providerSpec) {
        throw new Error(`Provider specification not found for ${integration.provider_key}`);
      }

      await activityService.createActivityLog(activityId, {
        timestamp: now(),
        level: LogLevel.Info,
        message: `User viewed API key input screen`,
      });

      const data: ApiKeyTemplateData = {
        server_url: serverUrl,
        connect_token: token,
        integration: {
          provider_key: integration.provider_key,
          name: providerSpec.name,
          logo_url: providerSpec.logo_url,
          logo_url_dark_mode: providerSpec.logo_url_dark_mode,
        },
        branding,
        prefers_dark_mode: prefersDarkMode,
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
      } else if (integration.auth_scheme !== AuthScheme.ApiKey) {
        throw new Error(`Invalid auth scheme ${integration.auth_scheme} for ${integration.id}`);
      }

      const connectionType = await this.getConnectionTypeFromToken(
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
        credentials: JSON.stringify({ type: AuthScheme.ApiKey, apiKey }),
        credentials_hash: null,
        credentials_iv: null,
        credentials_tag: null,
        configuration: connectToken.configuration || null,
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
        message: `Connection ${response.action} with API key credentials`,
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

  public async basicAuthView(req: Request, res: Response) {
    const token = req.params['token'];
    if (!token) {
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

      const serverUrl = getServerUrl();
      if (!serverUrl) {
        throw new Error('SERVER_URL is undefined');
      }

      const integration = await integrationService.getIntegrationById(connectToken.integration_id);
      if (!integration) {
        throw new Error(`Failed to retrieve integration with ID ${connectToken.integration_id}`);
      } else if (integration.auth_scheme !== AuthScheme.Basic) {
        throw new Error(`Invalid auth scheme ${integration.auth_scheme} for ${integration.id}`);
      }

      const providerSpec = await providerService.getProviderSpec(integration.provider_key);
      if (!providerSpec) {
        throw new Error(`Provider specification not found for ${integration.provider_key}`);
      }

      await activityService.createActivityLog(activityId, {
        timestamp: now(),
        level: LogLevel.Info,
        message: `User viewed username/password input screen`,
      });

      const data: BasicTemplateData = {
        server_url: serverUrl,
        connect_token: token,
        integration: {
          provider_key: integration.provider_key,
          name: providerSpec.name,
          logo_url: providerSpec.logo_url,
          logo_url_dark_mode: providerSpec.logo_url_dark_mode,
        },
        branding,
        prefers_dark_mode: prefersDarkMode,
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
      } else if (integration.auth_scheme !== AuthScheme.Basic) {
        throw new Error(`Invalid auth scheme ${integration.auth_scheme} for ${integration.id}`);
      }

      const connectionType = await this.getConnectionTypeFromToken(
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
        credentials: JSON.stringify({ type: AuthScheme.Basic, username, password }),
        credentials_hash: null,
        credentials_iv: null,
        credentials_tag: null,
        configuration: connectToken.configuration || null,
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
        message: `Connection ${response.action} with basic credentials`,
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

  public async serviceAccountAuthView(req: Request, res: Response) {
    const token = req.params['token'];
    if (!token) {
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

      const serverUrl = getServerUrl();
      if (!serverUrl) {
        throw new Error('SERVER_URL is undefined');
      }

      const integration = await integrationService.getIntegrationById(connectToken.integration_id);
      if (!integration) {
        throw new Error(`Failed to retrieve integration with ID ${connectToken.integration_id}`);
      } else if (integration.auth_scheme !== AuthScheme.ServiceAccount) {
        throw new Error(`Invalid auth scheme ${integration.auth_scheme} for ${integration.id}`);
      }

      const providerSpec = await providerService.getProviderSpec(integration.provider_key);
      if (!providerSpec) {
        throw new Error(`Provider specification not found for ${integration.provider_key}`);
      }

      await activityService.createActivityLog(activityId, {
        timestamp: now(),
        level: LogLevel.Info,
        message: `User viewed service account input screen`,
      });

      const data: ServiceAccountTemplateData = {
        server_url: serverUrl,
        connect_token: token,
        integration: {
          provider_key: integration.provider_key,
          name: providerSpec.name,
          logo_url: providerSpec.logo_url,
          logo_url_dark_mode: providerSpec.logo_url_dark_mode,
        },
        branding,
        prefers_dark_mode: prefersDarkMode,
      };

      res.render('service-account', data);
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

  public async upsertServiceAccount(req: Request, res: Response) {
    const token = req.params['token'];
    const serviceAccountKey = req.body['key'];

    if (!token) {
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
      if (!serviceAccountKey || typeof serviceAccountKey !== 'string') {
        const errorMessage = 'Service account key missing or invalid';
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
      } else if (integration.auth_scheme !== AuthScheme.ServiceAccount) {
        throw new Error(`Invalid auth scheme ${integration.auth_scheme} for ${integration.id}`);
      }

      const connectionType = await this.getConnectionTypeFromToken(
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
        credentials: JSON.stringify({ type: AuthScheme.ServiceAccount, key: serviceAccountKey }),
        credentials_hash: null,
        credentials_iv: null,
        credentials_tag: null,
        configuration: connectToken.configuration || null,
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
        message: `Connection ${response.action} with service account credentials`,
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
}

export default new ConnectController();
