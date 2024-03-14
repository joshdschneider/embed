import express from 'express';
import providerController from '../controllers/provider.controller';

const providerRouter = express.Router();

providerRouter.route('/').get(providerController.listProviders.bind(providerController));

providerRouter
  .route('/:unique_key')
  .get(providerController.retrieveProvider.bind(providerController));

export default providerRouter;
