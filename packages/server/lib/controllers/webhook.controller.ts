import {
  DEFAULT_ERROR_MESSAGE,
  ENVIRONMENT_ID_LOCALS_KEY,
  ErrorCode,
  Resource,
  errorService,
  generateId,
  now,
} from '@kit/shared';
import type { Request, Response } from 'express';
import webhookService from '../services/webhook.service';
import { generateWebhookSigningSecret } from '../utils/helpers';

class WebhookController {
  public async createWebhook(req: Request, res: Response) {
    try {
      const environmentId = res.locals[ENVIRONMENT_ID_LOCALS_KEY];
      const { url, events } = req.body;

      if (!url) {
        return errorService.errorResponse(res, {
          code: ErrorCode.BadRequest,
          message: 'Missing webhook URL',
        });
      }

      try {
        new URL(url);
      } catch {
        return errorService.errorResponse(res, {
          code: ErrorCode.BadRequest,
          message: 'Invalid webhook url',
        });
      }

      if (!events || !Array.isArray(events)) {
        return errorService.errorResponse(res, {
          code: ErrorCode.BadRequest,
          message: 'Invalid webhook events',
        });
      }

      const webhook = await webhookService.createWebhook({
        id: generateId(Resource.Webhook),
        environment_id: environmentId,
        url,
        events,
        is_enabled: true,
        secret: generateWebhookSigningSecret(),
        secret_iv: null,
        secret_tag: null,
        created_at: now(),
        updated_at: now(),
        deleted_at: null,
      });

      if (!webhook) {
        return errorService.errorResponse(res, {
          code: ErrorCode.InternalServerError,
          message: DEFAULT_ERROR_MESSAGE,
        });
      }

      res.status(200).json({
        object: 'webhook',
        id: webhook.id,
        environment_id: webhook.environment_id,
        url: webhook.url,
        events: webhook.events,
        is_enabled: webhook.is_enabled,
        created_at: webhook.created_at,
        updated_at: webhook.updated_at,
      });
    } catch (err) {
      await errorService.reportError(err);

      return errorService.errorResponse(res, {
        code: ErrorCode.InternalServerError,
        message: DEFAULT_ERROR_MESSAGE,
      });
    }
  }

  public async listWebhooks(req: Request, res: Response) {
    try {
      const environmentId = res.locals[ENVIRONMENT_ID_LOCALS_KEY];
      const webhooks = await webhookService.listWebhooks(environmentId);

      if (!webhooks) {
        return errorService.errorResponse(res, {
          code: ErrorCode.InternalServerError,
          message: DEFAULT_ERROR_MESSAGE,
        });
      }

      const webhooksList = webhooks.map((webhook) => ({
        id: webhook.id,
        environment_id: webhook.environment_id,
        url: webhook.url,
        events: webhook.events,
        secret: webhook.secret,
        is_enabled: webhook.is_enabled,
        created_at: webhook.created_at,
        updated_at: webhook.updated_at,
      }));

      res.status(200).json({
        object: 'list',
        data: webhooksList,
      });
    } catch (err) {
      await errorService.reportError(err);

      return errorService.errorResponse(res, {
        code: ErrorCode.InternalServerError,
        message: DEFAULT_ERROR_MESSAGE,
      });
    }
  }

  public async modifyWebhook(req: Request, res: Response) {
    try {
      const environmentId = res.locals[ENVIRONMENT_ID_LOCALS_KEY];
      const webhookId = req.params['webhook_id'];
      const url = req.body['url'];
      const events = req.body['events'];
      const isEnabled = req.body['is_enabled'];

      if (!webhookId) {
        return errorService.errorResponse(res, {
          code: ErrorCode.BadRequest,
          message: 'Webhook ID missing',
        });
      }

      if (url !== undefined) {
        if (typeof url !== 'string') {
          return errorService.errorResponse(res, {
            code: ErrorCode.BadRequest,
            message: 'Invalid webhook URL',
          });
        }

        try {
          new URL(url);
        } catch {
          return errorService.errorResponse(res, {
            code: ErrorCode.BadRequest,
            message: 'Invalid webhook url',
          });
        }
      }

      if (events !== undefined && !Array.isArray(events)) {
        return errorService.errorResponse(res, {
          code: ErrorCode.BadRequest,
          message: 'Invalid webhook events',
        });
      }

      if (isEnabled !== undefined && typeof isEnabled !== 'boolean') {
        return errorService.errorResponse(res, {
          code: ErrorCode.BadRequest,
          message: 'Invalid flag is_enabled',
        });
      }

      const webhook = await webhookService.updateWebhook(webhookId, environmentId, {
        url,
        events,
        is_enabled: isEnabled,
      });

      if (!webhook) {
        return errorService.errorResponse(res, {
          code: ErrorCode.InternalServerError,
          message: DEFAULT_ERROR_MESSAGE,
        });
      }

      res.status(200).json({
        object: 'webhook',
        id: webhook.id,
        environment_id: webhook.environment_id,
        url: webhook.url,
        events: webhook.events,
        is_enabled: webhook.is_enabled,
        created_at: webhook.created_at,
        updated_at: webhook.updated_at,
      });
    } catch (err) {
      await errorService.reportError(err);

      return errorService.errorResponse(res, {
        code: ErrorCode.InternalServerError,
        message: DEFAULT_ERROR_MESSAGE,
      });
    }
  }

  public async deleteWebhook(req: Request, res: Response) {
    try {
      const environmentId = res.locals[ENVIRONMENT_ID_LOCALS_KEY];
      const webhookId = req.params['webhook_id'];

      if (!webhookId) {
        return errorService.errorResponse(res, {
          code: ErrorCode.BadRequest,
          message: 'Webhook ID missing',
        });
      }

      const webhook = await webhookService.deleteWebhook(webhookId, environmentId);

      if (!webhook) {
        return errorService.errorResponse(res, {
          code: ErrorCode.InternalServerError,
          message: DEFAULT_ERROR_MESSAGE,
        });
      }

      res.status(200).json({
        object: 'webhook',
        id: webhookId,
        deleted: true,
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

export default new WebhookController();
