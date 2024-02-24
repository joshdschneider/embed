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
import { generateWebhookSigningSecret, zodError } from '../utils/helpers';
import {
  CreateWebhookRequestSchema,
  UpdateWebhookRequestSchema,
  WebhookDeletedObject,
  WebhookEventObject,
  WebhookObject,
} from '../utils/types';

class WebhookController {
  public async createWebhook(req: Request, res: Response) {
    try {
      const environmentId = res.locals[ENVIRONMENT_ID_LOCALS_KEY];
      const parsedBody = CreateWebhookRequestSchema.safeParse(req.body);

      if (!parsedBody.success) {
        return errorService.errorResponse(res, {
          code: ErrorCode.BadRequest,
          message: zodError(parsedBody.error),
        });
      }

      const { url, events } = parsedBody.data;

      try {
        new URL(url);
      } catch {
        return errorService.errorResponse(res, {
          code: ErrorCode.BadRequest,
          message: 'Invalid webhook url',
        });
      }

      const webhook = await webhookService.createWebhook({
        id: generateId(Resource.Webhook),
        environment_id: environmentId,
        url,
        event_subscriptions: events,
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

      const webhookObject: WebhookObject = {
        object: 'webhook',
        id: webhook.id,
        url: webhook.url,
        events: webhook.event_subscriptions,
        is_enabled: webhook.is_enabled,
        signing_secret: webhook.secret,
        created_at: webhook.created_at,
        updated_at: webhook.updated_at,
      };

      res.status(201).json(webhookObject);
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

      const webhookObjects: WebhookObject[] = webhooks.map((webhook) => ({
        object: 'webhook',
        id: webhook.id,
        url: webhook.url,
        events: webhook.event_subscriptions,
        is_enabled: webhook.is_enabled,
        signing_secret: webhook.secret,
        created_at: webhook.created_at,
        updated_at: webhook.updated_at,
      }));

      res.status(200).json({
        object: 'list',
        data: webhookObjects,
      });
    } catch (err) {
      await errorService.reportError(err);

      return errorService.errorResponse(res, {
        code: ErrorCode.InternalServerError,
        message: DEFAULT_ERROR_MESSAGE,
      });
    }
  }

  public async retrieveWebhook(req: Request, res: Response) {
    try {
      const webhookId = req.params['webhook_id'];
      if (!webhookId) {
        return errorService.errorResponse(res, {
          code: ErrorCode.BadRequest,
          message: 'Webhook ID missing',
        });
      }

      const webhook = await webhookService.retrieveWebhook(webhookId);
      if (!webhook) {
        return errorService.errorResponse(res, {
          code: ErrorCode.NotFound,
          message: 'Webhook not found',
        });
      }

      const webhookObject: WebhookObject = {
        object: 'webhook',
        id: webhook.id,
        url: webhook.url,
        events: webhook.event_subscriptions,
        is_enabled: webhook.is_enabled,
        signing_secret: webhook.secret,
        created_at: webhook.created_at,
        updated_at: webhook.updated_at,
      };

      res.status(200).json(webhookObject);
    } catch (err) {
      await errorService.reportError(err);

      return errorService.errorResponse(res, {
        code: ErrorCode.InternalServerError,
        message: DEFAULT_ERROR_MESSAGE,
      });
    }
  }

  public async updateWebhook(req: Request, res: Response) {
    try {
      const webhookId = req.params['webhook_id'];
      if (!webhookId) {
        return errorService.errorResponse(res, {
          code: ErrorCode.BadRequest,
          message: 'Webhook ID missing',
        });
      }

      const parsedBody = UpdateWebhookRequestSchema.safeParse(req.body);
      if (!parsedBody.success) {
        return errorService.errorResponse(res, {
          code: ErrorCode.BadRequest,
          message: zodError(parsedBody.error),
        });
      }

      const { url, events } = parsedBody.data;

      if (typeof url !== 'undefined') {
        try {
          new URL(url);
        } catch {
          return errorService.errorResponse(res, {
            code: ErrorCode.BadRequest,
            message: 'Invalid webhook url',
          });
        }
      }

      const webhook = await webhookService.updateWebhook(webhookId, {
        url,
        event_subscriptions: events,
      });

      if (!webhook) {
        return errorService.errorResponse(res, {
          code: ErrorCode.InternalServerError,
          message: DEFAULT_ERROR_MESSAGE,
        });
      }

      const webhookObject: WebhookObject = {
        object: 'webhook',
        id: webhook.id,
        url: webhook.url,
        events: webhook.event_subscriptions,
        is_enabled: webhook.is_enabled,
        signing_secret: webhook.secret,
        created_at: webhook.created_at,
        updated_at: webhook.updated_at,
      };

      res.status(200).json(webhookObject);
    } catch (err) {
      await errorService.reportError(err);

      return errorService.errorResponse(res, {
        code: ErrorCode.InternalServerError,
        message: DEFAULT_ERROR_MESSAGE,
      });
    }
  }

  public async enableWebhook(req: Request, res: Response) {
    try {
      const webhookId = req.params['webhook_id'];
      if (!webhookId) {
        return errorService.errorResponse(res, {
          code: ErrorCode.BadRequest,
          message: 'Webhook ID missing',
        });
      }

      const webhook = await webhookService.updateWebhook(webhookId, {
        is_enabled: true,
      });

      if (!webhook) {
        return errorService.errorResponse(res, {
          code: ErrorCode.InternalServerError,
          message: DEFAULT_ERROR_MESSAGE,
        });
      }

      const webhookObject: WebhookObject = {
        object: 'webhook',
        id: webhook.id,
        url: webhook.url,
        events: webhook.event_subscriptions,
        is_enabled: webhook.is_enabled,
        signing_secret: webhook.secret,
        created_at: webhook.created_at,
        updated_at: webhook.updated_at,
      };

      res.status(200).json(webhookObject);
    } catch (err) {
      await errorService.reportError(err);

      return errorService.errorResponse(res, {
        code: ErrorCode.InternalServerError,
        message: DEFAULT_ERROR_MESSAGE,
      });
    }
  }

  public async disableWebhook(req: Request, res: Response) {
    try {
      const webhookId = req.params['webhook_id'];
      if (!webhookId) {
        return errorService.errorResponse(res, {
          code: ErrorCode.BadRequest,
          message: 'Webhook ID missing',
        });
      }

      const webhook = await webhookService.updateWebhook(webhookId, {
        is_enabled: false,
      });

      if (!webhook) {
        return errorService.errorResponse(res, {
          code: ErrorCode.InternalServerError,
          message: DEFAULT_ERROR_MESSAGE,
        });
      }

      const webhookObject: WebhookObject = {
        object: 'webhook',
        id: webhook.id,
        url: webhook.url,
        events: webhook.event_subscriptions,
        is_enabled: webhook.is_enabled,
        signing_secret: webhook.secret,
        created_at: webhook.created_at,
        updated_at: webhook.updated_at,
      };

      res.status(200).json(webhookObject);
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
      const webhookId = req.params['webhook_id'];
      if (!webhookId) {
        return errorService.errorResponse(res, {
          code: ErrorCode.BadRequest,
          message: 'Webhook ID missing',
        });
      }

      const deletedWebhook = await webhookService.deleteWebhook(webhookId);
      if (!deletedWebhook) {
        return errorService.errorResponse(res, {
          code: ErrorCode.InternalServerError,
          message: DEFAULT_ERROR_MESSAGE,
        });
      }

      const webhookDeletedObject: WebhookDeletedObject = {
        object: 'webhook.deleted',
        id: webhookId,
        deleted: true,
      };

      res.status(200).json(webhookDeletedObject);
    } catch (err) {
      await errorService.reportError(err);

      return errorService.errorResponse(res, {
        code: ErrorCode.InternalServerError,
        message: DEFAULT_ERROR_MESSAGE,
      });
    }
  }

  public async listWebhookEvents(req: Request, res: Response) {
    try {
      const webhookId = req.params['webhook_id'];
      if (!webhookId) {
        return errorService.errorResponse(res, {
          code: ErrorCode.BadRequest,
          message: 'Webhook ID missing',
        });
      }

      const webhookEvents = await webhookService.listWebhookEvents(webhookId);
      if (!webhookEvents) {
        return errorService.errorResponse(res, {
          code: ErrorCode.InternalServerError,
          message: DEFAULT_ERROR_MESSAGE,
        });
      }

      const webhookEventObjects: WebhookEventObject[] = webhookEvents.map((e) => {
        return {
          object: 'webhook_event',
          id: e.id,
          event: e.name,
          webhook: e.webhook_id,
          payload: e.payload as Record<string, any>,
          delivered: e.delivered,
          timestamp: e.timestamp,
        };
      });

      res.status(200).json({
        object: 'list',
        data: webhookEventObjects,
      });
    } catch (err) {
      await errorService.reportError(err);

      return errorService.errorResponse(res, {
        code: ErrorCode.InternalServerError,
        message: DEFAULT_ERROR_MESSAGE,
      });
    }
  }

  public async retrieveWebhookEvent(req: Request, res: Response) {
    try {
      const webhookId = req.params['webhook_id'];
      const webhookEventId = req.params['webhook_event_id'];

      if (!webhookId) {
        return errorService.errorResponse(res, {
          code: ErrorCode.BadRequest,
          message: 'Webhook ID missing',
        });
      } else if (!webhookEventId) {
        return errorService.errorResponse(res, {
          code: ErrorCode.BadRequest,
          message: 'Webhook event ID missing',
        });
      }

      const webhookEvent = await webhookService.retrieveWebhookEvent(webhookId, webhookEventId);

      if (!webhookEvent) {
        return errorService.errorResponse(res, {
          code: ErrorCode.NotFound,
          message: 'Webhook event not found',
        });
      }

      const webhookEventObject: WebhookEventObject = {
        object: 'webhook_event',
        id: webhookEvent.id,
        event: webhookEvent.name,
        webhook: webhookEvent.webhook_id,
        payload: webhookEvent.payload as Record<string, any>,
        delivered: webhookEvent.delivered,
        timestamp: webhookEvent.timestamp,
      };

      res.status(200).json(webhookEventObject);
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
