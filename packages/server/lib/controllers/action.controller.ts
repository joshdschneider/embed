import {
  DEFAULT_ERROR_MESSAGE,
  ENVIRONMENT_ID_LOCALS_KEY,
  ErrorCode,
  actionService,
  errorService,
  providerService,
} from '@kit/shared';
import type { Request, Response } from 'express';
import { ActionObject } from '../utils/types';

class ActionController {
  public async listActions(req: Request, res: Response) {
    try {
      const environmentId = res.locals[ENVIRONMENT_ID_LOCALS_KEY];
      const integrationKey = req.params['integration_key'];

      if (!integrationKey) {
        return errorService.errorResponse(res, {
          code: ErrorCode.BadRequest,
          message: 'Integration unique key missing',
        });
      }

      const actions = await actionService.listActions(integrationKey, environmentId);

      if (!actions) {
        return errorService.errorResponse(res, {
          code: ErrorCode.InternalServerError,
          message: DEFAULT_ERROR_MESSAGE,
        });
      }

      const actionObjects: ActionObject[] = actions.map((action) => {
        return {
          object: 'action',
          unique_key: action.unique_key,
          integration: action.integration_key,
          is_enabled: action.is_enabled,
          created_at: action.created_at,
          updated_at: action.updated_at,
        };
      });

      res.status(200).json({ object: 'list', data: actionObjects });
    } catch (err) {
      await errorService.reportError(err);

      return errorService.errorResponse(res, {
        code: ErrorCode.InternalServerError,
        message: DEFAULT_ERROR_MESSAGE,
      });
    }
  }

  public async retrieveAction(req: Request, res: Response) {
    try {
      const environmentId = res.locals[ENVIRONMENT_ID_LOCALS_KEY];
      const integrationKey = req.params['integration_key'];
      const actionKey = req.params['action_key'];

      if (!integrationKey) {
        return errorService.errorResponse(res, {
          code: ErrorCode.BadRequest,
          message: 'Integration unique key missing',
        });
      } else if (!actionKey) {
        return errorService.errorResponse(res, {
          code: ErrorCode.BadRequest,
          message: 'Action unique key missing',
        });
      }

      const action = await actionService.retrieveAction(actionKey, integrationKey, environmentId);

      if (!action) {
        return errorService.errorResponse(res, {
          code: ErrorCode.NotFound,
          message: 'Action not found',
        });
      }

      const actionObject: ActionObject = {
        object: 'action',
        unique_key: action.unique_key,
        integration: action.integration_key,
        is_enabled: action.is_enabled,
        created_at: action.created_at,
        updated_at: action.updated_at,
      };

      res.status(200).json(actionObject);
    } catch (err) {
      await errorService.reportError(err);

      return errorService.errorResponse(res, {
        code: ErrorCode.InternalServerError,
        message: DEFAULT_ERROR_MESSAGE,
      });
    }
  }

  public async enableAction(req: Request, res: Response) {
    try {
      const environmentId = res.locals[ENVIRONMENT_ID_LOCALS_KEY];
      const integrationKey = req.params['integration_key'];
      const actionKey = req.params['action_key'];

      if (!integrationKey) {
        return errorService.errorResponse(res, {
          code: ErrorCode.BadRequest,
          message: 'Integration unique key missing',
        });
      } else if (!actionKey) {
        return errorService.errorResponse(res, {
          code: ErrorCode.BadRequest,
          message: 'Action unique key missing',
        });
      }

      const updatedAction = await actionService.updateAction(
        actionKey,
        integrationKey,
        environmentId,
        { is_enabled: true }
      );

      if (!updatedAction) {
        return errorService.errorResponse(res, {
          code: ErrorCode.InternalServerError,
          message: DEFAULT_ERROR_MESSAGE,
        });
      }

      const actionObject: ActionObject = {
        object: 'action',
        unique_key: updatedAction.unique_key,
        integration: updatedAction.integration_key,
        is_enabled: updatedAction.is_enabled,
        created_at: updatedAction.created_at,
        updated_at: updatedAction.updated_at,
      };

      res.status(200).json(actionObject);
    } catch (err) {
      await errorService.reportError(err);

      return errorService.errorResponse(res, {
        code: ErrorCode.InternalServerError,
        message: DEFAULT_ERROR_MESSAGE,
      });
    }
  }

