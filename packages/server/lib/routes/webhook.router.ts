import express from 'express';
import webhookController from '../controllers/webhook.controller';
import authMiddleware from '../middleware/auth.middleware';

const webhookRouter = express.Router();

webhookRouter.use(authMiddleware.apiKeyAuth.bind(authMiddleware));

webhookRouter.route('/').post(webhookController.createWebhook.bind(webhookController));

webhookRouter.route('/').get(webhookController.listWebhooks.bind(webhookController));

webhookRouter.route('/:webhook_id').put(webhookController.modifyWebhook.bind(webhookController));

webhookRouter.route('/:webhook_id').delete(webhookController.deleteWebhook.bind(webhookController));

export default webhookRouter;
