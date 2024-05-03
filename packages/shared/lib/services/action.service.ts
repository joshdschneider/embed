import { Action, ActionRun } from '@prisma/client';
import { database } from '../utils/database';
import { now } from '../utils/helpers';
import errorService from './error.service';

class ActionService {
  public async listActions(integrationId: string): Promise<Action[] | null> {
    try {
      const integration = await database.integration.findUnique({
        where: { id: integrationId, deleted_at: null },
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

  public async retrieveAction(actionKey: string, integrationId: string): Promise<Action | null> {
    try {
      return await database.action.findUnique({
        where: {
          unique_key_integration_id: {
            unique_key: actionKey,
            integration_id: integrationId,
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

  public async updateAction(
    actionKey: string,
    integrationId: string,
    data: Partial<Action>
  ): Promise<Action | null> {
    try {
      return await database.action.update({
        where: {
          unique_key_integration_id: {
            unique_key: actionKey,
            integration_id: integrationId,
          },
          deleted_at: null,
        },
        data: { ...data, updated_at: now() },
      });
    } catch (err) {
      await errorService.reportError(err);
      return null;
    }
  }

  public async listIntegrationActionRuns(
    actionKey: string,
    integrationId: string
  ): Promise<ActionRun[] | null> {
    try {
      const action = await database.action.findUnique({
        where: {
          unique_key_integration_id: {
            unique_key: actionKey,
            integration_id: integrationId,
          },
          deleted_at: null,
        },
        select: { runs: true },
      });

      if (!action) {
        return null;
      }

      return action.runs;
    } catch (err) {
      await errorService.reportError(err);
      return null;
    }
  }

  public async listConnectionActionRuns(
    actionKey: string,
    connectionId: string
  ): Promise<ActionRun[] | null> {
    try {
      return await database.actionRun.findMany({
        where: { connection_id: connectionId, action_key: actionKey },
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
