import {
  DEFAULT_ERROR_MESSAGE,
  ENVIRONMENT_ID_LOCALS_KEY,
  ErrorCode,
  LogAction,
  LogLevel,
  activityService,
  errorService,
} from '@embed/shared';
import type { Request, Response } from 'express';
import { zodError } from '../utils/helpers';
import { ActivityLogObject, ActivityObject, PaginationParametersSchema } from '../utils/types';

class ActivityController {
  public async listActivities(req: Request, res: Response) {
    try {
      const environmentId = res.locals[ENVIRONMENT_ID_LOCALS_KEY];
      const connectionId = req.query['connection_id'] as string | undefined;
      const searchQuery = req.query['query'] as string | undefined;
      const parsedParams = PaginationParametersSchema.safeParse(req.query);

      if (!parsedParams.success) {
        return errorService.errorResponse(res, {
          code: ErrorCode.BadRequest,
          message: zodError(parsedParams.error),
        });
      }

      const { before, after, limit, order } = parsedParams.data;
      const list = await activityService.listActivities(environmentId, {
        connectionId,
        query: searchQuery,
        order,
        pagination: { after, before, limit },
      });

      if (!list) {
        return errorService.errorResponse(res, {
          code: ErrorCode.InternalServerError,
          message: DEFAULT_ERROR_MESSAGE,
        });
      }

      const { activities, firstId, lastId, hasMore } = list;
      const activityObjects: (ActivityObject & { logs: ActivityLogObject[] })[] = activities.map(
        (activity) => {
          const level = activity.logs.some((l) => l.level === LogLevel.Error)
            ? LogLevel.Error
            : activity.logs.some((l) => l.level === LogLevel.Warn)
              ? LogLevel.Warn
              : LogLevel.Info;

          return {
            object: 'activity',
            ...activity,
            level: level,
            action: activity.action as LogAction,
            logs: activity.logs.map((log) => {
              return { object: 'activity_log', ...log };
            }),
          };
        }
      );

      res.status(200).json({
        object: 'list',
        data: activityObjects,
        first_id: firstId,
        last_id: lastId,
        has_more: hasMore,
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

export default new ActivityController();
