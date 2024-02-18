import type { LinkedAccount, Webhook } from '@kit/shared';
import {
  LogLevel,
  Resource,
  activityService,
  database,
  encryptionService,
  errorService,
  generateId,
  now,
} from '@kit/shared';
import { backOff } from 'exponential-backoff';
import { getWebhookSignatureHeader } from '../utils/helpers';
import { WebhookBody, WebhookEvent } from '../utils/types';
import environmentService from './environment.service';

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

  public async updateWebhook(
    webhookId: string,
    environmentId: string,
    data: Partial<Webhook>
  ): Promise<Webhook | null> {
    try {
      const webhook = await database.webhook.update({
        where: {
          id: webhookId,
          environment_id: environmentId,
          deleted_at: null,
        },
        data: {
          url: data.url,
          events: data.events,
          is_enabled: data.is_enabled,
          updated_at: now(),
        },
      });

      return encryptionService.decryptWebhook(webhook);
    } catch (err) {
      await errorService.reportError(err);
      return null;
    }
  }

  public async deleteWebhook(webhookId: string, environmentId: string): Promise<Webhook | null> {
    try {
      const webhook = await database.webhook.findUnique({
        where: { id: webhookId, environment_id: environmentId },
      });

      if (!webhook) {
        return null;
      }

      return await database.webhook.update({
        where: {
          id: webhookId,
          environment_id: environmentId,
          deleted_at: null,
        },
        data: { deleted_at: now() },
      });
    } catch (err) {
      await errorService.reportError(err);
      return null;
    }
  }

  private async createWebhookLog(
    webhookId: string,
    data: WebhookBody,
    delivered: boolean
  ): Promise<void> {
    try {
      await database.webhookLog.create({
        data: {
          id: generateId(Resource.WebhookLog),
          webhook_id: webhookId,
          event: data.event,
          payload: { ...data },
          delivered,
          timestamp: now(),
        },
      });
    } catch (err) {
      await errorService.reportError(err);
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

    await this.createWebhookLog(webhook.id, data, delivered);
    return delivered;
  }

  public async sendLinkedAccountWebhook({
    environmentId,
    linkedAccount,
    activityId,
    action,
  }: {
    environmentId: string;
    linkedAccount: LinkedAccount;
    activityId: string | null;
    action: 'created' | 'updated';
  }): Promise<void> {
    const webhooks = await this.listWebhooks(environmentId);

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

    const environment = await environmentService.getEnvironmentById(environmentId);

    if (!environment) {
      await activityService.createActivityLog(activityId, {
        timestamp: now(),
        level: LogLevel.Error,
        message: `Failed to deliver webhook due to an internal error`,
      });

      const err = new Error('Failed to retrieve environment');
      return await errorService.reportError(err);
    }

    let event: WebhookEvent;

    if (action === 'created') {
      event = 'linked_account.created';
    } else if (action === 'updated') {
      event = 'linked_account.updated';
    } else {
      await activityService.createActivityLog(activityId, {
        timestamp: now(),
        level: LogLevel.Error,
        message: `Failed to deliver webhook due to an unsupported action`,
      });

      const err = new Error(`Unsupported action: ${action}`);
      return await errorService.reportError(err);
    }

    const results = [];

    try {
      for (const webhook of enabledWebhooks) {
        if (webhook.events.includes(event)) {
          const delivered = await this.sendWebhook(webhook, {
            event: event,
            environment: environment.type,
            integration: linkedAccount.integration_provider,
            linked_account_id: linkedAccount.id,
            metadata: linkedAccount.metadata || {},
            created_at: linkedAccount.created_at,
            updated_at: linkedAccount.updated_at,
          });

          results.push({ delivered, url: webhook.url });
        }
      }

      const deliveredCount = results.filter((result) => result.delivered).length;

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
        payload: { event, results },
      });
    } catch (err) {
      await errorService.reportError(err);

      await activityService.createActivityLog(activityId, {
        timestamp: now(),
        level: LogLevel.Error,
        message: `Failed to deliver webhook due to an internal error`,
        payload: { event, results },
      });
    }
  }
}

export default new WebhookService();
