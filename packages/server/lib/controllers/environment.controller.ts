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
import { EnvironmentObject, EnvironmentType } from '../utils/types';

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

      const environmentObject: EnvironmentObject = {
        object: 'environment',
        id: environment.id,
        account_id: environment.account_id,
        type: environment.type as EnvironmentType,
        auto_enable_actions: environment.auto_enable_actions,
        auto_enable_collections: environment.auto_enable_collections,
        auto_start_syncs: environment.auto_start_syncs,
        default_sync_frequency: environment.default_sync_frequency,
        default_multimodal_embedding_model: environment.default_multimodal_embedding_model,
        default_text_embedding_model: environment.default_text_embedding_model,
        multimodal_enabled_by_default: environment.multimodal_enabled_by_default,
        branding: environment.branding,
        created_at: environment.created_at,
        updated_at: environment.updated_at,
      };

      res.status(200).send(environmentObject);
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
        auto_enable_actions,
        auto_enable_collections,
        auto_start_syncs,
        default_sync_frequency,
        default_multimodal_embedding_model,
        default_text_embedding_model,
        multimodal_enabled_by_default,
        branding,
      } = req.body;

      const data: Partial<Environment> = { updated_at: now() };
      if (typeof auto_enable_actions === 'boolean') {
        data.auto_enable_actions = auto_enable_actions;
      }

      if (typeof auto_enable_collections === 'boolean') {
        data.auto_enable_collections = auto_enable_collections;
      }

      if (typeof auto_start_syncs === 'boolean') {
        data.auto_start_syncs = auto_start_syncs;
      }

      if (typeof default_sync_frequency === 'string') {
        data.default_sync_frequency = default_sync_frequency;
      }

      if (typeof default_multimodal_embedding_model === 'string') {
        data.default_multimodal_embedding_model = default_multimodal_embedding_model;
      }

      if (typeof default_text_embedding_model === 'string') {
        data.default_text_embedding_model = default_text_embedding_model;
      }

      if (typeof multimodal_enabled_by_default === 'boolean') {
        data.multimodal_enabled_by_default = multimodal_enabled_by_default;
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

      const environmentObject: EnvironmentObject = {
        object: 'environment',
        id: environment.id,
        account_id: environment.account_id,
        type: environment.type as EnvironmentType,
        auto_enable_actions: environment.auto_enable_actions,
        auto_enable_collections: environment.auto_enable_collections,
        auto_start_syncs: environment.auto_start_syncs,
        default_sync_frequency: environment.default_sync_frequency,
        default_multimodal_embedding_model: environment.default_multimodal_embedding_model,
        default_text_embedding_model: environment.default_text_embedding_model,
        multimodal_enabled_by_default: environment.multimodal_enabled_by_default,
        branding: environment.branding,
        created_at: environment.created_at,
        updated_at: environment.updated_at,
      };

      res.status(200).send(environmentObject);
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
