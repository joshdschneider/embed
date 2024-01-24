import { AuthScheme } from '@beta/providers';
import { Integration } from '@prisma/client';
import { Request, Response } from 'express';
import errorService, { ErrorCode } from '../services/error.service';
import integrationService from '../services/integration.service';
import providerService from '../services/provider.service';
import { DEFAULT_ERROR_MESSAGE, ENVIRONMENT_ID_LOCALS_KEY } from '../utils/constants';
import { now } from '../utils/helpers';

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

      res.status(200).json({
        object: 'list',
        data: integrations,
      });
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
      const ranks = req.body['ranks'];
      if (!ranks || !Array.isArray(ranks)) {
        return errorService.errorResponse(res, {
          code: ErrorCode.BadRequest,
          message: 'Invalid ranks',
        });
      }

      const updatedIntegrations = await integrationService.rerankIntegrations(environmentId, ranks);
      if (!updatedIntegrations) {
        return errorService.errorResponse(res, {
          code: ErrorCode.InternalServerError,
          message: DEFAULT_ERROR_MESSAGE,
        });
      }

      res.status(200).json({
        object: 'list',
        data: updatedIntegrations,
      });
    } catch (err) {
      await errorService.reportError(err);

      return errorService.errorResponse(res, {
        code: ErrorCode.InternalServerError,
        message: DEFAULT_ERROR_MESSAGE,
      });
    }
  }

  public async enableAllIntegrations(req: Request, res: Response) {
    try {
      const environmentId = res.locals[ENVIRONMENT_ID_LOCALS_KEY];
      const updatedIntegrations = await integrationService.enableAllIntegrations(environmentId);
      if (!updatedIntegrations) {
        return errorService.errorResponse(res, {
          code: ErrorCode.InternalServerError,
          message: DEFAULT_ERROR_MESSAGE,
        });
      }

      res.status(200).json({ object: 'list', data: updatedIntegrations });
    } catch (err) {
      await errorService.reportError(err);

      return errorService.errorResponse(res, {
        code: ErrorCode.InternalServerError,
        message: DEFAULT_ERROR_MESSAGE,
      });
    }
  }

  public async disableAllIntegrations(req: Request, res: Response) {
    try {
      const environmentId = res.locals[ENVIRONMENT_ID_LOCALS_KEY];
      const updatedIntegrations = await integrationService.disableAllIntegrations(environmentId);
      if (!updatedIntegrations) {
        return errorService.errorResponse(res, {
          code: ErrorCode.InternalServerError,
          message: DEFAULT_ERROR_MESSAGE,
        });
      }

      res.status(200).json({ object: 'list', data: updatedIntegrations });
    } catch (err) {
      await errorService.reportError(err);

      return errorService.errorResponse(res, {
        code: ErrorCode.InternalServerError,
        message: DEFAULT_ERROR_MESSAGE,
      });
    }
  }

  public async modifyIntegration(req: Request, res: Response) {
    try {
      const environmentId = res.locals[ENVIRONMENT_ID_LOCALS_KEY];
      const provider = req.params['provider'];
      const isEnabled = req.body['is_enabled'];
      const useClientCredentials = req.body['use_client_credentials'];
      const oauthClientId = req.body['oauth_client_id'];
      const oauthClientSecret = req.body['oauth_client_secret'];
      const oauthScopes = req.body['oauth_scopes'];

      if (!provider) {
        return errorService.errorResponse(res, {
          code: ErrorCode.BadRequest,
          message: 'Integration provider missing',
        });
      }

      const providerSpec = await providerService.getProviderSpec(provider);
      if (!providerSpec) {
        return errorService.errorResponse(res, {
          code: ErrorCode.BadRequest,
          message: 'Provider specification not found',
        });
      }

      const existingIntegration = await integrationService.getIntegrationByProvider(
        provider,
        environmentId
      );

      if (!existingIntegration) {
        return errorService.errorResponse(res, {
          code: ErrorCode.NotFound,
          message: 'Integration not found',
        });
      }

      const isOauth = providerSpec.auth.scheme === AuthScheme.OAUTH2 || AuthScheme.OAUTH1;
      if (!isOauth) {
        if (oauthClientId || oauthClientSecret || oauthScopes) {
          return errorService.errorResponse(res, {
            code: ErrorCode.BadRequest,
            message: 'OAuth credentials not supported',
          });
        }
      }

      const data: Partial<Integration> = {
        updated_at: now(),
      };

      if (typeof isEnabled === 'boolean') {
        data.is_enabled = isEnabled;
      }

      if (typeof useClientCredentials === 'boolean') {
        data.use_client_credentials = useClientCredentials;
      }

      if (oauthClientId !== 'undefined') {
        data.oauth_client_id = oauthClientId;
      }

      if (oauthClientSecret !== 'undefined') {
        data.oauth_client_secret = oauthClientSecret;
      }

      if (oauthScopes !== 'undefined') {
        data.oauth_scopes = oauthScopes;
      }

      const updatedIntegration = await integrationService.updateIntegration(
        provider,
        environmentId,
        { ...data }
      );

      if (!updatedIntegration) {
        return errorService.errorResponse(res, {
          code: ErrorCode.InternalServerError,
          message: DEFAULT_ERROR_MESSAGE,
        });
      }

      res.status(200).send({
        object: 'integration',
        ...updatedIntegration,
      });
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
      const provider = req.params['provider'];
      if (!provider) {
        return errorService.errorResponse(res, {
          code: ErrorCode.BadRequest,
          message: 'Integration provider missing',
        });
      }

      const integration = await integrationService.getIntegrationByProvider(
        provider,
        environmentId
      );

      if (!integration) {
        return errorService.errorResponse(res, {
          code: ErrorCode.NotFound,
          message: 'Integration not found',
        });
      }

      res.status(200).send({
        object: 'integration',
        ...integration,
      });
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
