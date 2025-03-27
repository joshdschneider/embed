import {
  LogLevel,
  activityService,
  collectionService,
  errorService,
  now,
  syncService,
  webhookService,
  type Connection,
} from '@embed/shared';

class ConnectionHook {
  public async connectionCreated({
    connection,
    activityId,
  }: {
    connection: Connection;
    activityId: string | null;
  }): Promise<void> {
    webhookService.sendConnectionWebhook({
      connection,
      activityId,
      action: 'created',
    });

    const collections = await collectionService.listCollections({
      integrationId: connection.integration_id,
      environmentId: connection.environment_id,
    });

    if (!collections) {
      await activityService.createActivityLog(activityId, {
        level: LogLevel.Error,
        message: `Failed to create collections for connection ${connection.id}`,
        timestamp: now(),
      });

      return await errorService.reportError(
        new Error('Failed to retrieve collections from database')
      );
    }

    for (const collection of collections) {
      syncService.initializeSync({ connectionId: connection.id, collection, activityId });
    }
  }

  public async connectionUpdated({
    connection,
    activityId,
  }: {
    connection: Connection;
    activityId: string | null;
  }): Promise<void> {
    webhookService.sendConnectionWebhook({
      connection,
      activityId,
      action: 'updated',
    });

    const collections = await collectionService.listCollections({
      integrationId: connection.integration_id,
      environmentId: connection.environment_id,
    });

    if (!collections) {
      await activityService.createActivityLog(activityId, {
        level: LogLevel.Error,
        message: `Failed to create collections for connection ${connection.id}`,
        timestamp: now(),
      });

      return await errorService.reportError(
        new Error('Failed to retrieve collections from database')
      );
    }

    for (const collection of collections) {
      syncService.initializeSync({ connectionId: connection.id, collection, activityId });
    }
  }
}

export default new ConnectionHook();
