import { AuthScheme } from '@embed/providers';
import {
  DEFAULT_ERROR_MESSAGE,
  LogLevel,
  activityService,
  environmentService,
  errorService,
  getServerUrl,
  integrationService,
  linkedAccountService,
  now,
  providerService,
} from '@embed/shared';
import type { Request, Response } from 'express';
import publisher from '../clients/publisher.client';
import linkedAccountHook from '../hooks/linkedAccount.hook';
import linkTokenService from '../services/linkToken.service';
import {
  appendParamsToUrl,
  extractConfigurationKeys,
  formatKeyToReadableText,
} from '../utils/helpers';
import { ApiKeyTemplateData, BasicTemplateData, ConfigTemplateData } from '../utils/types';

class LinkController {
  public async routeView(req: Request, res: Response) {
    const token = req.params['token'];
    let linkMethod = req.query['link_method'] as string | undefined;
    let wsClientId = req.query['ws_client_id'] as string | undefined;
    let redirectUrl = req.query['redirect_url'] as string | undefined;
    let prefersDarkMode = req.query['prefers_dark_mode'] === 'true';
    res.setHeader('Content-Security-Policy', '');

    if (!token) {
      return await publisher.publishError(res, {
        error: 'Link token missing',
        linkMethod,
        wsClientId,
        redirectUrl,
        prefersDarkMode,
      });
    }

    const linkToken = await linkTokenService.getLinkTokenById(token);
    if (!linkToken) {
      return await publisher.publishError(res, {
        error: 'Invalid link token',
        wsClientId,
        linkMethod,
        redirectUrl,
        prefersDarkMode,
      });
    }

    if (linkMethod || wsClientId || redirectUrl || prefersDarkMode) {
      const updatedLinkToken = await linkTokenService.updateLinkToken(linkToken.id, {
        link_method: linkMethod,
        websocket_client_id: wsClientId,
        redirect_url: redirectUrl,
        prefers_dark_mode: prefersDarkMode,
      });

      if (updatedLinkToken) {
        linkMethod = updatedLinkToken.link_method || undefined;
        wsClientId = updatedLinkToken.websocket_client_id || undefined;
        redirectUrl = updatedLinkToken.redirect_url || undefined;
        prefersDarkMode = updatedLinkToken.prefers_dark_mode || false;
      }
    }

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
        throw new Error(`Failed to retrieve integration with key ${linkToken.integration_key}`);
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

      const providerSpec = await providerService.getProviderSpec(integration.unique_key);
      if (!providerSpec) {
        throw new Error(`Provider specification not found for ${integration.unique_key}`);
      }

      const serverUrl = getServerUrl();
      if (!serverUrl) {
        throw new Error('SERVER_URL is undefined');
      }

      const authScheme = providerSpec.auth.scheme;
      const baseUrl = `${serverUrl}/link/${token}`;

      switch (authScheme) {
        case AuthScheme.OAuth1:
        case AuthScheme.OAuth2:
          const oauthUrl = `${baseUrl}/oauth`;
          await activityService.createActivityLog(activityId, {
            timestamp: now(),
            level: LogLevel.Info,
            message: `User consent received; Redirecting to OAuth flow`,
          });

          return res.redirect(oauthUrl);
        case AuthScheme.ApiKey:
          const apiKeyUrl = `${baseUrl}/api-key`;
          await activityService.createActivityLog(activityId, {
            timestamp: now(),
            level: LogLevel.Info,
            message: `User consent received; Redirecting to API key auth`,
          });

          return res.redirect(apiKeyUrl);
        case AuthScheme.Basic:
          const basicUrl = `${baseUrl}/basic`;
          await activityService.createActivityLog(activityId, {
            timestamp: now(),
            level: LogLevel.Info,
            message: `User consent received; Redirecting to basic auth`,
          });

          return res.redirect(basicUrl);
        case AuthScheme.None:
          await activityService.createActivityLog(activityId, {
            timestamp: now(),
            level: LogLevel.Info,
            message: `User consent received; Upserting linked account without credentials`,
          });

          const linkedAccountId =
            linkToken.linked_account_id || linkedAccountService.generateId(integration.unique_key);

          const response = await linkedAccountService.upsertLinkedAccount({
            id: linkedAccountId,
            environment_id: linkToken.environment_id,
            integration_key: integration.unique_key,
            configuration: null,
            credentials: JSON.stringify({ type: AuthScheme.None }),
            credentials_iv: null,
            credentials_tag: null,
            metadata: null,
            created_at: now(),
            updated_at: now(),
            deleted_at: null,
          });

          if (!response) {
            throw new Error(`Failed to upsert linked account for ${integration.unique_key}`);
          }

          await activityService.updateActivity(activityId, {
            linked_account_id: response.linkedAccount.id,
          });

          await activityService.createActivityLog(activityId, {
            timestamp: now(),
            level: LogLevel.Info,
            message: `Linked account ${response.action} without credentials`,
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
        default:
          throw new Error(
            `Unsupported auth scheme ${authScheme} for provider ${providerSpec.unique_key}`
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
        linkMethod,
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

      const serverUrl = getServerUrl();
      if (!serverUrl) {
        throw new Error('SERVER_URL is undefined');
      }

      const providerSpec = await providerService.getProviderSpec(linkToken.integration_key);
      if (!providerSpec) {
        throw new Error(`Provider specification not found for ${linkToken.integration_key}`);
      }

      if (
        providerSpec.auth.scheme !== AuthScheme.OAuth2 &&
        providerSpec.auth.scheme !== AuthScheme.OAuth1
      ) {
        throw new Error(
          `Invalid auth scheme ${providerSpec.auth.scheme} for ${providerSpec.unique_key}`
        );
      }

      const authorizationUrlKeys = extractConfigurationKeys(providerSpec.auth.authorization_url);
      const tokenUrlKeys = extractConfigurationKeys(providerSpec.auth.token_url);
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
          link_token: token,
          integration: {
            unique_key: providerSpec.unique_key,
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
        linkMethod,
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
          linkMethod,
          redirectUrl,
          branding,
          prefersDarkMode,
        });
      }

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

      const serverUrl = getServerUrl();
      if (!serverUrl) {
        throw new Error('SERVER_URL is undefined');
      }

      const updatedLinkToken = await linkTokenService.updateLinkToken(linkToken.id, {
        configuration: config,
      });

      if (!updatedLinkToken) {
        throw new Error(`Failed to update link token ${linkToken.id}`);
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
        linkMethod,
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

      const serverUrl = getServerUrl();
      if (!serverUrl) {
        throw new Error('SERVER_URL is undefined');
      }

      const providerSpec = await providerService.getProviderSpec(linkToken.integration_key);
      if (!providerSpec) {
        throw new Error(`Provider specification not found for ${linkToken.integration_key}`);
      }

      await activityService.createActivityLog(activityId, {
        timestamp: now(),
        level: LogLevel.Info,
        message: `User viewed API key input screen`,
      });

      const data: ApiKeyTemplateData = {
        server_url: serverUrl,
        link_token: token,
        integration: {
          unique_key: providerSpec.unique_key,
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
        linkMethod,
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
          linkMethod,
          redirectUrl,
          branding,
          prefersDarkMode,
        });
      }

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

      const linkedAccountId =
        linkToken.linked_account_id || linkedAccountService.generateId(linkToken.integration_key);

      const response = await linkedAccountService.upsertLinkedAccount({
        id: linkedAccountId,
        environment_id: linkToken.environment_id,
        integration_key: linkToken.integration_key,
        configuration: null,
        credentials: JSON.stringify({ type: AuthScheme.ApiKey, apiKey }),
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
        message: `Linked account ${response.action} with API key credentials`,
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

  public async basicAuthView(req: Request, res: Response) {
    const token = req.params['token'];
    if (!token) {
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

      const serverUrl = getServerUrl();
      if (!serverUrl) {
        throw new Error('SERVER_URL is undefined');
      }

      const providerSpec = await providerService.getProviderSpec(linkToken.integration_key);
      if (!providerSpec) {
        throw new Error(`Provider specification not found for ${linkToken.integration_key}`);
      }

      await activityService.createActivityLog(activityId, {
        timestamp: now(),
        level: LogLevel.Info,
        message: `User viewed username/password input screen`,
      });

      const data: BasicTemplateData = {
        server_url: serverUrl,
        link_token: token,
        integration: {
          unique_key: providerSpec.unique_key,
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
        linkMethod,
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
          linkMethod,
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
          linkMethod,
          redirectUrl,
          branding,
          prefersDarkMode,
        });
      }

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

      const linkedAccountId =
        linkToken.linked_account_id || linkedAccountService.generateId(linkToken.integration_key);

      const response = await linkedAccountService.upsertLinkedAccount({
        id: linkedAccountId,
        environment_id: linkToken.environment_id,
        integration_key: linkToken.integration_key,
        configuration: null,
        credentials: JSON.stringify({ type: AuthScheme.Basic, username, password }),
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
        message: `Linked account ${response.action} with basic credentials`,
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
}

export default new LinkController();
