import { Connection, Sync, Webhook, WebhookEvent } from '@prisma/client';
import { backOff } from 'exponential-backoff';
import { database } from '../utils/database';
import { LogLevel, Resource } from '../utils/enums';
import { generateId, getWebhookSignatureHeader, now } from '../utils/helpers';
import {
  ConnectionWebhookEvent,
  Metadata,
  SyncWebhookBody,
  SyncWebhookEvent,
  WebhookBody,
} from '../utils/types';
import activityService from './activity.service';
import encryptionService from './encryption.service';
import environmentService from './environment.service';
import errorService from './error.service';

class WebhookService {
  public async createWebhook(webhook: Webhook): Promise<Webhook | null> {
    try {
      const encryptedWebhook = encryptionService.encryptWebhook(webhook);
      const createdWebhook = await database.webhook.create({
        data: encryptedWebhook,
      });

      return encryptionService.decryptWebhook(createdWebhook);
    } catch (err) {
      await errorService.reportError(err);
      return null;
    }
  }

  public async listWebhooks(environmentId: string): Promise<Webhook[] | null> {
    try {
      const webhooks = await database.webhook.findMany({
        where: { environment_id: environmentId, deleted_at: null },
      });

      return webhooks.map((hook) => encryptionService.decryptWebhook(hook));
    } catch (err) {
      await errorService.reportError(err);
      return null;
    }
  }

  public async listWebhookEvents(webhookId: string): Promise<WebhookEvent[] | null> {
    try {
      return await database.webhookEvent.findMany({
        where: { webhook_id: webhookId },
      });
    } catch (err) {
      await errorService.reportError(err);
      return null;
    }
  }

  public async retrieveWebhook(webhookId: string): Promise<Webhook | null> {
    try {
      const webhook = await database.webhook.findUnique({
        where: { id: webhookId, deleted_at: null },
      });

      if (!webhook) {
        return null;
      }

      return encryptionService.decryptWebhook(webhook);
    } catch (err) {
      await errorService.reportError(err);
      return null;
    }
  }

  public async retrieveWebhookEvent(
    webhookId: string,
    webhookEventId: string
  ): Promise<WebhookEvent | null> {
    try {
      return await database.webhookEvent.findUnique({
        where: { id: webhookEventId, webhook_id: webhookId },
      });
    } catch (err) {
      await errorService.reportError(err);
      return null;
    }
  }

  public async updateWebhook(webhookId: string, data: Partial<Webhook>): Promise<Webhook | null> {
    try {
      const webhook = await database.webhook.update({
        where: { id: webhookId, deleted_at: null },
        data: { ...data, updated_at: now() },
      });

      return encryptionService.decryptWebhook(webhook);
    } catch (err) {
      await errorService.reportError(err);
      return null;
    }
  }

  public async deleteWebhook(webhookId: string): Promise<Webhook | null> {
    try {
      const deletedWebhook = await database.webhook.update({
        where: { id: webhookId, deleted_at: null },
        data: { deleted_at: now() },
      });

      return encryptionService.decryptWebhook(deletedWebhook);
    } catch (err) {
      await errorService.reportError(err);
      return null;
    }
  }

  private async createWebhookEvent(webhookEvent: WebhookEvent): Promise<WebhookEvent | null> {
    try {
      return await database.webhookEvent.create({
        data: {
          ...webhookEvent,
          payload: webhookEvent.payload || {},
        },
      });
    } catch (err) {
      await errorService.reportError(err);
      return null;
    }
  }

  private async sendWebhook(webhook: Webhook, data: WebhookBody): Promise<boolean> {
    let delivered = false;

    try {
      const signatureHeader = getWebhookSignatureHeader(JSON.stringify(data), webhook.secret);
      const response = await backOff(
        () => {
          return fetch(webhook.url, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json', ...signatureHeader },
            body: JSON.stringify(data),
          });
        },
        { numOfAttempts: 5 }
      );

      if (!response.ok) {
        throw new Error(`Failed to send webhook to ${webhook.url}`);
      }

      delivered = true;
    } catch (err) {
      await errorService.reportError(err);
    }

    await this.createWebhookEvent({
      id: generateId(Resource.WebhookEvent),
      webhook_id: webhook.id,
      name: data.event,
      payload: { ...data },
      delivered,
      timestamp: now(),
    });

