import express from 'express';
import sessionController from '../controllers/session.controller';

const sessionRouter = express.Router();

sessionRouter.use((req, res, next) => {
  res.setHeader(
    'Content-Security-Policy',
    "default-src 'self'; img-src https://*; script-src 'self' 'unsafe-inline'; style-src 'self' 'unsafe-inline';"
  );
  next();
});

sessionRouter.route('/:token').get(sessionController.routeView.bind(sessionController));

sessionRouter.route('/:token/oauth').get(sessionController.oauthView.bind(sessionController));

sessionRouter
  .route('/:token/oauth')
  .post(sessionController.upsertOauthConfig.bind(sessionController));

sessionRouter
  .route('/:token/api-key')
  .get(sessionController.apiKeyAuthView.bind(sessionController));

sessionRouter.route('/:token/api-key').post(sessionController.upsertApiKey.bind(sessionController));

sessionRouter.route('/:token/basic').get(sessionController.basicAuthView.bind(sessionController));

sessionRouter.route('/:token/basic').post(sessionController.upsertBasic.bind(sessionController));

sessionRouter
  .route('/:token/service-account')
  .get(sessionController.serviceAccountAuthView.bind(sessionController));

sessionRouter
  .route('/:token/service-account')
  .post(sessionController.upsertServiceAccount.bind(sessionController));

export default sessionRouter;
