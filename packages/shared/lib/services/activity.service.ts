import type { Activity, ActivityLog } from '@prisma/client';
import logger from '../clients/logger.client';
import { DEFAULT_LIMIT, MAX_LIMIT, MIN_LIMIT } from '../utils/constants';
import { database } from '../utils/database';
import { LogLevel, QueryMode, Resource } from '../utils/enums';
import { generateId } from '../utils/helpers';
import errorService from './error.service';

class ActivityService {
  public async listActivities(
    environmentId: string,
    options?: {
      connectionId?: string;
      query?: string;
      order?: 'asc' | 'desc';
      pagination?: {
        limit?: number;
        before?: string;
        after?: string;
      };
    }
  ): Promise<{
    activities: (Activity & { logs: ActivityLog[] })[];
    hasMore: boolean;
    firstId: string | null;
    lastId: string | null;
  } | null> {
    try {
      const limit = Math.min(
        MAX_LIMIT,
        Math.max(MIN_LIMIT, options?.pagination?.limit || DEFAULT_LIMIT)
      );

      const order = options?.order || 'desc';
      const query = options?.query;
      const whereClause = {
        environment_id: environmentId,
        ...(options?.connectionId && { connection_id: options.connectionId }),
        ...(options?.query && {
          OR: [
            { integration_id: { contains: query, mode: QueryMode.insensitive } },
            { connection_id: { contains: query, mode: QueryMode.insensitive } },
            { session_token_id: { contains: query, mode: QueryMode.insensitive } },
            { collection_key: { contains: query, mode: QueryMode.insensitive } },
            { action_key: { contains: query, mode: QueryMode.insensitive } },
            { level: { contains: query, mode: QueryMode.insensitive } },
            { action: { contains: query, mode: QueryMode.insensitive } },
            { logs: { some: { message: { contains: query, mode: QueryMode.insensitive } } } },
          ],
        }),
      };

      let orderBy = { timestamp: order };
      let cursorCondition = {};
      let take = limit + 1;

      if (options?.pagination?.after) {
        cursorCondition = { cursor: { id: options.pagination.after }, skip: 1 };
      } else if (options?.pagination?.before) {
        cursorCondition = { cursor: { id: options.pagination.before }, skip: 1 };
        orderBy = { timestamp: order === 'asc' ? 'desc' : 'asc' };
        take = -take;
      }

      let activities = await database.activity.findMany({
        where: whereClause,
        include: { logs: true },
        orderBy,
        take,
        ...cursorCondition,
      });

      const hasMore = activities.length > limit;
      if (hasMore) {
        activities = activities.slice(0, -1);
      }

      if (options?.pagination?.before) {
        activities.reverse();
      }

      return {
        activities,
        hasMore,
        firstId: activities[0]?.id || null,
        lastId: activities[activities.length - 1]?.id || null,
      };
    } catch (err) {
      await errorService.reportError(err);
      return null;
    }
  }

  public async createActivity(activity: Activity): Promise<string | null> {
    try {
      const newActivity = await database.activity.create({
        data: activity,
        select: { id: true },
      });
      return newActivity.id;
    } catch (err) {
      await errorService.reportError(err);
      return null;
    }
  }

  public async findActivityIdBySessionToken(sessionToken: string): Promise<string | null> {
    try {
      const activity = await database.activity.findFirst({
        where: { session_token_id: sessionToken },
        select: { id: true },
      });

      return activity ? activity.id : null;
    } catch (err) {
      await errorService.reportError(err);
      return null;
    }
  }

  public async updateActivity(
    activityId: string | null,
    data: Partial<Activity>
  ): Promise<Activity | null> {
    if (!activityId) {
      return null;
    }

    try {
      return await database.activity.update({
        where: { id: activityId },
        data: { ...data },
      });
    } catch (err) {
      await errorService.reportError(err);
      return null;
    }
  }

  public async createActivityLog(
    activityId: string | null,
    activityLog: {
      level: LogLevel;
      message: string;
      payload?: object;
      timestamp: number;
    }
  ): Promise<ActivityLog | null> {
    if (!activityId) {
      return null;
    }

    try {
      logger.log(activityLog.level, activityLog.message);

      return await database.activityLog.create({
        data: {
          id: generateId(Resource.ActivityLog),
          activity_id: activityId,
          ...activityLog,
        },
      });
    } catch (err) {
      await errorService.reportError(err);
      return null;
    }
  }
}

export default new ActivityService();
