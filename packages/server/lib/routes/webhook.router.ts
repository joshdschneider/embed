import express from 'express';
import webhookController from '../controllers/webhook.controller';
import authMiddleware from '../middleware/auth.middleware';

const webhookRouter = express.Router();

webhookRouter.use(authMiddleware.apiKeyAuth.bind(authMiddleware));

webhookRouter.route('/').post(webhookController.createWebhook.bind(webhookController));

webhookRouter.route('/').get(webhookController.listWebhooks.bind(webhookController));

webhookRouter.route('/:webhook_id').post(webhookController.updateWebhook.bind(webhookController));

webhookRouter.route('/:webhook_id').delete(webhookController.deleteWebhook.bind(webhookController));

webhookRouter
  .route('/:webhook_id/enable')
  .post(webhookController.enableWebhook.bind(webhookController));

webhookRouter
  .route('/:webhook_id/disable')
  .post(webhookController.disableWebhook.bind(webhookController));

webhookRouter
  .route('/:webhook_id/events')
  .get(webhookController.listWebhookEvents.bind(webhookController));

webhookRouter
  .route('/:webhook_id/events/:webhook_event_id')
  .get(webhookController.retrieveWebhookEvent.bind(webhookController));

export default webhookRouter;
