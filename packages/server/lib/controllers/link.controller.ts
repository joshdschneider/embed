import { AuthScheme, ProviderSpecification } from '@beta/providers';
import { Integration } from '@prisma/client';
import { Request, Response } from 'express';
import publisher from '../clients/publisher.client';
import activityService from '../services/activity.service';
import errorService, { ErrorCode } from '../services/error.service';
import integrationService from '../services/integration.service';
import linkTokenService from '../services/linkToken.service';
import linkedAccountService from '../services/linkedAccount.service';
import providerService from '../services/provider.service';
import { LogLevel } from '../types';
import { DEFAULT_ERROR_MESSAGE, getServerUrl } from '../utils/constants';
import {
  Resource,
  extractConfigurationKeys,
  formatKeyToReadableText,
  generateId,
  now,
} from '../utils/helpers';

class LinkController {
  public async listView(req: Request, res: Response) {
    const token = req.params['token'];
    const wsClientId = req.query['ws_client_id'] as string | undefined;
    const linkMethod = req.query['link_method'] as string | undefined;

    if (!token) {
      const errorMessage = 'Invalid link token';

      if (wsClientId) {
        return await publisher.publishError(res, {
          error: errorMessage,
          wsClientId,
          linkMethod,
        });
      }

      return res.render('error', {
        code: ErrorCode.BadRequest,
        message: errorMessage,
      });
    }

    const linkToken = await linkTokenService.getLinkTokenById(token);

    if (!linkToken) {
      const errorMessage = 'Invalid link token';

      if (wsClientId) {
        return await publisher.publishError(res, {
          error: errorMessage,
          wsClientId,
          linkMethod,
        });
      }

      return res.render('error', {
        code: ErrorCode.BadRequest,
        message: errorMessage,
      });
    }

    const activityId = await activityService.findActivityIdByLinkToken(linkToken.id);

    try {
      if (!linkToken.can_choose_integration) {
        if (linkToken.integration_provider) {
          const redirectUrl = `${getServerUrl()}/link/${token}/i/${linkToken.integration_provider}`;

          if (wsClientId) {
            const method = linkMethod ? '&link_method=' + linkMethod : '';
            return res.redirect(redirectUrl + `?ws_client_id=${wsClientId}${method}`);
          }

          return res.redirect(redirectUrl);
        } else {
          await activityService.createActivityLog(activityId, {
            timestamp: now(),
            level: LogLevel.Error,
            message: 'No integration provider associated with link token',
          });

          const errorMessage = 'Please choose an integration';

          if (wsClientId) {
            return await publisher.publishError(res, {
              error: errorMessage,
              wsClientId,
              linkMethod,
            });
          }

          return res.render('error', {
            code: ErrorCode.BadRequest,
            message: errorMessage,
          });
        }
      }

      await activityService.createActivityLog(activityId, {
        timestamp: now(),
        level: LogLevel.Info,
        message: `User viewed select integration screen`,
      });

      if (linkToken.expires_at < now()) {
        const errorMessage = 'Link token expired';

        await activityService.createActivityLog(activityId, {
          timestamp: now(),
          level: LogLevel.Error,
          message: errorMessage,
        });

        if (wsClientId) {
          return await publisher.publishError(res, {
            error: errorMessage,
            wsClientId,
            linkMethod,
          });
        }

        return res.render('error', {
          code: ErrorCode.BadRequest,
          message: errorMessage,
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
        };
      });

      if (wsClientId) {
        await linkTokenService.updateLinkToken(linkToken.id, linkToken.environment_id, {
          websocket_client_id: wsClientId,
          link_method: linkMethod,
        });
      }

      res.render('list', {
        server_url: getServerUrl(),
        link_token: token,
        integrations: integrationsList,
      });
    } catch (err) {
      await errorService.reportError(err);

      await activityService.createActivityLog(activityId, {
        timestamp: now(),
        level: LogLevel.Error,
        message: 'Internal server error',
      });

      if (wsClientId) {
        return await publisher.publishError(res, {
          error: DEFAULT_ERROR_MESSAGE,
          wsClientId,
          linkMethod,
        });
      }

      return res.render('error', {
        code: ErrorCode.InternalServerError,
        message: DEFAULT_ERROR_MESSAGE,
      });
    }
  }

