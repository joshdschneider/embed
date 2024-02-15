import { AuthScheme, ProviderSpecification } from '@kit/providers';
import type { Integration } from '@kit/shared';
import {
  DEFAULT_ERROR_MESSAGE,
  LogLevel,
  Resource,
  activityService,
  errorService,
  generateId,
  getServerUrl,
  now,
  providerService,
} from '@kit/shared';
import type { Request, Response } from 'express';
import publisher from '../clients/publisher.client';
import linkedAccountHook from '../hooks/linkedAccount.hook';
import environmentService from '../services/environment.service';
import integrationService from '../services/integration.service';
import linkTokenService from '../services/linkToken.service';
import linkedAccountService from '../services/linkedAccount.service';
import {
  appendParamsToUrl,
  extractConfigurationKeys,
  formatKeyToReadableText,
} from '../utils/helpers';
import {
  ApiKeyTemplateData,
  BasicTemplateData,
  ConfigTemplateData,
  ConsentTemplateData,
  ListTemplateData,
} from '../utils/types';

class LinkController {
  public async listView(req: Request, res: Response) {
    const token = req.params['token'];

    let linkMethod = req.query['link_method'] as string | undefined;
    let wsClientId = req.query['ws_client_id'] as string | undefined;
    let redirectUrl = req.query['redirect_url'] as string | undefined;
    let prefersDarkMode = req.query['prefers_dark_mode'] === 'true';

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
      const serverUrl = getServerUrl();
      if (!serverUrl) {
        throw new Error('SERVER_URL is undefined');
      }

      if (!linkToken.can_choose_integration) {
        return res.redirect(
          `${serverUrl}/link/${linkToken.id}/i/${linkToken.integration_provider}`
        );
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

      const integrations = await integrationService.listIntegrations(linkToken.environment_id);

      if (!integrations) {
        throw new Error(`Failed to list integrations for environment ${linkToken.environment_id}`);
      }

      const enabledIntegrations = integrations.filter((integration) => integration.is_enabled);

      const integrationsWithSpec = await Promise.all(
        enabledIntegrations.map(async (integration) => {
          const providerSpec = await providerService.getProviderSpec(integration.provider);

          if (!providerSpec) {
            const err = new Error(`Provider specification not found for ${integration.provider}`);
            await errorService.reportError(err);
          }

          return { ...integration, provider_spec: providerSpec };
        })
      );

      const integrationsFiltered = integrationsWithSpec.filter(
        (integration) => integration.provider_spec !== null
      ) as (Integration & { provider_spec: ProviderSpecification })[];

      const integrationsList = integrationsFiltered.map((integration) => {
        return {
          provider: integration.provider,
          display_name: integration.provider_spec.display_name,
          logo_url: integration.provider_spec.logo_url,
          logo_dark_url: integration.provider_spec.logo_dark_url,
        };
      });

      await activityService.createActivityLog(activityId, {
        timestamp: now(),
        level: LogLevel.Info,
        message: `User viewed select integration screen`,
      });

      const data: ListTemplateData = {
        is_preview: false,
        server_url: serverUrl,
        link_token: token,
        integrations: integrationsList,
        branding,
        prefers_dark_mode: prefersDarkMode,
      };

      res.render('list', data);
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

  public async consentView(req: Request, res: Response) {
    const token = req.params['token'];
    const integrationProvider = req.params['integration'];

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
      if (!integrationProvider) {
        const errorMessage = 'No integration selected';

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

      if (
        !linkToken.can_choose_integration &&
        integrationProvider !== linkToken.integration_provider
      ) {
        const errorMessage = `Invalid integration`;

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

      const integration = await integrationService.getIntegrationByProvider(
        integrationProvider,
        linkToken.environment_id
      );

      if (!integration) {
        throw new Error(`Failed to retrieve integration ${integrationProvider}`);
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

      const providerSpec = await providerService.getProviderSpec(integration.provider);
      if (!providerSpec) {
        throw new Error(`Provider specification not found for ${integration.provider}`);
      }

      await activityService.createActivityLog(activityId, {
        timestamp: now(),
        level: LogLevel.Info,
        message: `User viewed consent screen`,
      });

      const data: ConsentTemplateData = {
        is_preview: false,
        server_url: serverUrl,
        link_token: token,
        can_choose_integration: linkToken.can_choose_integration,
        integration: {
          provider: integration.provider,
          display_name: providerSpec.display_name,
          logo_url: providerSpec.logo_url,
          logo_dark_url: providerSpec.logo_dark_url,
        },
        branding,
        prefers_dark_mode: prefersDarkMode,
      };

      res.render('consent', data);
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

  public async saveConsent(req: Request, res: Response) {
    const token = req.params['token'];
    const provider = req.params['integration'];

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

      if (!provider) {
        const errorMessage = 'No integration selected';

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

      const integration = await integrationService.getIntegrationByProvider(
        provider,
        linkToken.environment_id
      );

      if (!integration) {
        throw new Error(`Failed to retrieve integration ${provider}`);
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

      const updatedLinkToken = await linkTokenService.updateLinkToken(linkToken.id, {
        integration_provider: integration.provider,
        consent_given: true,
        consent_date: now(),
        consent_ip: req.ip,
      });

      if (!updatedLinkToken) {
        throw new Error(`Failed to update link token ${linkToken.id}`);
      }

      await activityService.updateActivity(activityId, {
        integration_provider: integration.provider,
      });

      const providerSpec = await providerService.getProviderSpec(integration.provider);
      if (!providerSpec) {
        throw new Error(`Provider specification not found for ${integration.provider}`);
      }

      const serverUrl = getServerUrl();
      if (!serverUrl) {
        throw new Error('SERVER_URL is undefined');
      }

      const authScheme = providerSpec.auth.scheme;
      const baseUrl = `${serverUrl}/link/${token}`;

      switch (authScheme) {
        case AuthScheme.OAUTH1:
        case AuthScheme.OAUTH2:
          const oauthUrl = `${baseUrl}/oauth`;

          await activityService.createActivityLog(activityId, {
            timestamp: now(),
            level: LogLevel.Info,
            message: `User consent received; Redirecting to OAuth flow`,
          });

          return res.redirect(oauthUrl);
        case AuthScheme.API_KEY:
          const apiKeyUrl = `${baseUrl}/api-key`;

          await activityService.createActivityLog(activityId, {
            timestamp: now(),
            level: LogLevel.Info,
            message: `User consent received; Redirecting to API key auth`,
          });

          return res.redirect(apiKeyUrl);
        case AuthScheme.BASIC:
          const basicUrl = `${baseUrl}/basic`;

          await activityService.createActivityLog(activityId, {
            timestamp: now(),
            level: LogLevel.Info,
            message: `User consent received; Redirecting to basic auth`,
          });

          return res.redirect(basicUrl);
        case AuthScheme.NONE:
          await activityService.createActivityLog(activityId, {
            timestamp: now(),
            level: LogLevel.Info,
            message: `User consent received; Upserting linked account without credentials`,
          });

          const response = await linkedAccountService.upsertLinkedAccount({
            id: linkToken.linked_account_id || generateId(Resource.LinkedAccount),
            environment_id: linkToken.environment_id,
            integration_provider: integration.provider,
            consent_given: linkToken.consent_given,
            consent_ip: linkToken.consent_ip,
            consent_date: linkToken.consent_date,
            configuration: null,
            credentials: JSON.stringify({ type: AuthScheme.NONE }),
            credentials_iv: null,
            credentials_tag: null,
            metadata: null,
            created_at: now(),
            updated_at: now(),
            deleted_at: null,
          });

          if (!response) {
            throw new Error(`Failed to upsert linked account for ${integration.provider}`);
          }

          await activityService.updateActivity(activityId, {
            linked_account_id: response.linkedAccount.id,
          });

          await activityService.createActivityLog(activityId, {
            timestamp: now(),
            level: LogLevel.Info,
            message: 'Linked account created without credentials',
          });

          await linkTokenService.deleteLinkToken(linkToken.id);

          if (response.action === 'created') {
            await linkedAccountHook.linkedAccountCreated({
              environmentId: linkToken.environment_id,
              linkedAccount: response.linkedAccount,
              activityId,
            });
          } else if (response.action === 'updated') {
            await linkedAccountHook.linkedAccountUpdated({
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
            `Unsupported auth scheme ${authScheme} for provider ${providerSpec.slug}`
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

      if (!linkToken.consent_given) {
        const errorMessage = 'Consent bypassed';

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

      if (!linkToken.integration_provider) {
        const errorMessage = 'No integration selected';

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

      const providerSpec = await providerService.getProviderSpec(linkToken.integration_provider);
      if (!providerSpec) {
        throw new Error(`Provider specification not found for ${linkToken.integration_provider}`);
      }

      if (
        providerSpec.auth.scheme !== AuthScheme.OAUTH2 &&
        providerSpec.auth.scheme !== AuthScheme.OAUTH1
      ) {
        throw new Error(`Invalid auth scheme ${providerSpec.auth.scheme} for ${providerSpec.slug}`);
      }

      const authorizationUrlKeys = extractConfigurationKeys(providerSpec.auth.authorization_url);
      const tokenUrlKeys = extractConfigurationKeys(providerSpec.auth.token_url);
      const keys = [...new Set([...authorizationUrlKeys, ...tokenUrlKeys])];

      if (keys.length > 0) {
        await activityService.createActivityLog(activityId, {
          timestamp: now(),
          level: LogLevel.Info,
          message: `Collecting required fields for ${providerSpec.display_name} OAuth from user`,
          payload: { configuration_fields: keys },
        });

        const data: ConfigTemplateData = {
          server_url: serverUrl,
          link_token: token,
          integration: {
            provider: providerSpec.slug,
            display_name: providerSpec.display_name,
            logo_url: providerSpec.logo_url,
            logo_dark_url: providerSpec.logo_dark_url,
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

      if (!linkToken.consent_given) {
        const errorMessage = 'Consent bypassed';

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

      if (!linkToken.integration_provider) {
        const errorMessage = 'No integration selected';

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

      if (!linkToken.consent_given) {
        const errorMessage = 'Consent bypassed';

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

      if (!linkToken.integration_provider) {
        const errorMessage = 'No integration selected';

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

      const providerSpec = await providerService.getProviderSpec(linkToken.integration_provider);
      if (!providerSpec) {
        throw new Error(`Provider specification not found for ${linkToken.integration_provider}`);
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
          provider: providerSpec.slug,
          display_name: providerSpec.display_name,
          logo_url: providerSpec.logo_url,
          logo_dark_url: providerSpec.logo_dark_url,
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

      if (!linkToken.consent_given) {
        const errorMessage = 'Consent bypassed';

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

      if (!linkToken.integration_provider) {
        const errorMessage = 'No integration selected';

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

      const response = await linkedAccountService.upsertLinkedAccount({
        id: linkToken.linked_account_id || generateId(Resource.LinkedAccount),
        environment_id: linkToken.environment_id,
        integration_provider: linkToken.integration_provider,
        consent_given: linkToken.consent_given,
        consent_ip: linkToken.consent_ip,
        consent_date: linkToken.consent_date,
        configuration: null,
        credentials: JSON.stringify({ type: AuthScheme.API_KEY, apiKey }),
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
        message: 'Linked account created with API key credentials',
      });

      await linkTokenService.deleteLinkToken(linkToken.id);

      if (response.action === 'created') {
        await linkedAccountHook.linkedAccountCreated({
          environmentId: linkToken.environment_id,
          linkedAccount: response.linkedAccount,
          activityId,
        });
      } else if (response.action === 'updated') {
        await linkedAccountHook.linkedAccountUpdated({
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

      if (!linkToken.consent_given) {
        const errorMessage = 'Consent bypassed';

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

      if (!linkToken.integration_provider) {
        const errorMessage = 'No integration selected';

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

      const providerSpec = await providerService.getProviderSpec(linkToken.integration_provider);
      if (!providerSpec) {
        throw new Error(`Provider specification not found for ${linkToken.integration_provider}`);
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
          provider: providerSpec.slug,
          display_name: providerSpec.display_name,
          logo_url: providerSpec.logo_url,
          logo_dark_url: providerSpec.logo_dark_url,
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

      if (!linkToken.consent_given) {
        const errorMessage = 'Consent bypassed';

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

      if (!linkToken.integration_provider) {
        const errorMessage = 'No integration selected';

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

      const response = await linkedAccountService.upsertLinkedAccount({
        id: linkToken.linked_account_id || generateId(Resource.LinkedAccount),
        environment_id: linkToken.environment_id,
        integration_provider: linkToken.integration_provider,
        consent_given: linkToken.consent_given,
        consent_ip: linkToken.consent_ip,
        consent_date: linkToken.consent_date,
        configuration: null,
        credentials: JSON.stringify({ type: AuthScheme.BASIC, username, password }),
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
        message: 'Linked account created with basic credentials',
      });

      await linkTokenService.deleteLinkToken(linkToken.id);

      if (response.action === 'created') {
        await linkedAccountHook.linkedAccountCreated({
          environmentId: linkToken.environment_id,
          linkedAccount: response.linkedAccount,
          activityId,
        });
      } else if (response.action === 'updated') {
        await linkedAccountHook.linkedAccountUpdated({
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
