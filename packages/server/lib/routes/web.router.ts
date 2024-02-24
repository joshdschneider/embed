import express from 'express';
import apiKeyController from '../controllers/apiKey.controller';
import environmentController from '../controllers/environment.controller';
import integrationController from '../controllers/integration.controller';
import linkPreviewController from '../controllers/linkPreview.controller';
import userController from '../controllers/user.controller';
import authMiddleware from '../middleware/auth.middleware';

const webRouter = express.Router();

webRouter
  .route('/users/:user_id')
  .get(
    authMiddleware.webUserAuth.bind(authMiddleware),
    userController.retrieveUser.bind(userController)
  );

webRouter
  .route('/users/:user_id/account')
  .get(
    authMiddleware.webUserAuth.bind(authMiddleware),
    userController.retrieveUserAccount.bind(userController)
  );

webRouter
  .route('/users')
  .post(
    authMiddleware.webUserAuth.bind(authMiddleware),
    userController.createUser.bind(userController)
  );

webRouter
  .route('/environments/:environment_id')
  .get(
    authMiddleware.webEnvironmentAuth.bind(authMiddleware),
    environmentController.retrieveEnvironment.bind(environmentController)
  );

webRouter.use(authMiddleware.webEnvironmentAuth.bind(authMiddleware));

webRouter
  .route('/environments/:environment_id')
  .put(environmentController.modifyEnvironment.bind(environmentController));

webRouter.route('/api-keys').post(apiKeyController.generateApiKey.bind(apiKeyController));

webRouter.route('/api-keys').get(apiKeyController.listApiKeys.bind(apiKeyController));

webRouter.route('/api-keys/:api_key_id').put(apiKeyController.modifyApiKey.bind(apiKeyController));

webRouter
  .route('/api-keys/:api_key_id')
  .delete(apiKeyController.deleteApiKey.bind(apiKeyController));

webRouter
  .route('/integrations/rerank')
  .put(integrationController.rerankIntegrations.bind(integrationController));

webRouter
  .route('/integrations/enable-all')
  .put(integrationController.enableAllIntegrations.bind(integrationController));

webRouter
  .route('/integrations/disable-all')
  .put(integrationController.disableAllIntegrations.bind(integrationController));

webRouter.route('/link-preview').get(linkPreviewController.listView.bind(linkPreviewController));

webRouter
  .route('/link-preview/i/:integration')
  .get(linkPreviewController.consentView.bind(linkPreviewController));

export default webRouter;
