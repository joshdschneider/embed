import {
  DEFAULT_ERROR_MESSAGE,
  ENVIRONMENT_ID_LOCALS_KEY,
  ErrorCode,
  actionService,
  errorService,
  providerService,
} from '@embed/shared';
import type { Request, Response } from 'express';
import { ActionObject, ActionRunObject } from '../utils/types';

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

      const entries = Object.entries(providerSpec.actions || {});
      const schemas = entries.map(([k, v]) => v.schema);

      res.status(200).json({ object: 'list', data: schemas });
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

      const entries = Object.entries(providerSpec.actions || {});
      const action = entries.find(([k, v]) => k === actionKey);

      if (!action) {
        return errorService.errorResponse(res, {
          code: ErrorCode.NotFound,
          message: `Schema not found for ${actionKey}`,
        });
      }

      const schema = action[1].schema;
      res.status(200).json(schema);
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
      const linkedAccountId = req.params['linked_account_id'];
      const actionKey = req.params['action_key'];

      if (!linkedAccountId) {
        return errorService.errorResponse(res, {
          code: ErrorCode.BadRequest,
          message: 'Linked account ID missing',
        });
      } else if (!actionKey) {
        return errorService.errorResponse(res, {
          code: ErrorCode.BadRequest,
          message: 'Action unique key missing',
        });
      }

      const actionRuns = await actionService.listLinkedAccountActionRuns(
        actionKey,
        linkedAccountId
      );

      if (!actionRuns) {
        return errorService.errorResponse(res, {
          code: ErrorCode.InternalServerError,
          message: DEFAULT_ERROR_MESSAGE,
        });
      }

      const actionRunObjects: ActionRunObject[] = actionRuns.map((actionRun) => {
        return {
          object: 'action_run',
          action: actionRun.action_key,
          integration: actionRun.integration_key,
          linked_account: actionRun.linked_account_id,
          created_at: actionRun.created_at,
          updated_at: actionRun.updated_at,
        };
      });

      res.status(200).json({ object: 'list', data: actionRunObjects });
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
      const actionRunId = req.params['run_id'];
      if (!actionRunId) {
        return errorService.errorResponse(res, {
          code: ErrorCode.BadRequest,
          message: 'Run ID missing',
        });
      }

      const actionRun = await actionService.retrieveActionRun(actionRunId);
      if (!actionRun) {
        return errorService.errorResponse(res, {
          code: ErrorCode.InternalServerError,
          message: DEFAULT_ERROR_MESSAGE,
        });
      }

      const actionRunObject: ActionRunObject = {
        object: 'action_run',
        action: actionRun.action_key,
        integration: actionRun.integration_key,
        linked_account: actionRun.linked_account_id,
        created_at: actionRun.created_at,
        updated_at: actionRun.updated_at,
      };

      res.status(200).json(actionRunObject);
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