  public async disableAction(req: Request, res: Response) {
    try {
      const environmentId = res.locals[ENVIRONMENT_ID_LOCALS_KEY];
      const integrationKey = req.params['integration_key'];
      const actionKey = req.params['action_key'];

      if (!integrationKey) {
        return errorService.errorResponse(res, {
          code: ErrorCode.BadRequest,
          message: 'Integration unique key missing',
        });
      } else if (!actionKey) {
        return errorService.errorResponse(res, {
          code: ErrorCode.BadRequest,
          message: 'Action unique key missing',
        });
      }

      const updatedAction = await actionService.updateAction(
        actionKey,
        integrationKey,
        environmentId,
        { is_enabled: false }
      );

      if (!updatedAction) {
        return errorService.errorResponse(res, {
          code: ErrorCode.InternalServerError,
          message: DEFAULT_ERROR_MESSAGE,
        });
      }

      const actionObject: ActionObject = {
        object: 'action',
        unique_key: updatedAction.unique_key,
        integration: updatedAction.integration_key,
        is_enabled: updatedAction.is_enabled,
        created_at: updatedAction.created_at,
        updated_at: updatedAction.updated_at,
      };

      res.status(200).json(actionObject);
    } catch (err) {
      await errorService.reportError(err);

      return errorService.errorResponse(res, {
        code: ErrorCode.InternalServerError,
        message: DEFAULT_ERROR_MESSAGE,
      });
    }
  }

  public async listActionSchemas(req: Request, res: Response) {
    try {
      const integrationKey = req.params['integration_key'];

      if (!integrationKey) {
        return errorService.errorResponse(res, {
          code: ErrorCode.BadRequest,
          message: 'Integration unique key missing',
        });
      }

      const providerSpec = await providerService.getProviderSpec(integrationKey);

      if (!providerSpec) {
        return errorService.errorResponse(res, {
          code: ErrorCode.NotFound,
          message: `Specification not found for ${integrationKey}`,
        });
      }

      res.status(200).json({
        object: 'list',
        data: providerSpec.actions?.map((action) => action.schema) || [],
      });
    } catch (err) {
      await errorService.reportError(err);

      return errorService.errorResponse(res, {
        code: ErrorCode.InternalServerError,
        message: DEFAULT_ERROR_MESSAGE,
      });
    }
  }

  public async retrieveActionSchema(req: Request, res: Response) {
    try {
      const integrationKey = req.params['integration_key'];
      const actionKey = req.params['action_key'];

      if (!integrationKey) {
        return errorService.errorResponse(res, {
          code: ErrorCode.BadRequest,
          message: 'Integration unique key missing',
        });
      } else if (!actionKey) {
        return errorService.errorResponse(res, {
          code: ErrorCode.BadRequest,
          message: 'Action unique key missing',
        });
      }

      const providerSpec = await providerService.getProviderSpec(integrationKey);

      if (!providerSpec) {
        return errorService.errorResponse(res, {
          code: ErrorCode.NotFound,
          message: `Specification not found for ${integrationKey}`,
        });
      }

      const action = providerSpec.actions?.find((c) => c.unique_key === actionKey);

      if (!action || !action.schema) {
        return errorService.errorResponse(res, {
          code: ErrorCode.NotFound,
          message: `Schema not found for ${actionKey}`,
        });
      }

      res.status(200).json(action.schema);
    } catch (err) {
      await errorService.reportError(err);

      return errorService.errorResponse(res, {
        code: ErrorCode.InternalServerError,
        message: DEFAULT_ERROR_MESSAGE,
      });
    }
  }

  public async triggerAction(req: Request, res: Response) {
    try {
      //..
    } catch (err) {
      await errorService.reportError(err);

      return errorService.errorResponse(res, {
        code: ErrorCode.InternalServerError,
        message: DEFAULT_ERROR_MESSAGE,
      });
    }
  }

  public async listActionRuns(req: Request, res: Response) {
    try {
      //..
    } catch (err) {
      await errorService.reportError(err);

      return errorService.errorResponse(res, {
        code: ErrorCode.InternalServerError,
        message: DEFAULT_ERROR_MESSAGE,
      });
    }
  }

  public async retrieveActionRun(req: Request, res: Response) {
    try {
      //..
    } catch (err) {
      await errorService.reportError(err);

      return errorService.errorResponse(res, {
        code: ErrorCode.InternalServerError,
        message: DEFAULT_ERROR_MESSAGE,
      });
    }
  }
}

export default new ActionController();
