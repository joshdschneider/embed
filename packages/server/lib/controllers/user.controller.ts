import {
  DEFAULT_ERROR_MESSAGE,
  ErrorCode,
  Resource,
  apiKeyService,
  errorService,
  generateId,
  now,
} from '@kit/shared';
import type { Request, Response } from 'express';
import accountService from '../services/account.service';
import environmentService from '../services/environment.service';
import integrationService from '../services/integration.service';
import userService from '../services/user.service';
import { DEFAULT_BRANDING } from '../utils/constants';
import { generateSecretKey } from '../utils/helpers';
import { AccountType, EnvironmentType } from '../utils/types';

class UserController {
  public async createUser(req: Request, res: Response) {
    try {
      const { user, cloud_organization_id } = req.body;
      if (!user) {
        return errorService.errorResponse(res, {
          code: ErrorCode.BadRequest,
          message: 'User missing',
        });
      }

      const existingUser = await userService.getUserById(user.id);
      if (existingUser) {
        return res.status(200).json({
          object: 'user',
          id: existingUser.id,
          email: existingUser.email,
          first_name: existingUser.first_name,
          last_name: existingUser.last_name,
        });
      }

      const account = await accountService.createAccount({
        id: generateId(Resource.Account),
        name: null,
        type: AccountType.Personal,
        cloud_organization_id: cloud_organization_id || null,
      });

      if (!account) {
        return errorService.errorResponse(res, {
          code: ErrorCode.InternalServerError,
          message: DEFAULT_ERROR_MESSAGE,
        });
      }

      const newUser = await userService.createUser({
        id: user.id,
        account_id: account.id,
        email: user.email,
        first_name: user.first_name,
        last_name: user.last_name,
        created_at: now(),
        updated_at: now(),
        deleted_at: null,
      });

      if (!newUser) {
        return errorService.errorResponse(res, {
          code: ErrorCode.InternalServerError,
          message: DEFAULT_ERROR_MESSAGE,
        });
      }

      const stagingEnvironment = await environmentService.createEnvironment({
        id: generateId(Resource.Environment),
        account_id: account.id,
        type: EnvironmentType.Staging,
        enable_new_integrations: true,
        branding: DEFAULT_BRANDING,
        created_at: now(),
        updated_at: now(),
        deleted_at: null,
      });

      if (!stagingEnvironment) {
        return errorService.errorResponse(res, {
          code: ErrorCode.InternalServerError,
          message: DEFAULT_ERROR_MESSAGE,
        });
      }

      const apiKey = await apiKeyService.createApiKey({
        id: generateId(Resource.ApiKey),
        environment_id: stagingEnvironment.id,
        key: generateSecretKey(EnvironmentType.Staging),
        key_iv: null,
        key_tag: null,
        name: null,
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

      await integrationService.createInitialIntegrations(stagingEnvironment.id);

      return res.status(200).json({
        object: 'user',
        id: newUser.id,
        account_id: newUser.account_id,
        email: newUser.email,
        first_name: newUser.first_name,
        last_name: newUser.last_name,
      });
    } catch (err) {
      await errorService.reportError(err);

      return errorService.errorResponse(res, {
        code: ErrorCode.InternalServerError,
        message: DEFAULT_ERROR_MESSAGE,
      });
    }
  }

  public async retrieveUser(req: Request, res: Response) {
    try {
      const { user_id } = req.params;
      if (!user_id) {
        return errorService.errorResponse(res, {
          code: ErrorCode.BadRequest,
          message: 'User ID missing',
        });
      }

      const user = await userService.getUserById(user_id);
      if (!user) {
        return errorService.errorResponse(res, {
          code: ErrorCode.NotFound,
          message: 'User not found',
        });
      }

      return res.status(200).json({
        object: 'user',
        id: user.id,
        email: user.email,
        first_name: user.first_name,
        last_name: user.last_name,
        account: {
          object: 'account',
          ...user.account,
        },
      });
    } catch (err) {
      await errorService.reportError(err);

      return errorService.errorResponse(res, {
        code: ErrorCode.InternalServerError,
        message: DEFAULT_ERROR_MESSAGE,
      });
    }
  }

  public async retrieveUserAccount(req: Request, res: Response) {
    try {
      const { user_id } = req.params;
      if (!user_id) {
        return errorService.errorResponse(res, {
          code: ErrorCode.BadRequest,
          message: 'User ID missing',
        });
      }

      const account = await accountService.getAccountByUserId(user_id);
      if (!account) {
        return errorService.errorResponse(res, {
          code: ErrorCode.NotFound,
          message: 'User not found',
        });
      }

      return res.status(200).json({
        object: 'account',
        id: account.id,
        cloud_organization_id: account.cloud_organization_id,
        environments: account.environments.map((environment) => ({
          object: 'environment',
          ...environment,
        })),
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

export default new UserController();