    return delivered;
  }

  public async sendConnectionWebhook({
    connection,
    activityId,
    action,
  }: {
    connection: Connection;
    activityId: string | null;
    action: 'created' | 'updated';
  }): Promise<void> {
    const webhooks = await this.listWebhooks(connection.environment_id);
    if (!webhooks) {
      await activityService.createActivityLog(activityId, {
        timestamp: now(),
        level: LogLevel.Error,
        message: `Failed to deliver webhook due to an internal error`,
      });

      return await errorService.reportError(new Error('Failed to list webhooks'));
    }

    const enabledWebhooks = webhooks.filter((webhook) => webhook.is_enabled);
    if (enabledWebhooks.length === 0) {
      return;
    }

    const environment = await environmentService.getEnvironmentById(connection.environment_id);
    if (!environment) {
      await activityService.createActivityLog(activityId, {
        timestamp: now(),
        level: LogLevel.Error,
        message: `Failed to deliver webhook due to an internal error`,
      });

      const err = new Error('Failed to retrieve environment');
      return await errorService.reportError(err);
    }

    let event: ConnectionWebhookEvent;
    if (action === 'created') {
      event = 'connection.created';
    } else if (action === 'updated') {
      event = 'connection.updated';
    } else {
      await activityService.createActivityLog(activityId, {
        timestamp: now(),
        level: LogLevel.Error,
        message: `Failed to deliver webhook due to an internal error`,
      });

      const err = new Error(`Unsupported action: ${action}`);
      return await errorService.reportError(err);
    }

    const res = [];

    try {
      for (const webhook of enabledWebhooks) {
        if (webhook.event_subscriptions.includes(event)) {
          const delivered = await this.sendWebhook(webhook, {
            event: event,
            integration: connection.integration_id,
            connection: connection.id,
            metadata: connection.metadata as Metadata,
            configuration: connection.configuration as Record<string, any>,
            created_at: connection.created_at,
            updated_at: connection.updated_at,
          });

          res.push({ delivered, url: webhook.url });
        }
      }

      const deliveredCount = res.filter((result) => result.delivered).length;
      if (deliveredCount === 0) {
        throw new Error('Failed to deliver webhook(s)');
      }

      const message =
        deliveredCount === enabledWebhooks.length
          ? `Webhook delivered to ${deliveredCount} endpoints`
          : `Webhook delivered to ${deliveredCount} out of ${enabledWebhooks.length} endpoints`;

      await activityService.createActivityLog(activityId, {
        timestamp: now(),
        level: LogLevel.Info,
        message,
        payload: { event, results: res },
      });
    } catch (err) {
      await errorService.reportError(err);

      await activityService.createActivityLog(activityId, {
        timestamp: now(),
        level: LogLevel.Error,
        message: `Failed to deliver webhook due to an internal error`,
        payload: { event, results: res },
      });
    }
  }

  public async sendSyncWebhook({
    sync,
    activityId,
    action,
    results,
    reason,
  }: {
    sync: Sync;
    activityId: string | null;
    action: 'succeeded' | 'failed';
    results?: {
      records_added: number;
      records_updated: number;
      records_deleted: number;
    };
    reason?: string;
  }): Promise<void> {
    const webhooks = await this.listWebhooks(sync.environment_id);
    if (!webhooks) {
      await activityService.createActivityLog(activityId, {
        timestamp: now(),
        level: LogLevel.Error,
        message: `Failed to deliver webhook due to an internal error`,
      });

      const err = new Error('Failed to list webhooks');
      return await errorService.reportError(err);
    }

    const enabledWebhooks = webhooks.filter((webhook) => webhook.is_enabled);
    if (enabledWebhooks.length === 0) {
      return;
    }

    const environment = await environmentService.getEnvironmentById(sync.environment_id);
    if (!environment) {
      await activityService.createActivityLog(activityId, {
        timestamp: now(),
        level: LogLevel.Error,
        message: `Failed to deliver webhook due to an internal error`,
      });

      const err = new Error('Failed to retrieve environment');
      return await errorService.reportError(err);
    }

    let event: SyncWebhookEvent;
    if (action === 'succeeded') {
      event = 'sync.succeeded';
    } else if (action === 'failed') {
      event = 'sync.failed';
    } else {
      await activityService.createActivityLog(activityId, {
        timestamp: now(),
        level: LogLevel.Error,
        message: `Failed to deliver webhook due to an internal error`,
      });

      const err = new Error(`Unsupported action: ${action}`);
      return await errorService.reportError(err);
    }

    const res = [];

    try {
      for (const webhook of enabledWebhooks) {
        if (webhook.event_subscriptions.includes(event)) {
          const body: SyncWebhookBody = {
            event: event,
            integration: sync.integration_id,
            connection: sync.connection_id,
            collection: sync.collection_key,
            timestamp: now(),
          };

          if (event === 'sync.succeeded' && results) {
            body.results = results;
          } else if (event === 'sync.failed' && reason) {
            body.reason = reason;
          }

          const delivered = await this.sendWebhook(webhook, body);
          res.push({ delivered, url: webhook.url });
        }
      }

      const deliveredCount = res.filter((result) => result.delivered).length;
      if (deliveredCount === 0) {
        throw new Error('Failed to deliver webhook(s)');
      }

      const message =
        deliveredCount === enabledWebhooks.length
          ? `Webhook delivered to ${deliveredCount} endpoints`
          : `Webhook delivered to ${deliveredCount} out of ${enabledWebhooks.length} endpoints`;

      await activityService.createActivityLog(activityId, {
        timestamp: now(),
        level: LogLevel.Info,
        message,
        payload: { event, results: res },
      });
    } catch (err) {
      await errorService.reportError(err);

      await activityService.createActivityLog(activityId, {
        timestamp: now(),
        level: LogLevel.Error,
        message: `Failed to deliver webhook due to an internal error`,
        payload: { event, results: res },
      });
    }
  }
}

export default new WebhookService();
