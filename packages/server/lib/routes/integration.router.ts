import express from 'express';
import integrationController from '../controllers/integration.controller';
import authMiddleware from '../middleware/auth.middleware';

const integrationRouter = express.Router();

integrationRouter.use(authMiddleware.apiKeyAuth.bind(authMiddleware));

integrationRouter
  .route('/')
  .get(integrationController.listIntegrations.bind(integrationController));

integrationRouter
  .route('/')
  .post(integrationController.createIntegration.bind(integrationController));

integrationRouter
  .route('/:integration_id')
  .get(integrationController.retrieveIntegration.bind(integrationController));

integrationRouter
  .route('/:integration_id')
  .put(integrationController.updateIntegration.bind(integrationController));

integrationRouter
  .route('/:integration_id')
  .delete(integrationController.deleteIntegration.bind(integrationController));

integrationRouter
  .route('/:integration_id/enable')
  .post(integrationController.enableIntegration.bind(integrationController));

integrationRouter
  .route('/:integration_id/disable')
  .post(integrationController.disableIntegration.bind(integrationController));

export default integrationRouter;