  public async consentView(req: Request, res: Response) {
    const token = req.params['token'];
    const integrationProvider = req.params['integration'];
    const wsClientId = req.query['ws_client_id'] as string | undefined;
    const linkMethod = req.query['link_method'] as string | undefined;

    if (!token) {
      const errorMessage = 'Invalid link token';

      if (wsClientId) {
        return await publisher.publishError(res, {
          error: errorMessage,
          wsClientId,
          linkMethod,
        });
      }

      return res.render('error', {
        code: ErrorCode.BadRequest,
        message: errorMessage,
      });
    }

    const linkToken = await linkTokenService.getLinkTokenById(token);

    if (!linkToken) {
      const errorMessage = 'Invalid link token';

      if (wsClientId) {
        return await publisher.publishError(res, {
          error: errorMessage,
          wsClientId,
          linkMethod,
        });
      }

      return res.render('error', {
        code: ErrorCode.BadRequest,
        message: errorMessage,
      });
    }

    const activityId = await activityService.findActivityIdByLinkToken(linkToken.id);

    await activityService.createActivityLog(activityId, {
      timestamp: now(),
      level: LogLevel.Info,
      message: `User viewed consent screen`,
    });

    try {
      if (!integrationProvider) {
        await activityService.createActivityLog(activityId, {
          timestamp: now(),
          level: LogLevel.Error,
          message: 'No integration provider associated with link token',
        });

        const errorMessage = 'Please choose an integration';

        if (wsClientId) {
          return await publisher.publishError(res, {
            error: errorMessage,
            wsClientId,
            linkMethod,
          });
        }

        return res.render('error', {
          code: ErrorCode.BadRequest,
          message: errorMessage,
        });
      }

      if (linkToken.expires_at < now()) {
        const errorMessage = 'Link token expired';

        await activityService.createActivityLog(activityId, {
          timestamp: now(),
          level: LogLevel.Error,
          message: errorMessage,
        });

        if (wsClientId) {
          return await publisher.publishError(res, {
            error: errorMessage,
            wsClientId,
            linkMethod,
          });
        }

        return res.render('error', {
          code: ErrorCode.BadRequest,
          message: errorMessage,
        });
      }

      const integration = await integrationService.getIntegrationByProvider(
        integrationProvider,
        linkToken.environment_id
      );

      if (!integration) {
        throw new Error(`Failed to retrieve integration ${integrationProvider}`);
      } else if (!integration.is_enabled) {
        const errorMessage = 'Integration is disabled';

        await activityService.createActivityLog(activityId, {
          timestamp: now(),
          level: LogLevel.Error,
          message: errorMessage,
        });

        if (wsClientId) {
          return await publisher.publishError(res, {
            error: errorMessage,
            wsClientId,
            linkMethod,
          });
        }

        return res.render('error', {
          code: ErrorCode.BadRequest,
          message: errorMessage,
        });
      }

      const providerSpec = await providerService.getProviderSpec(integration.provider);

      if (!providerSpec) {
        throw new Error(`Provider specification not found for ${integration.provider}`);
      }

      if (wsClientId) {
        await linkTokenService.updateLinkToken(linkToken.id, linkToken.environment_id, {
          websocket_client_id: wsClientId,
          link_method: linkMethod,
        });
      }

      res.render('consent', {
        server_url: getServerUrl(),
        link_token: token,
        client_name: 'CLIENT_NAME',
        can_choose_integration: linkToken.can_choose_integration,
        integration: {
          provider: integration.provider,
          display_name: providerSpec.display_name,
          logo_url: providerSpec.logo_url,
        },
      });
    } catch (err) {
      await errorService.reportError(err);

      await activityService.createActivityLog(activityId, {
        timestamp: now(),
        level: LogLevel.Error,
        message: 'Internal server error',
      });

      if (wsClientId) {
        return await publisher.publishError(res, {
          error: DEFAULT_ERROR_MESSAGE,
          wsClientId,
          linkMethod,
        });
      }

      return res.render('error', {
        code: ErrorCode.InternalServerError,
        message: DEFAULT_ERROR_MESSAGE,
      });
    }
  }

