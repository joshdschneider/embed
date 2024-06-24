import { MAX_CONNECTIONS_IN_STAGING } from '../utils/constants';
import { MeterEvent, UsageAction, UsageType } from '../utils/enums';
import {
  ActionUsageObject,
  ConnectionUsageObject,
  EnvironmentType,
  ProxyRequestUsageObject,
  QueryUsageObject,
  SyncUsageObject,
  UsageObject,
} from '../utils/types';
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
      if (!connectionCount) {
        throw new Error('Failed to retrieve connection count');
      }

      if (connectionCount >= MAX_CONNECTIONS_IN_STAGING) {
        return true;
      }
    }

    return false;
  }

  public async reportUsage(usageObject: UsageObject): Promise<boolean> {
    switch (usageObject.usageType) {
      case UsageType.Connection:
        return this.reportConnectionUsage(usageObject);
      case UsageType.Sync:
        return this.reportSyncUsage(usageObject);
      case UsageType.Query:
        return this.reportQueryUsage(usageObject);
      case UsageType.Action:
        return this.reportActionUsage(usageObject);
      case UsageType.ProxyRequest:
        return this.reportProxyRequestUsage(usageObject);
      default:
        const err = new Error('Invalid usage type');
        await errorService.reportError(err);
        return false;
    }
  }

  private async reportConnectionUsage(usageObject: ConnectionUsageObject): Promise<boolean> {
    try {
      const environment = await environmentService.getEnvironmentById(usageObject.environmentId);
      if (!environment) {
        throw new Error('Failed to retrieve environment');
      }

      const connectionCount = await connectionService.getConnectionCount(environment.id);
      if (!connectionCount) {
        throw new Error('Failed to retrieve connection count');
      }

      return await billingService.updateSubscriptionConnectionsQuantity({
        organizationId: environment.organization_id,
        connectionCount,
      });
    } catch (err) {
      await errorService.reportError(err);
      return false;
    }
  }

  private async reportSyncUsage(usageObject: SyncUsageObject): Promise<boolean> {
    try {
      const environment = await environmentService.getEnvironmentById(usageObject.environmentId);
      if (!environment) {
        throw new Error('Failed to retrieve environment');
      }

      let reported = true;
      if (usageObject.syncedWords > 0) {
        const syncedWordsReported = await billingService.reportUsage({
          organizationId: environment.organization_id,
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
          organizationId: environment.organization_id,
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
          organizationId: environment.organization_id,
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
          organizationId: environment.organization_id,
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

  private async reportQueryUsage(usageObject: QueryUsageObject): Promise<boolean> {
    try {
      const environment = await environmentService.getEnvironmentById(usageObject.environmentId);
      if (!environment) {
        throw new Error('Failed to retrieve environment');
      }

      let meterEvent: MeterEvent;
      if (usageObject.queryType === 'image') {
        meterEvent = MeterEvent.ImageQueries;
      } else if (usageObject.queryType === 'text') {
        meterEvent = MeterEvent.TextQueries;
      } else {
        throw new Error('Invalid query type');
      }

      return await billingService.reportUsage({
        organizationId: environment.organization_id,
        meterEvent,
      });
    } catch (err) {
      await errorService.reportError(err);
      return false;
    }
  }

  private async reportActionUsage(usageObject: ActionUsageObject): Promise<boolean> {
    try {
      const environment = await environmentService.getEnvironmentById(usageObject.environmentId);
      if (!environment) {
        throw new Error('Failed to retrieve environment');
      }

      return await billingService.reportUsage({
        organizationId: environment.organization_id,
        meterEvent: MeterEvent.Actions,
      });
    } catch (err) {
      await errorService.reportError(err);
      return false;
    }
  }

  private async reportProxyRequestUsage(usageObject: ProxyRequestUsageObject): Promise<boolean> {
    try {
      const environment = await environmentService.getEnvironmentById(usageObject.environmentId);
      if (!environment) {
        throw new Error('Failed to retrieve environment');
      }

      return await billingService.reportUsage({
        organizationId: environment.organization_id,
        meterEvent: MeterEvent.ProxyRequests,
      });
    } catch (err) {
      await errorService.reportError(err);
      return false;
    }
  }
}

export default new UsageService();
