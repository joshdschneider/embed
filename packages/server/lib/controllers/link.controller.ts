import { AuthScheme, ProviderSpecification } from '@beta/providers';
import { Integration } from '@prisma/client';
import { Request, Response } from 'express';
import errorService, { ErrorCode } from '../services/error.service';
import integrationService from '../services/integration.service';
import linkTokenService from '../services/linkToken.service';
import linkedAccountService from '../services/linkedAccount.service';
import providerService from '../services/provider.service';
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

    if (!token) {
      return errorService.errorResponse(res, {
        code: ErrorCode.BadRequest,
        message: 'Invalid link token',
      });
    }

    try {
      const linkToken = await linkTokenService.getLinkTokenById(token);

      if (!linkToken) {
        return errorService.errorResponse(res, {
          code: ErrorCode.BadRequest,
          message: 'Invalid link token',
        });
      }

      if (linkToken.expires_at < now()) {
        return errorService.errorResponse(res, {
          code: ErrorCode.BadRequest,
          message: 'Link token expired',
        });
      }

      const integrations = await integrationService.listIntegrations(linkToken.environment_id);

      if (!integrations) {
        return errorService.errorResponse(res, {
          code: ErrorCode.InternalServerError,
          message: DEFAULT_ERROR_MESSAGE,
        });
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

      res.render('list', {
        server_url: getServerUrl(),
        link_token: token,
        integrations: integrationsList,
      });
    } catch (err) {
      await errorService.reportError(err);

      return errorService.errorResponse(res, {
        code: ErrorCode.InternalServerError,
        message: DEFAULT_ERROR_MESSAGE,
      });
    }
  }

  public async consentView(req: Request, res: Response) {
    const token = req.params['token'];
    const integrationProvider = req.params['integration'];

    if (!token) {
      return errorService.errorResponse(res, {
        code: ErrorCode.BadRequest,
        message: 'Invalid link token',
      });
    }

    if (!integrationProvider) {
      return errorService.errorResponse(res, {
        code: ErrorCode.BadRequest,
        message: 'Missing integration provider',
      });
    }

    try {
      const linkToken = await linkTokenService.getLinkTokenById(token);

      if (!linkToken) {
        return errorService.errorResponse(res, {
          code: ErrorCode.BadRequest,
          message: 'Invalid link token',
        });
      }

      if (linkToken.expires_at < now()) {
        return errorService.errorResponse(res, {
          code: ErrorCode.BadRequest,
          message: 'Link token expired',
        });
      }

      const integration = await integrationService.getIntegrationByProvider(
        integrationProvider,
        linkToken.environment_id
      );

      if (!integration) {
        return errorService.errorResponse(res, {
          code: ErrorCode.BadRequest,
          message: 'Invalid integration',
        });
      } else if (!integration.is_enabled) {
        return errorService.errorResponse(res, {
          code: ErrorCode.BadRequest,
          message: 'Integration is disabled',
        });
      }

      const providerSpec = await providerService.getProviderSpec(integration.provider);

      if (!providerSpec) {
        throw new Error(`Provider specification not found for ${integration.provider}`);
      }

      res.render('consent', {
        server_url: getServerUrl(),
        link_token: token,
        client_name: 'CLIENT_NAME',
        integration: {
          provider: integration.provider,
          display_name: providerSpec.display_name,
          logo_url: providerSpec.logo_url,
        },
      });
    } catch (err) {
      await errorService.reportError(err);

      return errorService.errorResponse(res, {
        code: ErrorCode.InternalServerError,
        message: DEFAULT_ERROR_MESSAGE,
      });
    }
  }

  public async saveConsent(req: Request, res: Response) {
    const token = req.params['token'];
    const provider = req.params['integration'];

    if (!token) {
      return errorService.errorResponse(res, {
        code: ErrorCode.BadRequest,
        message: 'Invalid link token',
      });
    }

    if (!provider) {
      return errorService.errorResponse(res, {
        code: ErrorCode.BadRequest,
        message: 'Missing integration provider',
      });
    }

    try {
      const linkToken = await linkTokenService.getLinkTokenById(token);

      if (!linkToken) {
        return errorService.errorResponse(res, {
          code: ErrorCode.BadRequest,
          message: 'Invalid link token',
        });
      } else if (linkToken.expires_at < now()) {
        return errorService.errorResponse(res, {
          code: ErrorCode.BadRequest,
          message: 'Link token expired',
        });
      }

      const integration = await integrationService.getIntegrationByProvider(
        provider,
        linkToken.environment_id
      );

      if (!integration) {
        return errorService.errorResponse(res, {
          code: ErrorCode.BadRequest,
          message: 'Invalid integration',
        });
      } else if (!integration.is_enabled) {
        return errorService.errorResponse(res, {
          code: ErrorCode.BadRequest,
          message: 'Integration is disabled',
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
        return errorService.errorResponse(res, {
          code: ErrorCode.InternalServerError,
          message: DEFAULT_ERROR_MESSAGE,
        });
      }

      const providerSpec = await providerService.getProviderSpec(integration.provider);

      if (!providerSpec) {
        throw new Error(`Provider specification not found for ${integration.provider}`);
      }

      const authScheme = providerSpec.auth.scheme;
      const baseUrl = `${getServerUrl()}/link/${token}`;

      switch (authScheme) {
        case AuthScheme.OAUTH1:
        case AuthScheme.OAUTH2:
          return res.redirect(`${baseUrl}/oauth`);
        case AuthScheme.API_KEY:
          return res.redirect(`${baseUrl}/api-key`);
        case AuthScheme.BASIC:
          return res.redirect(`${baseUrl}/basic`);
        case AuthScheme.NONE:
          const response = await linkedAccountService.upsertLinkedAccount({
            id: generateId(Resource.LinkedAccount),
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

          if (!response.success) {
            return errorService.errorResponse(res, {
              code: ErrorCode.InternalServerError,
              message: DEFAULT_ERROR_MESSAGE,
            });
          }

          if (response.action === 'updated') {
            // TODO: sync index
          }

          await linkTokenService.deleteLinkToken(linkToken.id);
          return res.redirect(`${baseUrl}/finish`);
        default:
          throw new Error(
            `Unsupported auth scheme ${authScheme} for provider ${providerSpec.slug}`
          );
      }
    } catch (err) {
      await errorService.reportError(err);

      return errorService.errorResponse(res, {
        code: ErrorCode.InternalServerError,
        message: DEFAULT_ERROR_MESSAGE,
      });
    }
  }

  public async oauthView(req: Request, res: Response) {
    const token = req.params['token'];

    if (!token) {
      return errorService.errorResponse(res, {
        code: ErrorCode.BadRequest,
        message: 'Invalid link token',
      });
    }

    try {
      const linkToken = await linkTokenService.getLinkTokenById(token);

      if (!linkToken) {
        return errorService.errorResponse(res, {
          code: ErrorCode.BadRequest,
          message: 'Invalid link token',
        });
      } else if (linkToken.expires_at < now()) {
        return errorService.errorResponse(res, {
          code: ErrorCode.BadRequest,
          message: 'Link token expired',
        });
      } else if (!linkToken.consent_given) {
        return errorService.errorResponse(res, {
          code: ErrorCode.BadRequest,
          message: 'Consent not given',
        });
      } else if (!linkToken.integration_provider) {
        return errorService.errorResponse(res, {
          code: ErrorCode.BadRequest,
          message: 'Missing integration provider',
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
        return errorService.errorResponse(res, {
          code: ErrorCode.BadRequest,
          message: 'Invalid auth scheme',
        });
      }

      const authorizationUrlKeys = extractConfigurationKeys(providerSpec.auth.authorization_url);
      const tokenUrlKeys = extractConfigurationKeys(providerSpec.auth.token_url);
      const keys = [...new Set([...authorizationUrlKeys, ...tokenUrlKeys])];

      if (keys.length > 0) {
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

      return errorService.errorResponse(res, {
        code: ErrorCode.InternalServerError,
        message: DEFAULT_ERROR_MESSAGE,
      });
    }
  }

  public async upsertOauthConfig(req: Request, res: Response) {
    const token = req.params['token'];
    const config = req.body;

    if (!token) {
      return errorService.errorResponse(res, {
        code: ErrorCode.BadRequest,
        message: 'Invalid link token',
      });
    }

    if (!config || typeof config !== 'object') {
      return errorService.errorResponse(res, {
        code: ErrorCode.BadRequest,
        message: 'Invalid configuration',
      });
    }

    try {
      const linkToken = await linkTokenService.getLinkTokenById(token);

      if (!linkToken) {
        return errorService.errorResponse(res, {
          code: ErrorCode.BadRequest,
          message: 'Invalid link token',
        });
      } else if (linkToken.expires_at < now()) {
        return errorService.errorResponse(res, {
          code: ErrorCode.BadRequest,
          message: 'Link token expired',
        });
      } else if (!linkToken.consent_given) {
        return errorService.errorResponse(res, {
          code: ErrorCode.BadRequest,
          message: 'Consent not given',
        });
      } else if (!linkToken.integration_provider) {
        return errorService.errorResponse(res, {
          code: ErrorCode.BadRequest,
          message: 'Missing integration provider',
        });
      }

      const updatedLinkToken = await linkTokenService.updateLinkToken(
        linkToken.id,
        linkToken.environment_id,
        { configuration: config }
      );

      if (!updatedLinkToken) {
        return errorService.errorResponse(res, {
          code: ErrorCode.InternalServerError,
          message: DEFAULT_ERROR_MESSAGE,
        });
      }

      res.redirect(`${getServerUrl()}/oauth/authorize?token=${token}`);
    } catch (err) {
      await errorService.reportError(err);

      return errorService.errorResponse(res, {
        code: ErrorCode.InternalServerError,
        message: DEFAULT_ERROR_MESSAGE,
      });
    }
  }

  public async apiKeyAuthView(req: Request, res: Response) {
    const token = req.params['token'];

    if (!token) {
      return errorService.errorResponse(res, {
        code: ErrorCode.BadRequest,
        message: 'Invalid link token',
      });
    }

    try {
      const linkToken = await linkTokenService.getLinkTokenById(token);

      if (!linkToken) {
        return errorService.errorResponse(res, {
          code: ErrorCode.BadRequest,
          message: 'Invalid link token',
        });
      } else if (linkToken.expires_at < now()) {
        return errorService.errorResponse(res, {
          code: ErrorCode.BadRequest,
          message: 'Link token expired',
        });
      } else if (!linkToken.consent_given) {
        return errorService.errorResponse(res, {
          code: ErrorCode.BadRequest,
          message: 'Consent not given',
        });
      } else if (!linkToken.integration_provider) {
        return errorService.errorResponse(res, {
          code: ErrorCode.BadRequest,
          message: 'Missing integration provider',
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

      return errorService.errorResponse(res, {
        code: ErrorCode.InternalServerError,
        message: DEFAULT_ERROR_MESSAGE,
      });
    }
  }

  public async upsertApiKey(req: Request, res: Response) {
    const token = req.params['token'];
    const apiKey = req.body['key'];

    if (!token) {
      return errorService.errorResponse(res, {
        code: ErrorCode.BadRequest,
        message: 'Invalid link token',
      });
    }

    if (!apiKey || typeof apiKey !== 'string') {
      return errorService.errorResponse(res, {
        code: ErrorCode.BadRequest,
        message: 'Invalid API key',
      });
    }

    try {
      const linkToken = await linkTokenService.getLinkTokenById(token);

      if (!linkToken) {
        return errorService.errorResponse(res, {
          code: ErrorCode.BadRequest,
          message: 'Invalid link token',
        });
      } else if (linkToken.expires_at < now()) {
        return errorService.errorResponse(res, {
          code: ErrorCode.BadRequest,
          message: 'Link token expired',
        });
      } else if (!linkToken.consent_given) {
        return errorService.errorResponse(res, {
          code: ErrorCode.BadRequest,
          message: 'Consent not given',
        });
      } else if (!linkToken.integration_provider) {
        return errorService.errorResponse(res, {
          code: ErrorCode.BadRequest,
          message: 'Missing integration provider',
        });
      }

      const response = await linkedAccountService.upsertLinkedAccount({
        id: generateId(Resource.LinkedAccount),
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

      if (!response.success) {
        return errorService.errorResponse(res, {
          code: ErrorCode.InternalServerError,
          message: DEFAULT_ERROR_MESSAGE,
        });
      }

      if (response.action === 'updated') {
        // TODO: sync index
      }

      await linkTokenService.deleteLinkToken(linkToken.id);

      res.redirect(`${getServerUrl()}/link/finish`);
    } catch (err) {
      await errorService.reportError(err);

      return errorService.errorResponse(res, {
        code: ErrorCode.InternalServerError,
        message: DEFAULT_ERROR_MESSAGE,
      });
    }
  }

  public async basicAuthView(req: Request, res: Response) {
    const token = req.params['token'];

    if (!token) {
      return errorService.errorResponse(res, {
        code: ErrorCode.BadRequest,
        message: 'Invalid link token',
      });
    }

    try {
      const linkToken = await linkTokenService.getLinkTokenById(token);

      if (!linkToken) {
        return errorService.errorResponse(res, {
          code: ErrorCode.BadRequest,
          message: 'Invalid link token',
        });
      } else if (linkToken.expires_at < now()) {
        return errorService.errorResponse(res, {
          code: ErrorCode.BadRequest,
          message: 'Link token expired',
        });
      } else if (!linkToken.consent_given) {
        return errorService.errorResponse(res, {
          code: ErrorCode.BadRequest,
          message: 'Consent not given',
        });
      } else if (!linkToken.integration_provider) {
        return errorService.errorResponse(res, {
          code: ErrorCode.BadRequest,
          message: 'Missing integration provider',
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

      return errorService.errorResponse(res, {
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
      return errorService.errorResponse(res, {
        code: ErrorCode.BadRequest,
        message: 'Invalid link token',
      });
    }

    if (!username || typeof username !== 'string') {
      return errorService.errorResponse(res, {
        code: ErrorCode.BadRequest,
        message: 'Invalid username',
      });
    } else if (!password || typeof password !== 'string') {
      return errorService.errorResponse(res, {
        code: ErrorCode.BadRequest,
        message: 'Invalid password',
      });
    }

    try {
      const linkToken = await linkTokenService.getLinkTokenById(token);

      if (!linkToken) {
        return errorService.errorResponse(res, {
          code: ErrorCode.BadRequest,
          message: 'Invalid link token',
        });
      } else if (linkToken.expires_at < now()) {
        return errorService.errorResponse(res, {
          code: ErrorCode.BadRequest,
          message: 'Link token expired',
        });
      } else if (!linkToken.consent_given) {
        return errorService.errorResponse(res, {
          code: ErrorCode.BadRequest,
          message: 'Consent not given',
        });
      } else if (!linkToken.integration_provider) {
        return errorService.errorResponse(res, {
          code: ErrorCode.BadRequest,
          message: 'Missing integration provider',
        });
      }

      const response = await linkedAccountService.upsertLinkedAccount({
        id: generateId(Resource.LinkedAccount),
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

      if (!response.success) {
        return errorService.errorResponse(res, {
          code: ErrorCode.InternalServerError,
          message: DEFAULT_ERROR_MESSAGE,
        });
      }

      if (response.action === 'updated') {
        // TODO: sync index
      }

      await linkTokenService.deleteLinkToken(linkToken.id);

      res.redirect(`${getServerUrl()}/link/finish`);
    } catch (err) {
      await errorService.reportError(err);

      return errorService.errorResponse(res, {
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
