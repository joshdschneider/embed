import {
  DEFAULT_ERROR_MESSAGE,
  ErrorCode,
  database,
  errorService,
  now,
  providerService,
} from '@kit/shared';
import type { Request, Response } from 'express';

class JobsController {
  public async addProvider(req: Request, res: Response) {
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

      const all = await database.environment.findMany({
        include: { integrations: { select: { unique_key: true } } },
      });

      const environments = all.filter((env) => env.enable_new_integrations === true);

      const result = await database.$transaction(
        environments.map((environment) => {
          return database.integration.create({
            data: {
              unique_key: existingProvider.unique_key,
              name: existingProvider.name,
              environment_id: environment.id,
              is_enabled: true,
              use_oauth_credentials: false,
              rank: environment.integrations.length + 1,
              created_at: now(),
              updated_at: now(),
            },
          });
        })
      );

      res.status(200).json({
        object: 'environment',
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