  public async saveConsent(req: Request, res: Response) {
    const token = req.params['token'];
    const provider = req.params['integration'];

    if (!token) {
      return res.render('error', {
        code: ErrorCode.BadRequest,
        message: 'Invalid link token',
      });
    }

    const linkToken = await linkTokenService.getLinkTokenById(token);

    if (!linkToken) {
      return res.render('error', {
        code: ErrorCode.BadRequest,
        message: 'Invalid link token',
      });
    }

    const activityId = await activityService.findActivityIdByLinkToken(linkToken.id);

    try {
      if (!provider) {
        await activityService.createActivityLog(activityId, {
          timestamp: now(),
          level: LogLevel.Error,
          message: 'Integration provider not received in consent request',
        });

        return res.render('error', {
          code: ErrorCode.BadRequest,
          message: DEFAULT_ERROR_MESSAGE,
        });
      }

      if (linkToken.expires_at < now()) {
        const errorMessage = 'Link token expired';

        await activityService.createActivityLog(activityId, {
          timestamp: now(),
          level: LogLevel.Error,
          message: errorMessage,
        });

        return res.render('error', {
          code: ErrorCode.BadRequest,
          message: errorMessage,
        });
      }

      const integration = await integrationService.getIntegrationByProvider(
        provider,
        linkToken.environment_id
      );

      if (!integration) {
        throw new Error(`Failed to retrieve integration ${provider}`);
      } else if (!integration.is_enabled) {
        const errorMessage = 'Integration is disabled';

        await activityService.createActivityLog(activityId, {
          timestamp: now(),
          level: LogLevel.Error,
          message: errorMessage,
        });

        return res.render('error', {
          code: ErrorCode.BadRequest,
          message: errorMessage,
        });
      }

      const updatedLinkToken = await linkTokenService.updateLinkToken(
        linkToken.id,
        linkToken.environment_id,
        {
          integration_provider: integration.provider,
          consent_given: true,
          consent_date: now(),
          consent_ip: req.ip,
        }
      );

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

      const authScheme = providerSpec.auth.scheme;
      const baseUrl = `${getServerUrl()}/link/${token}`;

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

          return res.redirect(`${baseUrl}/finish`);
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

      return res.render('error', {
        code: ErrorCode.InternalServerError,
        message: DEFAULT_ERROR_MESSAGE,
      });
    }
  }

  public async oauthView(req: Request, res: Response) {
    const token = req.params['token'];

    if (!token) {
      return res.render('error', {
        code: ErrorCode.BadRequest,
        message: 'Invalid link token',
      });
    }

    const linkToken = await linkTokenService.getLinkTokenById(token);

    if (!linkToken) {
      return res.render('error', {
        code: ErrorCode.BadRequest,
        message: 'Invalid link token',
      });
    }

    const activityId = await activityService.findActivityIdByLinkToken(linkToken.id);

    try {
      if (linkToken.expires_at < now()) {
        const errorMessage = 'Link token expired';

        await activityService.createActivityLog(activityId, {
          timestamp: now(),
          level: LogLevel.Error,
          message: errorMessage,
        });

        return res.render('error', {
          code: ErrorCode.BadRequest,
          message: errorMessage,
        });
      } else if (!linkToken.consent_given) {
        const errorMessage = 'Consent bypassed';

        await activityService.createActivityLog(activityId, {
          timestamp: now(),
          level: LogLevel.Error,
          message: errorMessage,
        });

        return res.render('error', {
          code: ErrorCode.BadRequest,
          message: errorMessage,
        });
      } else if (!linkToken.integration_provider) {
        await activityService.createActivityLog(activityId, {
          timestamp: now(),
          level: LogLevel.Error,
          message: 'Integration provider missing from link token',
        });

        return res.render('error', {
          code: ErrorCode.BadRequest,
          message: 'Please choose an integration',
        });
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

        return res.render('config', {
          server_url: getServerUrl(),
          link_token: token,
          integration: {
            provider: providerSpec.slug,
            display_name: providerSpec.display_name,
            logo_url: providerSpec.logo_url,
          },
          configuration_fields: keys.map((key) => ({
            name: key,
            label: formatKeyToReadableText(key),
          })),
        });
      }

      res.redirect(`${getServerUrl()}/oauth/authorize?token=${token}`);
    } catch (err) {
      await errorService.reportError(err);

      await activityService.createActivityLog(activityId, {
        timestamp: now(),
        level: LogLevel.Error,
        message: 'Internal server error',
      });

      return res.render('error', {
        code: ErrorCode.InternalServerError,
        message: DEFAULT_ERROR_MESSAGE,
      });
    }
  }

