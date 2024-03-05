import { AuthScheme, ProviderSpecification } from '@kit/providers';
import type { Integration } from '@kit/shared';
import {
  DEFAULT_ERROR_MESSAGE,
  ENVIRONMENT_ID_LOCALS_KEY,
  ErrorCode,
  errorService,
  integrationService,
  now,
  providerService,
} from '@kit/shared';
import type { Request, Response } from 'express';
import { zodError } from '../utils/helpers';
import { IntegrationObject, UpdateIntegrationRequestSchema } from '../utils/types';

class IntegrationController {
  public async listIntegrations(req: Request, res: Response) {
    try {
      const environmentId = res.locals[ENVIRONMENT_ID_LOCALS_KEY];

      const [integrations, providers] = await Promise.all([
        integrationService.listIntegrations(environmentId),
        providerService.listProviders(),
      ]);

      if (!integrations || !providers) {
        return errorService.errorResponse(res, {
          code: ErrorCode.InternalServerError,
          message: DEFAULT_ERROR_MESSAGE,
        });
      }

      const providerKeys = providers.map((p) => p.unique_key);
      const filteredIntegrations = integrations.filter((i) => providerKeys.includes(i.unique_key));

      const IntegrationObjects: IntegrationObject[] = filteredIntegrations.map((i) => {
        const p = providers.find((p) => p.unique_key === i.unique_key) as ProviderSpecification;
        return {
          object: 'integration',
          unique_key: i.unique_key,
          name: p.name,
          logo_url: p.logo_url,
          logo_url_dark_mode: p.logo_url_dark_mode,
          is_enabled: i.is_enabled,
          rank: i.rank,
          auth_scheme: p.auth.scheme,
          use_oauth_credentials: i.use_oauth_credentials,
          oauth_client_id: i.oauth_client_id,
          oauth_client_secret: i.oauth_client_secret,
        };
      });

      res.status(200).json({ object: 'list', data: IntegrationObjects });
    } catch (err) {
      await errorService.reportError(err);

      return errorService.errorResponse(res, {
        code: ErrorCode.InternalServerError,
        message: DEFAULT_ERROR_MESSAGE,
      });
    }
  }

