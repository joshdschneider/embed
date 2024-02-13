import type { Activity, ActivityLog } from '@prisma/client';
import logger from '../clients/logger.client';
import { database } from '../utils/database';
import { LogLevel, Resource } from '../utils/enums';
import { generateId } from '../utils/helpers';
import errorService from './error.service';

class ActivityService {
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

  public async findActivityIdByLinkToken(linkToken: string): Promise<string | null> {
    try {
      const activity = await database.activity.findFirst({
        where: { link_token_id: linkToken },
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
