import { LinkedAccount, Webhook } from '@prisma/client';
import { backOff } from 'exponential-backoff';
import { WebhookBody } from '../types';
import { Resource, generateId, getWebhookSignatureHeader, now } from '../utils/helpers';
import { prisma } from '../utils/prisma';
import encryptionService from './encryption.service';
import environmentService from './environment.service';
import errorService from './error.service';

class WebhookService {
  public async createWebhook(webhook: Webhook): Promise<Webhook | null> {
    try {
      const encryptedWebhook = encryptionService.encryptWebhook(webhook);

      const createdWebhook = await prisma.webhook.create({
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
      const webhooks = await prisma.webhook.findMany({
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
      const webhook = await prisma.webhook.update({
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
      const webhook = await prisma.webhook.findUnique({
        where: { id: webhookId, environment_id: environmentId },
      });

      if (!webhook) {
        return null;
      }

      return await prisma.webhook.update({
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
      await prisma.webhookLog.create({
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

  private async sendWebhook(webhook: Webhook, data: WebhookBody): Promise<void> {
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

      await this.createWebhookLog(webhook.id, data, true);
    } catch (err) {
      await errorService.reportError(err);

      await this.createWebhookLog(webhook.id, data, false);
    }
  }

  public async sendLinkedAccountCreatedWebhook(
    environmentId: string,
    linkedAccount: LinkedAccount
  ): Promise<void> {
    try {
      const webhooks = await this.listWebhooks(environmentId);
      if (!webhooks) {
        return;
      }

      const enabledWebhooks = webhooks.filter((webhook) => webhook.is_enabled);
      const environment = await environmentService.getEnvironmentById(environmentId);
      if (!environment) {
        return;
      }

      enabledWebhooks.forEach(async (webhook) => {
        if (webhook.events.includes('linked_account.created')) {
          await this.sendWebhook(webhook, {
            event: 'linked_account.created',
            environment: environment.type,
            integration: linkedAccount.integration_provider,
            linked_account_id: linkedAccount.id,
            metadata: linkedAccount.metadata || {},
            created_at: linkedAccount.created_at,
          });
        }
      });
    } catch (err) {
      await errorService.reportError(err);
    }
  }
}

export default new WebhookService();
