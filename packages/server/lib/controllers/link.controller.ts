import { ProviderSpecification } from '@beta/providers';
import { Integration } from '@prisma/client';
import { Request, Response } from 'express';
import errorService, { ErrorCode } from '../services/error.service';
import integrationService from '../services/integration.service';
import linkTokenService from '../services/linkToken.service';
import providerService from '../services/provider.service';
import { DEFAULT_ERROR_MESSAGE } from '../utils/constants';
import { now } from '../utils/helpers';

class LinkController {
  public async listIntegrationsView(req: Request, res: Response) {
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
          name: integration.provider_spec.display_name,
          logo: integration.provider_spec.logo_url,
        };
      });

      res.render('list', { integrations: integrationsList });
    } catch (err) {
      await errorService.reportError(err);

      return errorService.errorResponse(res, {
        code: ErrorCode.InternalServerError,
        message: DEFAULT_ERROR_MESSAGE,
      });
    }
  }

  public async linkIntegrationView(req: Request, res: Response) {
    //..
  }
}

export default new LinkController();