  public async retrieveIntegration(req: Request, res: Response) {
    try {
      const environmentId = res.locals[ENVIRONMENT_ID_LOCALS_KEY];
      const integrationKey = req.params['integration_key'];

      if (!integrationKey) {
        return errorService.errorResponse(res, {
          code: ErrorCode.BadRequest,
          message: 'Integration unique key missing',
        });
      }

      const integration = await integrationService.getIntegrationByKey(
        integrationKey,
        environmentId
      );

      if (!integration) {
        return errorService.errorResponse(res, {
          code: ErrorCode.NotFound,
          message: 'Integration not found',
        });
      }

      const provider = await providerService.getProviderSpec(integrationKey);

      if (!provider) {
        return errorService.errorResponse(res, {
          code: ErrorCode.InternalServerError,
          message: `Provider specification not found for integration ${integrationKey}`,
        });
      }

      const integrationObject: IntegrationObject = {
        object: 'integration',
        unique_key: integration.unique_key,
        name: provider.name,
        logo_url: provider.logo_url,
        logo_url_dark_mode: provider.logo_url_dark_mode,
        is_enabled: integration.is_enabled,
        auth_scheme: provider.auth.scheme,
        use_oauth_credentials: integration.use_oauth_credentials,
        oauth_client_id: integration.oauth_client_id,
        oauth_client_secret: integration.oauth_client_secret,
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

  public async enableIntegration(req: Request, res: Response) {
    try {
      const environmentId = res.locals[ENVIRONMENT_ID_LOCALS_KEY];
      const integrationKey = req.params['integration_key'];

      if (!integrationKey) {
        return errorService.errorResponse(res, {
          code: ErrorCode.BadRequest,
          message: 'Integration unique key missing',
        });
      }

      const provider = await providerService.getProviderSpec(integrationKey);

      if (!provider) {
        return errorService.errorResponse(res, {
          code: ErrorCode.InternalServerError,
          message: `Provider specification not found for integration ${integrationKey}`,
        });
      }

      const updatedIntegration = await integrationService.updateIntegration(
        integrationKey,
        environmentId,
        { is_enabled: true }
      );

      if (!updatedIntegration) {
        return errorService.errorResponse(res, {
          code: ErrorCode.InternalServerError,
          message: DEFAULT_ERROR_MESSAGE,
        });
      }

      const integrationObject: IntegrationObject = {
        object: 'integration',
        unique_key: updatedIntegration.unique_key,
        name: provider.name,
        logo_url: provider.logo_url,
        logo_url_dark_mode: provider.logo_url_dark_mode,
        is_enabled: updatedIntegration.is_enabled,
        auth_scheme: provider.auth.scheme,
        use_oauth_credentials: updatedIntegration.use_oauth_credentials,
        oauth_client_id: updatedIntegration.oauth_client_id,
        oauth_client_secret: updatedIntegration.oauth_client_secret,
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
      const environmentId = res.locals[ENVIRONMENT_ID_LOCALS_KEY];
      const integrationKey = req.params['integration_key'];

      if (!integrationKey) {
        return errorService.errorResponse(res, {
          code: ErrorCode.BadRequest,
          message: 'Integration unique key missing',
        });
      }

      const provider = await providerService.getProviderSpec(integrationKey);

      if (!provider) {
        return errorService.errorResponse(res, {
          code: ErrorCode.InternalServerError,
          message: `Provider specification not found for integration ${integrationKey}`,
        });
      }

      const updatedIntegration = await integrationService.updateIntegration(
        integrationKey,
        environmentId,
        { is_enabled: false }
      );

      if (!updatedIntegration) {
        return errorService.errorResponse(res, {
          code: ErrorCode.InternalServerError,
          message: DEFAULT_ERROR_MESSAGE,
        });
      }

      const integrationObject: IntegrationObject = {
        object: 'integration',
        unique_key: updatedIntegration.unique_key,
        name: provider.name,
        logo_url: provider.logo_url,
        logo_url_dark_mode: provider.logo_url_dark_mode,
        is_enabled: updatedIntegration.is_enabled,
        auth_scheme: provider.auth.scheme,
        use_oauth_credentials: updatedIntegration.use_oauth_credentials,
        oauth_client_id: updatedIntegration.oauth_client_id,
        oauth_client_secret: updatedIntegration.oauth_client_secret,
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
      const environmentId = res.locals[ENVIRONMENT_ID_LOCALS_KEY];
      const integrationKey = req.params['integration_key'];

      if (!integrationKey) {
        return errorService.errorResponse(res, {
          code: ErrorCode.BadRequest,
          message: 'Integration unique key missing',
        });
      }

      const providerSpec = await providerService.getProviderSpec(integrationKey);

      if (!providerSpec) {
        return errorService.errorResponse(res, {
          code: ErrorCode.BadRequest,
          message: `Provider specification not found for integration ${integrationKey}`,
        });
      }

      const parsedBody = UpdateIntegrationRequestSchema.safeParse(req.body);

      if (!parsedBody.success) {
        return errorService.errorResponse(res, {
          code: ErrorCode.BadRequest,
          message: zodError(parsedBody.error),
        });
      }

      const { use_oauth_credentials, oauth_client_id, oauth_client_secret } = parsedBody.data;
      const isOauth = providerSpec.auth.scheme === AuthScheme.OAuth2 || AuthScheme.OAuth1;

      if (!isOauth && use_oauth_credentials) {
        return errorService.errorResponse(res, {
          code: ErrorCode.BadRequest,
          message: 'OAuth credentials not supported',
        });
      }

      const data: Partial<Integration> = { updated_at: now() };

      if (typeof use_oauth_credentials === 'boolean') {
        data.use_oauth_credentials = use_oauth_credentials;
      }

      if (typeof oauth_client_id !== 'undefined') {
        data.oauth_client_id = oauth_client_id;
      }

      if (typeof oauth_client_secret !== 'undefined') {
        data.oauth_client_secret = oauth_client_secret;
      }

      const updatedIntegration = await integrationService.updateIntegration(
        integrationKey,
        environmentId,
        { ...data }
      );

      if (!updatedIntegration) {
        return errorService.errorResponse(res, {
          code: ErrorCode.InternalServerError,
          message: DEFAULT_ERROR_MESSAGE,
        });
      }

      const integrationObject: IntegrationObject = {
        object: 'integration',
        unique_key: updatedIntegration.unique_key,
        name: providerSpec.name,
        logo_url: providerSpec.logo_url,
        logo_url_dark_mode: providerSpec.logo_url_dark_mode,
        is_enabled: updatedIntegration.is_enabled,
        auth_scheme: providerSpec.auth.scheme,
        use_oauth_credentials: updatedIntegration.use_oauth_credentials,
        oauth_client_id: updatedIntegration.oauth_client_id,
        oauth_client_secret: updatedIntegration.oauth_client_secret,
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

  public async rerankIntegrations(req: Request, res: Response) {
    try {
      const environmentId = res.locals[ENVIRONMENT_ID_LOCALS_KEY];
      const integrations = req.body['integrations'];

      if (!integrations || !Array.isArray(integrations)) {
        return errorService.errorResponse(res, {
          code: ErrorCode.BadRequest,
          message: 'Invalid request payload',
        });
      }

      const count = await integrationService.rerankIntegrations(environmentId, integrations);

      if (!count) {
        return errorService.errorResponse(res, {
          code: ErrorCode.InternalServerError,
          message: DEFAULT_ERROR_MESSAGE,
        });
      }

      res.status(200).json({ object: 'integration', updated: count });
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
