import express from 'express';
import linkController from '../controllers/link.controller';

const linkRouter = express.Router();

linkRouter.route('/:token').get(linkController.listIntegrationsView.bind(linkController));

linkRouter
  .route('/:token/integration/:integration')
  .get(linkController.linkIntegrationView.bind(linkController));

export default linkRouter;
