import express from 'express';
import apiKeyController from '../controllers/apiKey.controller';
import environmentController from '../controllers/environment.controller';
import previewController from '../controllers/preview.controller';
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
  .post(environmentController.modifyEnvironment.bind(environmentController));

webRouter.route('/api-keys').post(apiKeyController.generateApiKey.bind(apiKeyController));

webRouter.route('/api-keys').get(apiKeyController.listApiKeys.bind(apiKeyController));

webRouter.route('/api-keys/:api_key_id').post(apiKeyController.updateApiKey.bind(apiKeyController));

webRouter
  .route('/api-keys/:api_key_id')
  .delete(apiKeyController.deleteApiKey.bind(apiKeyController));

webRouter.route('/connect-preview').get(previewController.preview.bind(previewController));

export default webRouter;
