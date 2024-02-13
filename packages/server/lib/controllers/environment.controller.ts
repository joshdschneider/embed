import type { Environment } from '@kit/shared';
import {
  DEFAULT_ERROR_MESSAGE,
  ENVIRONMENT_ID_LOCALS_KEY,
  ErrorCode,
  errorService,
  now,
} from '@kit/shared';
import type { Request, Response } from 'express';
import environmentService from '../services/environment.service';

class EnvironmentController {
  public async retrieveEnvironment(req: Request, res: Response) {
    try {
      const environmentId = res.locals[ENVIRONMENT_ID_LOCALS_KEY];
      const environment = await environmentService.getEnvironmentById(environmentId);

      if (!environment) {
        return errorService.errorResponse(res, {
          code: ErrorCode.NotFound,
          message: 'Environment not found',
        });
      }

      res.status(200).send({ object: 'environment', ...environment });
    } catch (err) {
      await errorService.reportError(err);

      return errorService.errorResponse(res, {
        code: ErrorCode.InternalServerError,
        message: DEFAULT_ERROR_MESSAGE,
      });
    }
  }

  public async modifyEnvironment(req: Request, res: Response) {
    try {
      const environmentId = res.locals[ENVIRONMENT_ID_LOCALS_KEY];
      const { enable_new_integrations, branding } = req.body;

      const data: Partial<Environment> = {
        updated_at: now(),
        branding,
      };

      if (typeof enable_new_integrations === 'boolean') {
        data.enable_new_integrations = enable_new_integrations;
      }

      const environment = await environmentService.updateEnvironment(environmentId, {
        ...data,
      });

      if (!environment) {
        return errorService.errorResponse(res, {
          code: ErrorCode.InternalServerError,
          message: DEFAULT_ERROR_MESSAGE,
        });
      }

      res.status(200).send({
        object: 'environment',
        ...environment,
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

export default new EnvironmentController();
