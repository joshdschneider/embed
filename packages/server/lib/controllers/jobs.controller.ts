import { Request, Response } from 'express';
import errorService, { ErrorCode } from '../services/error.service';
import providerService from '../services/provider.service';
import { DEFAULT_ERROR_MESSAGE } from '../utils/constants';
import { now } from '../utils/helpers';
import { prisma } from '../utils/prisma';

class JobsController {
  public async addNewProvider(req: Request, res: Response) {
    try {
      const provider = req.body['provider'];

      if (!provider || typeof provider !== 'string') {
        return errorService.errorResponse(res, {
          code: ErrorCode.BadRequest,
          message: 'Invalid provider',
        });
      }

      const existingProvider = await providerService.getProviderSpec(provider);

      if (!existingProvider) {
        return errorService.errorResponse(res, {
          code: ErrorCode.BadRequest,
          message: 'Provider does not exist',
        });
      }

      const all = await prisma.environment.findMany({
        include: { integrations: { select: { provider: true } } },
      });

      const environments = all.filter((env) => env.enable_new_integrations === true);

      const result = await prisma.$transaction(
        environments.map((environment) => {
          return prisma.integration.create({
            data: {
              provider,
              environment_id: environment.id,
              is_enabled: true,
              use_client_credentials: false,
              oauth_client_id: null,
              oauth_client_secret: null,
              oauth_scopes: null,
              rank: environment.integrations.length + 1,
              created_at: now(),
              updated_at: now(),
              deleted_at: null,
            },
          });
        })
      );

      res.status(200).json({
        object: 'job',
        job: 'add-new-provider',
        success: true,
        updated: result.length,
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

export default new JobsController();
