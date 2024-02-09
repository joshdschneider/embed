import express from 'express';
import apiKeyController from '../controllers/apiKey.controller';
import authMiddleware from '../middleware/auth.middleware';

const apiKeyRouter = express.Router();

apiKeyRouter.use(authMiddleware.cloudEnvironmentAuth.bind(authMiddleware));

apiKeyRouter.route('/').post(apiKeyController.generateApiKey.bind(apiKeyController));

apiKeyRouter.route('/').get(apiKeyController.listApiKeys.bind(apiKeyController));

apiKeyRouter.route('/:api_key_id').put(apiKeyController.modifyApiKey.bind(apiKeyController));

apiKeyRouter.route('/:api_key_id').delete(apiKeyController.deleteApiKey.bind(apiKeyController));

export default apiKeyRouter;
