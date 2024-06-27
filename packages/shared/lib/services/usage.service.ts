import { MAX_CONNECTIONS_IN_STAGING } from '../utils/constants';
import { MeterEvent, UsageAction, UsageType } from '../utils/enums';
import { EnvironmentType, SyncUsageObject, UsageObject } from '../utils/types';
import billingService from './billing.service';
import connectionService from './connection.service';
import environmentService from './environment.service';
import errorService from './error.service';

class UsageService {
  public async usageLimitExceeded(environmentId: string, action: UsageAction): Promise<boolean> {
    switch (action) {
      case UsageAction.CreateConnection:
        return this.connectionLimitExceeded(environmentId);
      default:
        return false;
    }
  }

  private async connectionLimitExceeded(environmentId: string): Promise<boolean> {
    const environment = await environmentService.getEnvironmentById(environmentId);
    if (!environment) {
      throw new Error('Failed to retrieve environment');
    }

    if (environment.type === EnvironmentType.Staging) {
      const connectionCount = await connectionService.getConnectionCount(environmentId);
      if (connectionCount == null) {
        throw new Error('Failed to retrieve connection count');
      }

      if (connectionCount >= MAX_CONNECTIONS_IN_STAGING) {
        return true;
      }
    }

    return false;
  }

  public async reportUsage(usageObject: UsageObject): Promise<boolean> {
    try {
      const environment = await environmentService.getEnvironmentById(usageObject.environmentId);
      if (!environment) {
        throw new Error('Failed to retrieve environment');
      }

      if (environment.type === EnvironmentType.Staging) {
        return true;
      }

      switch (usageObject.usageType) {
        case UsageType.Connection:
          return this.reportConnectionUsage(environment.organization_id, environment.id);
        case UsageType.Sync:
          return this.reportSyncUsage(usageObject, environment.organization_id);
        case UsageType.Query:
          return this.reportQueryUsage(usageObject.queryType, environment.organization_id);
        case UsageType.Action:
          return this.reportActionUsage(environment.organization_id);
        case UsageType.ProxyRequest:
          return this.reportProxyRequestUsage(environment.organization_id);
        default:
          throw new Error('Invalid usage type');
      }
    } catch (err) {
      await errorService.reportError(err);
      return false;
    }
  }

  private async reportConnectionUsage(
    organizationId: string,
    environmentId: string
  ): Promise<boolean> {
    try {
      const connectionCount = await connectionService.getConnectionCount(environmentId);
      if (!connectionCount) {
        throw new Error('Failed to retrieve connection count');
      }

      return await billingService.updateSubscriptionConnectionsQuantity({
        organizationId,
        connectionCount,
      });
    } catch (err) {
      await errorService.reportError(err);
      return false;
    }
  }

  private async reportSyncUsage(
    usageObject: SyncUsageObject,
    organizationId: string
  ): Promise<boolean> {
    try {
      let reported = true;
      if (usageObject.syncedWords > 0) {
        const syncedWordsReported = await billingService.reportUsage({
          organizationId,
          meterEvent: MeterEvent.SyncedWords,
          value: usageObject.syncedWords,
        });

        if (!syncedWordsReported) {
          reported = false;
          await errorService.reportError(
            new Error(`Failed to report synced words for ${usageObject.syncRunId}`)
          );
        }
      }

      if (usageObject.syncedImages > 0) {
        const syncedImagesReported = await billingService.reportUsage({
          organizationId,
          meterEvent: MeterEvent.SyncedImages,
          value: usageObject.syncedImages,
        });

        if (!syncedImagesReported) {
          reported = false;
          await errorService.reportError(
            new Error(`Failed to report synced images for ${usageObject.syncRunId}`)
          );
        }
      }

      if (usageObject.syncedAudioSeconds > 0) {
        const syncedAudioSecondsReported = await billingService.reportUsage({
          organizationId,
          meterEvent: MeterEvent.SyncedAudio,
          value: usageObject.syncedAudioSeconds,
        });

        if (!syncedAudioSecondsReported) {
          reported = false;
          await errorService.reportError(
            new Error(`Failed to report synced audio seconds for ${usageObject.syncRunId}`)
          );
        }
      }

      if (usageObject.syncedVideoSeconds > 0) {
        const syncedVideoSecondsReported = await billingService.reportUsage({
          organizationId,
          meterEvent: MeterEvent.SyncedVideo,
          value: usageObject.syncedVideoSeconds,
        });

        if (!syncedVideoSecondsReported) {
          reported = false;
          await errorService.reportError(
            new Error(`Failed to report synced video seconds for ${usageObject.syncRunId}`)
          );
        }
      }

      return reported;
    } catch (err) {
      await errorService.reportError(err);
      return false;
    }
  }

  private async reportQueryUsage(
    queryType: 'image' | 'text',
    organizationId: string
  ): Promise<boolean> {
    try {
      let meterEvent: MeterEvent;
      if (queryType === 'image') {
        meterEvent = MeterEvent.ImageQueries;
      } else if (queryType === 'text') {
        meterEvent = MeterEvent.TextQueries;
      } else {
        throw new Error('Invalid query type');
      }

      return await billingService.reportUsage({
        organizationId,
        meterEvent,
      });
    } catch (err) {
      await errorService.reportError(err);
      return false;
    }
  }

  private async reportActionUsage(organizationId: string): Promise<boolean> {
    try {
      return await billingService.reportUsage({
        organizationId,
        meterEvent: MeterEvent.Actions,
      });
    } catch (err) {
      await errorService.reportError(err);
      return false;
    }
  }

  private async reportProxyRequestUsage(organizationId: string): Promise<boolean> {
    try {
      return await billingService.reportUsage({
        organizationId,
        meterEvent: MeterEvent.ProxyRequests,
      });
    } catch (err) {
      await errorService.reportError(err);
      return false;
    }
  }
}

export default new UsageService();