  public async upsertOauthConfig(req: Request, res: Response) {
    const token = req.params['token'];
    const config = req.body;

    if (!token) {
      return res.render('error', {
        code: ErrorCode.BadRequest,
        message: 'Invalid link token',
      });
    }

    const linkToken = await linkTokenService.getLinkTokenById(token);

    if (!linkToken) {
      return res.render('error', {
        code: ErrorCode.BadRequest,
        message: 'Invalid link token',
      });
    }

    const activityId = await activityService.findActivityIdByLinkToken(linkToken.id);

    try {
      if (!config || typeof config !== 'object') {
        await activityService.createActivityLog(activityId, {
          timestamp: now(),
          level: LogLevel.Error,
          message: 'Configuration missing or invalid',
        });

        return res.render('error', {
          code: ErrorCode.BadRequest,
          message: 'Input missing or invalid',
        });
      }

      if (linkToken.expires_at < now()) {
        const errorMessage = 'Link token expired';

        await activityService.createActivityLog(activityId, {
          timestamp: now(),
          level: LogLevel.Error,
          message: errorMessage,
        });

        return res.render('error', {
          code: ErrorCode.BadRequest,
          message: errorMessage,
        });
      } else if (!linkToken.consent_given) {
        const errorMessage = 'Consent bypassed';

        await activityService.createActivityLog(activityId, {
          timestamp: now(),
          level: LogLevel.Error,
          message: errorMessage,
        });

        return res.render('error', {
          code: ErrorCode.BadRequest,
          message: errorMessage,
        });
      } else if (!linkToken.integration_provider) {
        await activityService.createActivityLog(activityId, {
          timestamp: now(),
          level: LogLevel.Error,
          message: 'Integration provider missing from link token',
        });

        return res.render('error', {
          code: ErrorCode.BadRequest,
          message: 'Please choose an integration',
        });
      }

      const updatedLinkToken = await linkTokenService.updateLinkToken(
        linkToken.id,
        linkToken.environment_id,
        { configuration: config }
      );

      if (!updatedLinkToken) {
        throw new Error(`Failed to update link token ${linkToken.id}`);
      }

      await activityService.createActivityLog(activityId, {
        timestamp: now(),
        level: LogLevel.Info,
        message: 'Configuration received from user',
        payload: { configuration: config },
      });

      res.redirect(`${getServerUrl()}/oauth/authorize?token=${token}`);
    } catch (err) {
      await errorService.reportError(err);

      await activityService.createActivityLog(activityId, {
        timestamp: now(),
        level: LogLevel.Error,
        message: 'Internal server error',
      });

      return res.render('error', {
        code: ErrorCode.InternalServerError,
        message: DEFAULT_ERROR_MESSAGE,
      });
    }
  }

