import {
  ActionRunStatus,
  DEFAULT_ERROR_MESSAGE,
  ENVIRONMENT_ID_LOCALS_KEY,
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
      const environmentId = res.locals[ENVIRONMENT_ID_LOCALS_KEY];
      const integrationId = req.query['integration_id'];
      if (!integrationId || typeof integrationId !== 'string') {
        return errorService.errorResponse(res, {
          code: ErrorCode.BadRequest,
          message: 'Integration ID missing or invalid',
        });
      }

      const actions = await actionService.listActions({
        environmentId,
        integrationId,
      });

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
          configuration: action.configuration as Record<string, any> | null,
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
      const integrationId = req.query['integration_id'];
      const actionKey = req.params['action_key'];

      if (!integrationId || typeof integrationId !== 'string') {
        return errorService.errorResponse(res, {
          code: ErrorCode.BadRequest,
          message: 'Integration ID missing or invalid',
        });
      } else if (!actionKey) {
        return errorService.errorResponse(res, {
          code: ErrorCode.BadRequest,
          message: 'Action unique key missing',
        });
      }

      const action = await actionService.retrieveAction({
        actionKey,
        integrationId,
        environmentId,
      });

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
        configuration: action.configuration as Record<string, any> | null,
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
      const integrationId = req.query['integration_id'];
      const actionKey = req.params['action_key'];

      if (!integrationId || typeof integrationId !== 'string') {
        return errorService.errorResponse(res, {
          code: ErrorCode.BadRequest,
          message: 'Integration ID missing or invalid',
        });
      } else if (!actionKey) {
        return errorService.errorResponse(res, {
          code: ErrorCode.BadRequest,
          message: 'Action unique key missing',
        });
      }

      const updatedAction = await actionService.updateAction({
        actionKey,
        integrationId,
        environmentId,
        data: { is_enabled: true },
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
        configuration: updatedAction.configuration as Record<string, any> | null,
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
      const integrationId = req.query['integration_id'];
      const actionKey = req.params['action_key'];

      if (!integrationId || typeof integrationId !== 'string') {
        return errorService.errorResponse(res, {
          code: ErrorCode.BadRequest,
          message: 'Integration ID missing or invalid',
        });
      } else if (!actionKey) {
        return errorService.errorResponse(res, {
          code: ErrorCode.BadRequest,
          message: 'Action unique key missing',
        });
      }

      const updatedAction = await actionService.updateAction({
        actionKey,
        integrationId,
        environmentId,
        data: { is_enabled: false },
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
        configuration: updatedAction.configuration as Record<string, any> | null,
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
      const environmentId = res.locals[ENVIRONMENT_ID_LOCALS_KEY];
      const integrationId = req.query['integration_id'];
      if (!integrationId || typeof integrationId !== 'string') {
        return errorService.errorResponse(res, {
          code: ErrorCode.BadRequest,
          message: 'Integration ID missing or invalid',
        });
      }

      const integration = await integrationService.getIntegrationById(integrationId, environmentId);
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
      const environmentId = res.locals[ENVIRONMENT_ID_LOCALS_KEY];
      const integrationId = req.query['integration_id'];
      const actionKey = req.params['action_key'];

      if (!integrationId || typeof integrationId !== 'string') {
        return errorService.errorResponse(res, {
          code: ErrorCode.BadRequest,
          message: 'Integration ID missing or invalid',
        });
      } else if (!actionKey) {
        return errorService.errorResponse(res, {
          code: ErrorCode.BadRequest,
          message: 'Action unique key missing',
        });
      }

      const integration = await integrationService.getIntegrationById(integrationId, environmentId);
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
      const environmentId = res.locals[ENVIRONMENT_ID_LOCALS_KEY];
      const integrationId = req.query['integration_id'];
      const connectionId = req.query['connection_id'];
      const actionKey = req.params['action_key'];
      const input = req.body['input'];

      if (!integrationId || typeof integrationId !== 'string') {
        return errorService.errorResponse(res, {
          code: ErrorCode.BadRequest,
          message: 'Integration ID missing or invalid',
        });
      } else if (!connectionId || typeof connectionId !== 'string') {
        return errorService.errorResponse(res, {
          code: ErrorCode.BadRequest,
          message: 'Connection ID missing or invalid',
        });
      } else if (!actionKey) {
        return errorService.errorResponse(res, {
          code: ErrorCode.BadRequest,
          message: 'Action unique key missing',
        });
      } else if (!input || typeof input !== 'object') {
        return errorService.errorResponse(res, {
          code: ErrorCode.BadRequest,
          message: 'Input missing or invalid',
        });
      }

      const actionResponse = await actionService.triggerAction({
        environmentId,
        integrationId,
        connectionId,
        actionKey,
        input,
      });

      if (!actionResponse) {
        return errorService.errorResponse(res, {
          code: ErrorCode.InternalServerError,
          message: DEFAULT_ERROR_MESSAGE,
        });
      }

      res.status(actionResponse.status).json(actionResponse.data);
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
      const environmentId = res.locals[ENVIRONMENT_ID_LOCALS_KEY];
      const integrationId = req.query['integration_id'];
      const connectionId = req.query['connection_id'];
      const actionKey = req.params['action_key'];

      if (!integrationId || typeof integrationId !== 'string') {
        return errorService.errorResponse(res, {
          code: ErrorCode.BadRequest,
          message: 'Integration ID missing or invalid',
        });
      } else if (!connectionId || typeof connectionId !== 'string') {
        return errorService.errorResponse(res, {
          code: ErrorCode.BadRequest,
          message: 'Connection ID missing or invalid',
        });
      } else if (!actionKey) {
        return errorService.errorResponse(res, {
          code: ErrorCode.BadRequest,
          message: 'Action unique key missing',
        });
      }

      const actionRuns = await actionService.listActionRuns({
        actionKey,
        environmentId,
        integrationId,
        connectionId,
      });

      if (!actionRuns) {
        return errorService.errorResponse(res, {
          code: ErrorCode.InternalServerError,
          message: DEFAULT_ERROR_MESSAGE,
        });
      }

      const actionRunObjects: ActionRunObject[] = actionRuns.map((actionRun) => {
        return {
          object: 'action_run',
          id: actionRun.id,
          action_key: actionRun.action_key,
          integration_id: actionRun.integration_id,
          connection_id: actionRun.connection_id,
          input: actionRun.input as Record<string, any>,
          output: actionRun.output as Record<string, any>,
          status: actionRun.status as ActionRunStatus,
          duration: actionRun.duration,
          timestamp: actionRun.timestamp,
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
      const actionRunId = req.params['action_run_id'];
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
        id: actionRun.id,
        action_key: actionRun.action_key,
        integration_id: actionRun.integration_id,
        connection_id: actionRun.connection_id,
        input: actionRun.input as Record<string, any>,
        output: actionRun.output as Record<string, any>,
        status: actionRun.status as ActionRunStatus,
        duration: actionRun.duration,
        timestamp: actionRun.timestamp,
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
