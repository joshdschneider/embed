import {
  DEFAULT_ERROR_MESSAGE,
  ErrorCode,
  database,
  errorService,
  integrationService,
} from '@kit/shared';
import type { Request, Response } from 'express';

class JobsController {
  public async seedIntegrations(req: Request, res: Response) {
    try {
      const environmentIds = req.body['environment_ids'];
      if (!environmentIds || !Array.isArray(environmentIds)) {
        return errorService.errorResponse(res, {
          code: ErrorCode.BadRequest,
          message: 'Invalid environment IDs',
        });
      }

      let ids: string[] = environmentIds;
      let environmentsUpdated = 0;
      let integrationsAdded = 0;
      let collectionsAdded = 0;
      let actionsAdded = 0;

      if (ids[0] === '*') {
        const allEnvironments = await database.environment.findMany();
        const allEnvironmentIds = allEnvironments.map((e) => e.id);
        ids = allEnvironmentIds;
      }

      for (const id of ids) {
        const result = await integrationService.seedIntegrations(id);
        if (!result) {
          throw new Error(`Job failed on ID ${id}`);
        } else {
          environmentsUpdated++;
          integrationsAdded += result.integrations_added;
          collectionsAdded += result.collections_added;
          actionsAdded += result.actions_added;
        }
      }

      res.status(200).json({
        object: 'job',
        result: {
          environments_updated: environmentsUpdated,
          integrations_added: integrationsAdded,
          collections_added: collectionsAdded,
          actions_added: actionsAdded,
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
}

export default new JobsController();
