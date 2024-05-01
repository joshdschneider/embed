import {
  DEFAULT_ERROR_MESSAGE,
  ErrorCode,
  actionService,
  errorService,
  integrationService,
  providerService,
} from '@embed/shared';
import type { Request, Response } from 'express';
import { ActionObject, ActionRunObject } from '../utils/types';

class ActionController {
  public async listActions(req: Request, res: Response) {
    try {
      const integrationId = req.params['integration_id'];
      if (!integrationId) {
        return errorService.errorResponse(res, {
          code: ErrorCode.BadRequest,
          message: 'Integration ID missing',
        });
      }

      const actions = await actionService.listActions(integrationId);
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
          integration_id: action.integration_id,
          provider_key: action.provider_key,
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
      const integrationId = req.params['integration_id'];
      const actionKey = req.params['action_key'];

      if (!integrationId) {
        return errorService.errorResponse(res, {
          code: ErrorCode.BadRequest,
          message: 'Integration ID missing',
        });
      } else if (!actionKey) {
        return errorService.errorResponse(res, {
          code: ErrorCode.BadRequest,
          message: 'Action unique key missing',
        });
      }

      const action = await actionService.retrieveAction(actionKey, integrationId);
      if (!action) {
        return errorService.errorResponse(res, {
          code: ErrorCode.NotFound,
          message: 'Action not found',
        });
      }

      const actionObject: ActionObject = {
        object: 'action',
        unique_key: action.unique_key,
        integration_id: action.integration_id,
        provider_key: action.provider_key,
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
      const integrationId = req.params['integration_id'];
      const actionKey = req.params['action_key'];

      if (!integrationId) {
        return errorService.errorResponse(res, {
          code: ErrorCode.BadRequest,
          message: 'Integration ID missing',
        });
      } else if (!actionKey) {
        return errorService.errorResponse(res, {
          code: ErrorCode.BadRequest,
          message: 'Action unique key missing',
        });
      }

      const updatedAction = await actionService.updateAction(actionKey, integrationId, {
        is_enabled: true,
      });

      if (!updatedAction) {
        return errorService.errorResponse(res, {
          code: ErrorCode.InternalServerError,
          message: DEFAULT_ERROR_MESSAGE,
        });
      }

      const actionObject: ActionObject = {
        object: 'action',
        unique_key: updatedAction.unique_key,
        integration_id: updatedAction.integration_id,
        provider_key: updatedAction.provider_key,
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
      const integrationId = req.params['integration_id'];
      const actionKey = req.params['action_key'];

      if (!integrationId) {
        return errorService.errorResponse(res, {
          code: ErrorCode.BadRequest,
          message: 'Integration ID missing',
        });
      } else if (!actionKey) {
        return errorService.errorResponse(res, {
          code: ErrorCode.BadRequest,
          message: 'Action unique key missing',
        });
      }

      const updatedAction = await actionService.updateAction(actionKey, integrationId, {
        is_enabled: false,
      });

      if (!updatedAction) {
        return errorService.errorResponse(res, {
          code: ErrorCode.InternalServerError,
          message: DEFAULT_ERROR_MESSAGE,
        });
      }

      const actionObject: ActionObject = {
        object: 'action',
        unique_key: updatedAction.unique_key,
        integration_id: updatedAction.integration_id,
        provider_key: updatedAction.provider_key,
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
      const integrationId = req.params['integration_id'];
      if (!integrationId) {
        return errorService.errorResponse(res, {
          code: ErrorCode.BadRequest,
          message: 'Integration ID missing',
        });
      }

      const integration = await integrationService.getIntegrationById(integrationId);
      if (!integration) {
        return errorService.errorResponse(res, {
          code: ErrorCode.NotFound,
          message: 'Integration not found',
        });
      }

      const providerKey = integration.provider_key;
      const providerSpec = await providerService.getProviderSpec(providerKey);
      if (!providerSpec) {
        return errorService.errorResponse(res, {
          code: ErrorCode.NotFound,
          message: `Specification not found for ${providerKey}`,
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
      const integrationId = req.params['integration_id'];
      const actionKey = req.params['action_key'];

      if (!integrationId) {
        return errorService.errorResponse(res, {
          code: ErrorCode.BadRequest,
          message: 'Integration ID missing',
        });
      } else if (!actionKey) {
        return errorService.errorResponse(res, {
          code: ErrorCode.BadRequest,
          message: 'Action unique key missing',
        });
      }

      const integration = await integrationService.getIntegrationById(integrationId);
      if (!integration) {
        return errorService.errorResponse(res, {
          code: ErrorCode.NotFound,
          message: 'Integration not found',
        });
      }

      const providerSpec = await providerService.getProviderSpec(integration.provider_key);
      if (!providerSpec) {
        return errorService.errorResponse(res, {
          code: ErrorCode.NotFound,
          message: `Specification not found for ${integration.provider_key}`,
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
      const connectionId = req.params['connection_id'];
      const actionKey = req.params['action_key'];

      if (!connectionId) {
        return errorService.errorResponse(res, {
          code: ErrorCode.BadRequest,
          message: 'Connection ID missing',
        });
      } else if (!actionKey) {
        return errorService.errorResponse(res, {
          code: ErrorCode.BadRequest,
          message: 'Action unique key missing',
        });
      }

      const actionRuns = await actionService.listConnectionActionRuns(actionKey, connectionId);
      if (!actionRuns) {
        return errorService.errorResponse(res, {
          code: ErrorCode.InternalServerError,
          message: DEFAULT_ERROR_MESSAGE,
        });
      }

      const actionRunObjects: ActionRunObject[] = actionRuns.map((actionRun) => {
        return {
          object: 'action_run',
          action_key: actionRun.action_key,
          integration_id: actionRun.integration_id,
          connection_id: actionRun.connection_id,
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
        action_key: actionRun.action_key,
        integration_id: actionRun.integration_id,
        connection_id: actionRun.connection_id,
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
