import { AuthScheme } from '@embed/providers';
import type { Integration } from '@embed/shared';
import {
  DEFAULT_ERROR_MESSAGE,
  ENVIRONMENT_ID_LOCALS_KEY,
  ErrorCode,
  errorService,
  integrationService,
  now,
  providerService,
} from '@embed/shared';
import type { Request, Response } from 'express';
import { zodError } from '../utils/helpers';
import {
  IntegrationObject,
  IntegrationObjectWithCredentials,
  UpdateIntegrationRequestSchema,
} from '../utils/types';

class IntegrationController {
  public async listIntegrations(req: Request, res: Response) {
    try {
      const environmentId = res.locals[ENVIRONMENT_ID_LOCALS_KEY];
      const integrations = await integrationService.listIntegrations(environmentId);
      if (!integrations) {
        return errorService.errorResponse(res, {
          code: ErrorCode.InternalServerError,
          message: DEFAULT_ERROR_MESSAGE,
        });
      }

      const providers = await providerService.listProviders();
      if (!providers) {
        return errorService.errorResponse(res, {
          code: ErrorCode.InternalServerError,
          message: DEFAULT_ERROR_MESSAGE,
        });
      }

      const integrationObjects: IntegrationObject[] = integrations.map((integration) => {
        const provider = providers.find((p) => p.unique_key === integration.provider_key);
        return {
          object: 'integration',
          id: integration.id,
          provider_key: integration.provider_key,
          logo_url: provider?.logo_url || null,
          logo_url_dark_mode: provider?.logo_url_dark_mode || null,
          display_name: integration.display_name,
          is_enabled: integration.is_enabled,
          auth_scheme: integration.auth_scheme as AuthScheme,
          created_at: integration.created_at,
          updated_at: integration.updated_at,
        };
      });

      res.status(200).json({ object: 'list', data: integrationObjects });
    } catch (err) {
      await errorService.reportError(err);

      return errorService.errorResponse(res, {
        code: ErrorCode.InternalServerError,
        message: DEFAULT_ERROR_MESSAGE,
      });
    }
  }

  public async listIntegrationConnections(req: Request, res: Response) {
    //..
  }

  public async retrieveIntegration(req: Request, res: Response) {
    try {
      const integrationId = req.params['integration_id'];
      const includeCredentials = req.query['include_credentials'] === 'true';

      if (!integrationId) {
        return errorService.errorResponse(res, {
          code: ErrorCode.BadRequest,
          message: 'Integration ID missing',
        });
      }

      const integration = await integrationService.getIntegrationById(integrationId);
      if (!integration) {
        return errorService.errorResponse(res, {
          code: ErrorCode.NotFound,
          message: 'Integration not found',
        });
      }

      const provider = await providerService.getProviderSpec(integration.provider_key);
      if (!provider) {
        return errorService.errorResponse(res, {
          code: ErrorCode.InternalServerError,
          message: `Provider specification not found for integration ${integration.provider_key}`,
        });
      }

      if (includeCredentials) {
        const integrationObject: IntegrationObject = {
          object: 'integration',
          id: integration.id,
          provider_key: integration.provider_key,
          logo_url: provider.logo_url,
          logo_url_dark_mode: provider.logo_url_dark_mode || null,
          display_name: integration.display_name,
          is_enabled: integration.is_enabled,
          auth_scheme: integration.auth_scheme as AuthScheme,
          created_at: integration.created_at,
          updated_at: integration.updated_at,
        };

        res.status(200).send(integrationObject);
      } else {
        const integrationObject: IntegrationObjectWithCredentials = {
          object: 'integration',
          id: integration.id,
          provider_key: integration.provider_key,
          logo_url: provider.logo_url,
          logo_url_dark_mode: provider.logo_url_dark_mode || null,
          display_name: integration.display_name,
          is_enabled: integration.is_enabled,
          auth_scheme: integration.auth_scheme as AuthScheme,
          is_using_test_credentials: integration.is_using_test_credentials,
          oauth_client_id: integration.oauth_client_id,
          oauth_client_secret: integration.oauth_client_secret,
          oauth_scopes: integration.oauth_scopes ? integration.oauth_scopes.split(',') : [],
          created_at: integration.created_at,
          updated_at: integration.updated_at,
        };

        res.status(200).send(integrationObject);
      }
    } catch (err) {
      await errorService.reportError(err);

      return errorService.errorResponse(res, {
        code: ErrorCode.InternalServerError,
        message: DEFAULT_ERROR_MESSAGE,
      });
    }
  }

