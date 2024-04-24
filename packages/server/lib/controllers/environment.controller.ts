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
import environmentHook from '../hooks/environment.hook';

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

      const {
        enable_new_integrations,
        multimodal_enabled_by_default,
        default_text_embedding_model,
        default_multimodal_embedding_model,
        branding,
      } = req.body;

      const changedKeys: string[] = [];

      const data: Partial<Environment> = {
        updated_at: now(),
      };

      if (typeof enable_new_integrations === 'boolean') {
        data.enable_new_integrations = enable_new_integrations;
      }

      if (
        typeof multimodal_enabled_by_default === 'boolean' &&
        currentEnvironment.multimodal_enabled_by_default !== multimodal_enabled_by_default
      ) {
        data.multimodal_enabled_by_default = multimodal_enabled_by_default;
        changedKeys.push('multimodal_enabled_by_default');
      }

      if (
        default_text_embedding_model &&
        typeof default_text_embedding_model === 'string' &&
        currentEnvironment.default_text_embedding_model !== default_text_embedding_model
      ) {
        data.default_text_embedding_model = default_text_embedding_model;
        changedKeys.push('default_text_embedding_model');
      }

      if (
        default_multimodal_embedding_model &&
        typeof default_multimodal_embedding_model === 'string' &&
        currentEnvironment.default_multimodal_embedding_model !== default_multimodal_embedding_model
      ) {
        data.default_multimodal_embedding_model = default_multimodal_embedding_model;
        changedKeys.push('default_multimodal_embedding_model');
      }

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

      if (changedKeys.length > 0) {
        environmentHook.environmentUpdated(environment, changedKeys);
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
