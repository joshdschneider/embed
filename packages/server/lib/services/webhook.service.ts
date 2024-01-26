import { Webhook } from '@prisma/client';
import { now } from '../utils/helpers';
import { prisma } from '../utils/prisma';
import encryptionService from './encryption.service';
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
}

export default new WebhookService();