  public async enableIntegration(req: Request, res: Response) {
    try {
      const integrationId = req.params['integration_id'];
      if (!integrationId) {
        return errorService.errorResponse(res, {
          code: ErrorCode.BadRequest,
          message: 'Integration unique key missing',
        });
      }

      const integration = await integrationService.getIntegrationById(integrationId);
      if (!integration) {
        return errorService.errorResponse(res, {
          code: ErrorCode.NotFound,
          message: 'Integration not found',
        });
      }

      const provider = await providerService.getProviderSpec(integration.provider_key);
      if (!provider) {
        return errorService.errorResponse(res, {
          code: ErrorCode.InternalServerError,
          message: `Provider specification not found for integration ${integration.provider_key}`,
        });
      }

      const updatedIntegration = await integrationService.updateIntegration(integrationId, {
        is_enabled: true,
      });

      if (!updatedIntegration) {
        return errorService.errorResponse(res, {
          code: ErrorCode.InternalServerError,
          message: DEFAULT_ERROR_MESSAGE,
        });
      }

      const integrationObject: IntegrationObject = {
        object: 'integration',
        id: updatedIntegration.id,
        provider_key: updatedIntegration.provider_key,
        display_name: updatedIntegration.display_name,
        logo_url: provider.logo_url,
        logo_url_dark_mode: provider.logo_url_dark_mode || null,
        is_enabled: updatedIntegration.is_enabled,
        auth_scheme: updatedIntegration.auth_scheme as AuthScheme,
        created_at: updatedIntegration.created_at,
        updated_at: updatedIntegration.updated_at,
      };

      res.status(200).send(integrationObject);
    } catch (err) {
      await errorService.reportError(err);

      return errorService.errorResponse(res, {
        code: ErrorCode.InternalServerError,
        message: DEFAULT_ERROR_MESSAGE,
      });
    }
  }

  public async disableIntegration(req: Request, res: Response) {
    try {
      const integrationId = req.params['integration_id'];
      if (!integrationId) {
        return errorService.errorResponse(res, {
          code: ErrorCode.BadRequest,
          message: 'Integration unique key missing',
        });
      }

      const integration = await integrationService.getIntegrationById(integrationId);
      if (!integration) {
        return errorService.errorResponse(res, {
          code: ErrorCode.NotFound,
          message: 'Integration not found',
        });
      }

      const provider = await providerService.getProviderSpec(integration.provider_key);
      if (!provider) {
        return errorService.errorResponse(res, {
          code: ErrorCode.InternalServerError,
          message: `Provider specification not found for integration ${integration.provider_key}`,
        });
      }

      const updatedIntegration = await integrationService.updateIntegration(integrationId, {
        is_enabled: false,
      });

      if (!updatedIntegration) {
        return errorService.errorResponse(res, {
          code: ErrorCode.InternalServerError,
          message: DEFAULT_ERROR_MESSAGE,
        });
      }

      const integrationObject: IntegrationObject = {
        object: 'integration',
        id: updatedIntegration.id,
        provider_key: updatedIntegration.provider_key,
        display_name: updatedIntegration.display_name,
        is_enabled: updatedIntegration.is_enabled,
        logo_url: provider.logo_url,
        logo_url_dark_mode: provider.logo_url_dark_mode || null,
        auth_scheme: updatedIntegration.auth_scheme as AuthScheme,
        created_at: updatedIntegration.created_at,
        updated_at: updatedIntegration.updated_at,
      };

      res.status(200).send(integrationObject);
    } catch (err) {
      await errorService.reportError(err);

      return errorService.errorResponse(res, {
        code: ErrorCode.InternalServerError,
        message: DEFAULT_ERROR_MESSAGE,
      });
    }
  }

