import express from 'express';
import integrationController from '../controllers/integration.controller';
import authMiddleware from '../middleware/auth.middleware';

const integrationRouter = express.Router();

integrationRouter
  .route('/')
  .get(
    authMiddleware.apiKeyAuth.bind(authMiddleware),
    integrationController.listIntegrations.bind(integrationController)
  );

integrationRouter
  .route('/:provider')
  .get(
    authMiddleware.apiKeyAuth.bind(authMiddleware),
    integrationController.retrieveIntegration.bind(integrationController)
  );

integrationRouter
  .route('/rerank')
  .put(
    authMiddleware.cloudEnvironmentAuth.bind(authMiddleware),
    integrationController.rerankIntegrations.bind(integrationController)
  );

integrationRouter
  .route('/enable-all')
  .put(
    authMiddleware.cloudEnvironmentAuth.bind(authMiddleware),
    integrationController.enableAllIntegrations.bind(integrationController)
  );

integrationRouter
  .route('/disable-all')
  .put(
    authMiddleware.cloudEnvironmentAuth.bind(authMiddleware),
    integrationController.disableAllIntegrations.bind(integrationController)
  );

integrationRouter
  .route('/:provider')
  .put(
    authMiddleware.apiKeyAuth.bind(authMiddleware),
    integrationController.modifyIntegration.bind(integrationController)
  );

export default integrationRouter;
