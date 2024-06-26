import type { Environment } from '@embed/shared';
import {
  DEFAULT_ERROR_MESSAGE,
  ENVIRONMENT_ID_LOCALS_KEY,
  EnvironmentType,
  ErrorCode,
  environmentService,
  errorService,
  now,
} from '@embed/shared';
import type { Request, Response } from 'express';
import { EnvironmentObject } from '../utils/types';

class EnvironmentController {
  public async listEnvironments(req: Request, res: Response) {
    try {
      const organizationId = req.query['organization_id'];
      if (!organizationId || typeof organizationId !== 'string') {
        return errorService.errorResponse(res, {
          code: ErrorCode.BadRequest,
          message: 'Invalid organization ID',
        });
      }

      const environments = await environmentService.listEnvironments(organizationId);
      if (!environments) {
        return errorService.errorResponse(res, {
          code: ErrorCode.InternalServerError,
          message: DEFAULT_ERROR_MESSAGE,
        });
      }

      const envs: EnvironmentObject[] = environments.map((env) => {
        return {
          object: 'environment',
          id: env.id,
          organization_id: env.organization_id,
          type: env.type as EnvironmentType,
          auto_enable_actions: env.auto_enable_actions,
          auto_enable_collections: env.auto_enable_collections,
          auto_start_syncs: env.auto_start_syncs,
          default_sync_frequency: env.default_sync_frequency,
          default_multimodal_embedding_model: env.default_multimodal_embedding_model,
          default_text_embedding_model: env.default_text_embedding_model,
          locked: env.locked,
          locked_reason: env.locked_reason,
          branding: env.branding,
          created_at: env.created_at,
          updated_at: env.updated_at,
        };
      });

      res.status(200).json({ object: 'list', data: envs });
    } catch (err) {
      await errorService.reportError(err);

      return errorService.errorResponse(res, {
        code: ErrorCode.InternalServerError,
        message: DEFAULT_ERROR_MESSAGE,
      });
    }
  }

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
        organization_id: environment.organization_id,
        type: environment.type as EnvironmentType,
        auto_enable_actions: environment.auto_enable_actions,
        auto_enable_collections: environment.auto_enable_collections,
        auto_start_syncs: environment.auto_start_syncs,
        default_sync_frequency: environment.default_sync_frequency,
        default_multimodal_embedding_model: environment.default_multimodal_embedding_model,
        default_text_embedding_model: environment.default_text_embedding_model,
        locked: environment.locked,
        locked_reason: environment.locked_reason,
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
        organization_id: environment.organization_id,
        type: environment.type as EnvironmentType,
        auto_enable_actions: environment.auto_enable_actions,
        auto_enable_collections: environment.auto_enable_collections,
        auto_start_syncs: environment.auto_start_syncs,
        default_sync_frequency: environment.default_sync_frequency,
        default_multimodal_embedding_model: environment.default_multimodal_embedding_model,
        default_text_embedding_model: environment.default_text_embedding_model,
        branding: environment.branding,
        locked: environment.locked,
        locked_reason: environment.locked_reason,
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
