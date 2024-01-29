import { Environment } from '@prisma/client';
import { Request, Response } from 'express';
import environmentService from '../services/environment.service';
import errorService, { ErrorCode } from '../services/error.service';
import { DEFAULT_ERROR_MESSAGE, ENVIRONMENT_ID_LOCALS_KEY } from '../utils/constants';
import { now } from '../utils/helpers';

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
      const { enable_new_integrations } = req.body;

      const data: Partial<Environment> = {
        updated_at: now(),
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
