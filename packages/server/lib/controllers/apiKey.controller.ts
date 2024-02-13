import {
  DEFAULT_ERROR_MESSAGE,
  ENVIRONMENT_ID_LOCALS_KEY,
  ErrorCode,
  Resource,
  errorService,
  generateId,
  now,
} from '@kit/shared';
import type { Request, Response } from 'express';
import apiKeyService from '../services/apiKey.service';
import environmentService from '../services/environment.service';
import { generateSecretKey } from '../utils/helpers';
import { EnvironmentType } from '../utils/types';

class ApiKeyController {
  public async generateApiKey(req: Request, res: Response) {
    try {
      const environmentId = res.locals[ENVIRONMENT_ID_LOCALS_KEY];
      const name = req.body['name'];
      const environment = await environmentService.getEnvironmentById(environmentId);

      if (!environment) {
        return errorService.errorResponse(res, {
          code: ErrorCode.InternalServerError,
          message: DEFAULT_ERROR_MESSAGE,
        });
      }

      const type = environment.type as EnvironmentType;
      const apiKey = await apiKeyService.createApiKey({
        id: generateId(Resource.ApiKey),
        environment_id: environmentId,
        key: generateSecretKey(type),
        key_iv: null,
        key_tag: null,
        name: name || null,
        created_at: now(),
        updated_at: now(),
        deleted_at: null,
      });

      if (!apiKey) {
        return errorService.errorResponse(res, {
          code: ErrorCode.InternalServerError,
          message: DEFAULT_ERROR_MESSAGE,
        });
      }

      res.status(200).json({
        object: 'api_key',
        id: apiKey.id,
        environment_id: apiKey.environment_id,
        key: apiKey.key,
        name: apiKey.name,
        created_at: apiKey.created_at,
        updated_at: apiKey.updated_at,
      });
    } catch (err) {
      await errorService.reportError(err);

      return errorService.errorResponse(res, {
        code: ErrorCode.InternalServerError,
        message: DEFAULT_ERROR_MESSAGE,
      });
    }
  }

  public async listApiKeys(req: Request, res: Response) {
    try {
      const environmentId = res.locals[ENVIRONMENT_ID_LOCALS_KEY];
      const apiKeys = await apiKeyService.listApiKeys(environmentId);

      if (!apiKeys) {
        return errorService.errorResponse(res, {
          code: ErrorCode.InternalServerError,
          message: DEFAULT_ERROR_MESSAGE,
        });
      }

      const list = apiKeys.map((apiKey) => ({
        id: apiKey.id,
        environment_id: apiKey.environment_id,
        key: apiKey.key,
        name: apiKey.name,
        created_at: apiKey.created_at,
        updated_at: apiKey.updated_at,
      }));

      res.status(200).json({
        object: 'list',
        data: list,
      });
    } catch (err) {
      await errorService.reportError(err);

      return errorService.errorResponse(res, {
        code: ErrorCode.InternalServerError,
        message: DEFAULT_ERROR_MESSAGE,
      });
    }
  }

  public async modifyApiKey(req: Request, res: Response) {
    try {
      const environmentId = res.locals[ENVIRONMENT_ID_LOCALS_KEY];
      const apiKeyId = req.params['api_key_id'];
      const name = req.body['name'];

      if (!apiKeyId) {
        return errorService.errorResponse(res, {
          code: ErrorCode.BadRequest,
          message: 'API key ID missing',
        });
      }

      if (name == undefined) {
        return errorService.errorResponse(res, {
          code: ErrorCode.BadRequest,
          message: 'Name missing',
        });
      }

      const apiKey = await apiKeyService.updateApiKey(apiKeyId, environmentId, name);

      if (!apiKey) {
        return errorService.errorResponse(res, {
          code: ErrorCode.InternalServerError,
          message: DEFAULT_ERROR_MESSAGE,
        });
      }

      res.status(201).json({
        object: 'api_key',
        id: apiKey.id,
        environment_id: apiKey.environment_id,
        key: apiKey.key,
        name: apiKey.name,
        created_at: apiKey.created_at,
        updated_at: apiKey.updated_at,
      });
    } catch (err) {
      await errorService.reportError(err);

      return errorService.errorResponse(res, {
        code: ErrorCode.InternalServerError,
        message: DEFAULT_ERROR_MESSAGE,
      });
    }
  }

  public async deleteApiKey(req: Request, res: Response) {
    try {
      const environmentId = res.locals[ENVIRONMENT_ID_LOCALS_KEY];
      const apiKeyId = req.params['api_key_id'];

      if (!apiKeyId) {
        return errorService.errorResponse(res, {
          code: ErrorCode.BadRequest,
          message: 'API key ID missing',
        });
      }

      const apiKey = await apiKeyService.deleteApiKey(apiKeyId, environmentId);

      if (!apiKey) {
        return errorService.errorResponse(res, {
          code: ErrorCode.InternalServerError,
          message: DEFAULT_ERROR_MESSAGE,
        });
      }

      res.status(200).json({
        object: 'api_key',
        id: apiKeyId,
        deleted: true,
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

export default new ApiKeyController();