  public async apiKeyAuthView(req: Request, res: Response) {
    const token = req.params['token'];

    if (!token) {
      return res.render('error', {
        code: ErrorCode.BadRequest,
        message: 'Invalid link token',
      });
    }

    const linkToken = await linkTokenService.getLinkTokenById(token);

    if (!linkToken) {
      return res.render('error', {
        code: ErrorCode.BadRequest,
        message: 'Invalid link token',
      });
    }

    const activityId = await activityService.findActivityIdByLinkToken(linkToken.id);

    await activityService.createActivityLog(activityId, {
      timestamp: now(),
      level: LogLevel.Info,
      message: `User viewed API key input screen`,
    });

    try {
      if (linkToken.expires_at < now()) {
        const errorMessage = 'Link token expired';

        await activityService.createActivityLog(activityId, {
          timestamp: now(),
          level: LogLevel.Error,
          message: errorMessage,
        });

        return res.render('error', {
          code: ErrorCode.BadRequest,
          message: errorMessage,
        });
      } else if (!linkToken.consent_given) {
        const errorMessage = 'Consent bypassed';

        await activityService.createActivityLog(activityId, {
          timestamp: now(),
          level: LogLevel.Error,
          message: errorMessage,
        });

        return res.render('error', {
          code: ErrorCode.BadRequest,
          message: errorMessage,
        });
      } else if (!linkToken.integration_provider) {
        await activityService.createActivityLog(activityId, {
          timestamp: now(),
          level: LogLevel.Error,
          message: 'Integration provider missing from link token',
        });

        return res.render('error', {
          code: ErrorCode.BadRequest,
          message: 'Please choose an integration',
        });
      }

      res.render('api-key', {
        server_url: getServerUrl(),
        link_token: token,
        integration: {
          provider: linkToken.integration_provider,
        },
      });
    } catch (err) {
      await errorService.reportError(err);

      await activityService.createActivityLog(activityId, {
        timestamp: now(),
        level: LogLevel.Error,
        message: 'Internal server error',
      });

      return res.render('error', {
        code: ErrorCode.InternalServerError,
        message: DEFAULT_ERROR_MESSAGE,
      });
    }
  }

