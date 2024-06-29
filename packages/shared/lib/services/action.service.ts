import { Action, ActionRun } from '@prisma/client';
import { ActionContext } from '../context/action.context';
import { database } from '../utils/database';
import { ActionRunStatus, LogAction, LogLevel, Resource } from '../utils/enums';
import { generateId, now } from '../utils/helpers';
import actionService from './action.service';
import activityService from './activity.service';
import errorService from './error.service';
import providerService from './provider.service';

class ActionService {
  public async listActions({
    integrationId,
    environmentId,
  }: {
    integrationId: string;
    environmentId: string;
  }): Promise<Action[] | null> {
    try {
      const integration = await database.integration.findUnique({
        where: {
          id_environment_id: {
            id: integrationId,
            environment_id: environmentId,
          },
          deleted_at: null,
        },
        select: { actions: true },
      });

      if (!integration) {
        return null;
      }

      return integration.actions;
    } catch (err) {
      await errorService.reportError(err);
      return null;
    }
  }

  public async retrieveAction({
    actionKey,
    integrationId,
    environmentId,
  }: {
    actionKey: string;
    integrationId: string;
    environmentId: string;
  }): Promise<Action | null> {
    try {
      return await database.action.findUnique({
        where: {
          unique_key_integration_id_environment_id: {
            unique_key: actionKey,
            integration_id: integrationId,
            environment_id: environmentId,
          },
          deleted_at: null,
        },
      });
    } catch (err) {
      await errorService.reportError(err);
      return null;
    }
  }

  public async createAction(action: Action): Promise<Action | null> {
    try {
      return await database.action.create({
        data: {
          ...action,
          configuration: action.configuration || undefined,
          created_at: now(),
          updated_at: now(),
          deleted_at: null,
        },
      });
    } catch (err) {
      await errorService.reportError(err);
      return null;
    }
  }

  public async updateAction({
    actionKey,
    integrationId,
    environmentId,
    data,
  }: {
    actionKey: string;
    integrationId: string;
    environmentId: string;
    data: Partial<Action>;
  }): Promise<Action | null> {
    try {
      return await database.action.update({
        where: {
          unique_key_integration_id_environment_id: {
            unique_key: actionKey,
            integration_id: integrationId,
            environment_id: environmentId,
          },
          deleted_at: null,
        },
        data: {
          ...data,
          configuration: data.configuration || undefined,
          updated_at: now(),
        },
      });
    } catch (err) {
      await errorService.reportError(err);
      return null;
    }
  }

  public async deleteAction({
    actionKey,
    integrationId,
    environmentId,
  }: {
    actionKey: string;
    integrationId: string;
    environmentId: string;
  }): Promise<boolean> {
    try {
      await database.action.update({
        where: {
          unique_key_integration_id_environment_id: {
            unique_key: actionKey,
            integration_id: integrationId,
            environment_id: environmentId,
          },
          deleted_at: null,
        },
        data: { deleted_at: now() },
      });
      return true;
    } catch (err) {
      await errorService.reportError(err);
      return false;
    }
  }

  public async triggerAction({
    environmentId,
    integrationId,
    connectionId,
    actionKey,
    input,
  }: {
    environmentId: string;
    integrationId: string;
    connectionId: string;
    actionKey: string;
    input: Record<string, any>;
  }) {
    const activityId = await activityService.createActivity({
      id: generateId(Resource.Activity),
      environment_id: environmentId,
      integration_id: integrationId,
      connection_id: connectionId,
      session_token_id: null,
      action_key: actionKey,
      collection_key: null,
      level: LogLevel.Info,
      action: LogAction.ActionRun,
      timestamp: now(),
    });

    const action = await actionService.retrieveAction({
      integrationId: integrationId,
      environmentId: environmentId,
      actionKey: actionKey,
    });

    if (!action) {
      const error = 'Internal server error';
      await activityService.createActivityLog(activityId, {
        message: 'Action run failed',
        level: LogLevel.Error,
        timestamp: now(),
        payload: { error },
      });

      await errorService.reportError(new Error('Action not found in the database'));
      return { status: 500, data: { error } };
    }

    const actionRun = await this.createActionRun({
      id: generateId(Resource.ActionRun),
      environment_id: environmentId,
      integration_id: integrationId,
      connection_id: connectionId,
      action_key: action.unique_key,
      input,
      output: null,
      status: ActionRunStatus.Running,
      duration: null,
      timestamp: now(),
    });

    if (!actionRun) {
      const error = 'Internal server error';
      await activityService.createActivityLog(activityId, {
        message: 'Action run failed',
        level: LogLevel.Error,
        timestamp: now(),
        payload: { error },
      });

      await errorService.reportError(new Error('Failed to create action run in the database'));
      return { status: 500, data: { error } };
    }

    try {
      const actionContext = new ActionContext({
        environmentId,
        integrationId,
        connectionId,
        actionKey: action.unique_key,
        providerKey: action.provider_key,
        actionRunId: actionRun.id,
        activityId,
        input,
      });

      await providerService.triggerProviderAction(
        action.provider_key,
        action.unique_key,
        actionContext
      );

      const { status, output } = await actionContext.reportResults();

      await this.updateActionRun(actionRun.id, {
        output: output,
        status:
          status && status.toString().startsWith('2')
            ? ActionRunStatus.Succeeded
            : ActionRunStatus.Failed,
      });

      return { status, output };
    } catch (err) {
      await errorService.reportError(err);
      await activityService.createActivityLog(activityId, {
        message: 'Action run failed',
        level: LogLevel.Error,
        timestamp: now(),
        payload: { error: 'Internal server error' },
      });

      await this.updateActionRun(actionRun.id, {
        output: null,
        status: ActionRunStatus.Failed,
      });

      return {
        status: 500,
        data: { error: 'Internal server error' },
      };
    }
  }

  public async createActionRun(actionRun: ActionRun): Promise<ActionRun | null> {
    try {
      return await database.actionRun.create({
        data: {
          ...actionRun,
          input: actionRun.input || {},
          output: actionRun.output || undefined,
        },
      });
    } catch (err) {
      await errorService.reportError(err);
      return null;
    }
  }

  public async updateActionRun(
    actionRunId: string,
    data: Partial<ActionRun>
  ): Promise<ActionRun | null> {
    try {
      return await database.actionRun.update({
        where: { id: actionRunId },
        data: { ...data, input: data.input || undefined, output: data.output || undefined },
      });
    } catch (err) {
      await errorService.reportError(err);
      return null;
    }
  }

  public async listActionRuns({
    actionKey,
    connectionId,
    integrationId,
    environmentId,
  }: {
    actionKey: string;
    connectionId: string;
    integrationId: string;
    environmentId: string;
  }): Promise<ActionRun[] | null> {
    try {
      return await database.actionRun.findMany({
        where: {
          connection_id: connectionId,
          integration_id: integrationId,
          action_key: actionKey,
          environment_id: environmentId,
        },
      });
    } catch (err) {
      await errorService.reportError(err);
      return null;
    }
  }

  public async retrieveActionRun(actionRunId: string): Promise<ActionRun | null> {
    try {
      return await database.actionRun.findUnique({
        where: { id: actionRunId },
      });
    } catch (err) {
      await errorService.reportError(err);
      return null;
    }
  }
}

export default new ActionService();
