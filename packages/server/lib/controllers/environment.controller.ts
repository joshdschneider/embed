import type { Environment } from '@embed/shared';
import {
  DEFAULT_ERROR_MESSAGE,
  ENVIRONMENT_ID_LOCALS_KEY,
  ErrorCode,
  environmentService,
  errorService,
  now,
} from '@embed/shared';
import type { Request, Response } from 'express';

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
      const currentEnvironment = await environmentService.getEnvironmentById(environmentId);
      if (!currentEnvironment) {
        return errorService.errorResponse(res, {
          code: ErrorCode.NotFound,
          message: 'Environment not found',
        });
      }

      const { branding } = req.body;
      const data: Partial<Environment> = {
        updated_at: now(),
      };

      if (branding && typeof branding === 'object') {
        data.branding = branding;
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