  public async upsertApiKey(req: Request, res: Response) {
    const token = req.params['token'];
    const apiKey = req.body['key'];

    if (!token) {
      return res.render('error', {
        code: ErrorCode.BadRequest,
        message: 'Invalid link token',
      });
    }

    const linkToken = await linkTokenService.getLinkTokenById(token);

    if (!linkToken) {
      return res.render('error', {
        code: ErrorCode.BadRequest,
        message: 'Invalid link token',
      });
    }

    const activityId = await activityService.findActivityIdByLinkToken(linkToken.id);

    try {
      if (!apiKey || typeof apiKey !== 'string') {
        const errorMessage = 'API key missing or invalid';

        await activityService.createActivityLog(activityId, {
          timestamp: now(),
          level: LogLevel.Error,
          message: errorMessage,
        });

        return res.render('error', {
          code: ErrorCode.BadRequest,
          message: errorMessage,
        });
      }

      if (linkToken.expires_at < now()) {
        const errorMessage = 'Link token expired';

        await activityService.createActivityLog(activityId, {
          timestamp: now(),
          level: LogLevel.Error,
          message: errorMessage,
        });

        return res.render('error', {
          code: ErrorCode.BadRequest,
          message: errorMessage,
        });
      } else if (!linkToken.consent_given) {
        const errorMessage = 'Consent bypassed';

        await activityService.createActivityLog(activityId, {
          timestamp: now(),
          level: LogLevel.Error,
          message: errorMessage,
        });

        return res.render('error', {
          code: ErrorCode.BadRequest,
          message: errorMessage,
        });
      } else if (!linkToken.integration_provider) {
        await activityService.createActivityLog(activityId, {
          timestamp: now(),
          level: LogLevel.Error,
          message: 'Integration provider missing from link token',
        });

        return res.render('error', {
          code: ErrorCode.BadRequest,
          message: 'Please choose an integration',
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

      res.redirect(`${getServerUrl()}/link/finish`);
    } catch (err) {
      await errorService.reportError(err);

      await activityService.createActivityLog(activityId, {
        timestamp: now(),
        level: LogLevel.Error,
        message: 'Internal server error',
      });

      return res.render('error', {
        code: ErrorCode.InternalServerError,
        message: DEFAULT_ERROR_MESSAGE,
      });
    }
  }

  public async basicAuthView(req: Request, res: Response) {
    const token = req.params['token'];

    if (!token) {
      return res.render('error', {
        code: ErrorCode.BadRequest,
        message: 'Invalid link token',
      });
    }

    const linkToken = await linkTokenService.getLinkTokenById(token);

    if (!linkToken) {
      return res.render('error', {
        code: ErrorCode.BadRequest,
        message: 'Invalid link token',
      });
    }

    const activityId = await activityService.findActivityIdByLinkToken(linkToken.id);

    await activityService.createActivityLog(activityId, {
      timestamp: now(),
      level: LogLevel.Info,
      message: `User viewed username/password input screen`,
    });

    try {
      if (linkToken.expires_at < now()) {
        const errorMessage = 'Link token expired';

        await activityService.createActivityLog(activityId, {
          timestamp: now(),
          level: LogLevel.Error,
          message: errorMessage,
        });

        return res.render('error', {
          code: ErrorCode.BadRequest,
          message: errorMessage,
        });
      } else if (!linkToken.consent_given) {
        const errorMessage = 'Consent bypassed';

        await activityService.createActivityLog(activityId, {
          timestamp: now(),
          level: LogLevel.Error,
          message: errorMessage,
        });

        return res.render('error', {
          code: ErrorCode.BadRequest,
          message: errorMessage,
        });
      } else if (!linkToken.integration_provider) {
        await activityService.createActivityLog(activityId, {
          timestamp: now(),
          level: LogLevel.Error,
          message: 'Integration provider missing from link token',
        });

        return res.render('error', {
          code: ErrorCode.BadRequest,
          message: 'Please choose an integration',
        });
      }

      res.render('basic', {
        server_url: getServerUrl(),
        link_token: token,
        integration: {
          provider: linkToken.integration_provider,
        },
      });
    } catch (err) {
      await errorService.reportError(err);

      await activityService.createActivityLog(activityId, {
        timestamp: now(),
        level: LogLevel.Error,
        message: 'Internal server error',
      });

      return res.render('error', {
        code: ErrorCode.InternalServerError,
        message: DEFAULT_ERROR_MESSAGE,
      });
    }
  }

  public async upsertBasic(req: Request, res: Response) {
    const token = req.params['token'];
    const username = req.body['username'];
    const password = req.body['password'];

    if (!token) {
      return res.render('error', {
        code: ErrorCode.BadRequest,
        message: 'Invalid link token',
      });
    }

    const linkToken = await linkTokenService.getLinkTokenById(token);

    if (!linkToken) {
      return res.render('error', {
        code: ErrorCode.BadRequest,
        message: 'Invalid link token',
      });
    }

    const activityId = await activityService.findActivityIdByLinkToken(linkToken.id);

    try {
      if (!username || typeof username !== 'string') {
        const errorMessage = 'Username missing or invalid';

        await activityService.createActivityLog(activityId, {
          timestamp: now(),
          level: LogLevel.Error,
          message: errorMessage,
        });

        return res.render('error', {
          code: ErrorCode.BadRequest,
          message: errorMessage,
        });
      } else if (!password || typeof password !== 'string') {
        const errorMessage = 'Password missing or invalid';

        await activityService.createActivityLog(activityId, {
          timestamp: now(),
          level: LogLevel.Error,
          message: errorMessage,
        });

        return res.render('error', {
          code: ErrorCode.BadRequest,
          message: errorMessage,
        });
      }

      if (linkToken.expires_at < now()) {
        const errorMessage = 'Link token expired';

        await activityService.createActivityLog(activityId, {
          timestamp: now(),
          level: LogLevel.Error,
          message: errorMessage,
        });

        return res.render('error', {
          code: ErrorCode.BadRequest,
          message: errorMessage,
        });
      } else if (!linkToken.consent_given) {
        const errorMessage = 'Consent bypassed';

        await activityService.createActivityLog(activityId, {
          timestamp: now(),
          level: LogLevel.Error,
          message: errorMessage,
        });

        return res.render('error', {
          code: ErrorCode.BadRequest,
          message: errorMessage,
        });
      } else if (!linkToken.integration_provider) {
        await activityService.createActivityLog(activityId, {
          timestamp: now(),
          level: LogLevel.Error,
          message: 'Integration provider missing from link token',
        });

        return res.render('error', {
          code: ErrorCode.BadRequest,
          message: 'Please choose an integration',
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

      res.redirect(`${getServerUrl()}/link/finish`);
    } catch (err) {
      await errorService.reportError(err);

      await activityService.createActivityLog(activityId, {
        timestamp: now(),
        level: LogLevel.Error,
        message: 'Internal server error',
      });

      return res.render('error', {
        code: ErrorCode.InternalServerError,
        message: DEFAULT_ERROR_MESSAGE,
      });
    }
  }

  public async finishView(req: Request, res: Response) {
    res.render('finish');
  }
}

export default new LinkController();
