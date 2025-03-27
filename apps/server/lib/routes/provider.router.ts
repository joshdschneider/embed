import express from 'express';
import providerController from '../controllers/provider.controller';
import authMiddleware from '../middleware/auth.middleware';

const providerRouter = express.Router();

providerRouter.use(authMiddleware.apiKeyAuth.bind(authMiddleware));

providerRouter.route('/').get(providerController.listProviders.bind(providerController));

providerRouter
  .route('/:unique_key')
  .get(providerController.retrieveProvider.bind(providerController));

export default providerRouter;
