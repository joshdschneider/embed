import express from 'express';
import apiKeyController from '../controllers/apiKey.controller';
import linkTokenController from '../controllers/linkToken.controller';
import authMiddleware from '../middleware/auth.middleware';

const apiKeyRouter = express.Router();

apiKeyRouter.use(authMiddleware.cloudEnvironmentAuth.bind(authMiddleware));

apiKeyRouter.route('/').post(apiKeyController.generateApiKey.bind(linkTokenController));

apiKeyRouter.route('/').get(apiKeyController.listApiKeys.bind(linkTokenController));

apiKeyRouter.route('/:api_key_id').delete(apiKeyController.deleteApiKey.bind(linkTokenController));

export default apiKeyRouter;
