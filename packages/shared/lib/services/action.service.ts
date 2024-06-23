import { Action, ActionRun } from '@prisma/client';
import { database } from '../utils/database';
import { now } from '../utils/helpers';
import { UsageType } from '../utils/types';
import errorService from './error.service';
import usageService from './usage.service';

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
    try {
      // execute action
      const response = { status: 200, data: {}, runId: '' };

      usageService.reportUsage({
        usageType: UsageType.Action,
        environmentId,
        integrationId,
        connectionId,
        actionRunId: response.runId,
      });

      return response;
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
