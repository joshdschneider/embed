import { Action } from '@prisma/client';
import { database } from '../utils/database';
import { now } from '../utils/helpers';
import errorService from './error.service';

class ActionService {
  public async listActions(
    integrationKey: string,
    environmentId: string
  ): Promise<Action[] | null> {
    try {
      const integration = await database.integration.findUnique({
        where: {
          unique_key_environment_id: {
            unique_key: integrationKey,
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

  public async retrieveAction(
    actionKey: string,
    integrationKey: string,
    environmentId: string
  ): Promise<Action | null> {
    try {
      return await database.action.findUnique({
        where: {
          unique_key_integration_key_environment_id: {
            unique_key: actionKey,
            integration_key: integrationKey,
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

  public async updateAction(
    actionKey: string,
    integrationKey: string,
    environmentId: string,
    data: Partial<Action>
  ): Promise<Action | null> {
    try {
      return await database.action.update({
        where: {
          unique_key_integration_key_environment_id: {
            unique_key: actionKey,
            integration_key: integrationKey,
            environment_id: environmentId,
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
}

export default new ActionService();