  public async updateIntegration(req: Request, res: Response) {
    try {
      const integrationId = req.params['integration_id'];
      if (!integrationId) {
        return errorService.errorResponse(res, {
          code: ErrorCode.BadRequest,
          message: 'Integration unique key missing',
        });
      }

      const integration = await integrationService.getIntegrationById(integrationId);
      if (!integration) {
        return errorService.errorResponse(res, {
          code: ErrorCode.NotFound,
          message: 'Integration not found',
        });
      }

      const provider = await providerService.getProviderSpec(integration.provider_key);
      if (!provider) {
        return errorService.errorResponse(res, {
          code: ErrorCode.InternalServerError,
          message: `Provider specification not found for integration ${integration.provider_key}`,
        });
      }

      const parsedBody = UpdateIntegrationRequestSchema.safeParse(req.body);
      if (!parsedBody.success) {
        return errorService.errorResponse(res, {
          code: ErrorCode.BadRequest,
          message: zodError(parsedBody.error),
        });
      }

      const {
        name,
        is_using_test_credentials,
        oauth_client_id,
        oauth_client_secret,
        oauth_scopes,
      } = parsedBody.data;

      if (integration.auth_scheme !== AuthScheme.OAuth2) {
        return errorService.errorResponse(res, {
          code: ErrorCode.BadRequest,
          message: 'OAuth credentials not supported',
        });
      }

      const data: Partial<Integration> = { updated_at: now() };

      if (typeof is_using_test_credentials === 'boolean') {
        data.is_using_test_credentials = is_using_test_credentials;
      }

      if (typeof oauth_client_id !== 'undefined') {
        data.oauth_client_id = oauth_client_id;
      }

      if (typeof oauth_client_secret !== 'undefined') {
        data.oauth_client_secret = oauth_client_secret;
      }

      if (typeof oauth_scopes !== 'undefined') {
        data.oauth_scopes = oauth_scopes === null ? null : oauth_scopes.join(',');
      }

      const updatedIntegration = await integrationService.updateIntegration(integrationId, {
        ...data,
      });

      if (!updatedIntegration) {
        return errorService.errorResponse(res, {
          code: ErrorCode.InternalServerError,
          message: DEFAULT_ERROR_MESSAGE,
        });
      }

      const integrationObject: IntegrationObjectWithCredentials = {
        object: 'integration',
        id: updatedIntegration.id,
        provider_key: updatedIntegration.provider_key,
        display_name: updatedIntegration.display_name,
        is_enabled: updatedIntegration.is_enabled,
        logo_url: provider.logo_url,
        logo_url_dark_mode: provider.logo_url_dark_mode || null,
        auth_scheme: updatedIntegration.auth_scheme as AuthScheme,
        is_using_test_credentials: updatedIntegration.is_using_test_credentials,
        oauth_client_id: updatedIntegration.oauth_client_id,
        oauth_client_secret: updatedIntegration.oauth_client_secret,
        oauth_scopes: updatedIntegration.oauth_scopes
          ? updatedIntegration.oauth_scopes.split(',')
          : [],
        created_at: updatedIntegration.created_at,
        updated_at: updatedIntegration.updated_at,
      };

      res.status(200).send(integrationObject);
    } catch (err) {
      await errorService.reportError(err);

      return errorService.errorResponse(res, {
        code: ErrorCode.InternalServerError,
        message: DEFAULT_ERROR_MESSAGE,
      });
    }
  }
}

export default new IntegrationController();
