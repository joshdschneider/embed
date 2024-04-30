import express from 'express';
import connectController from '../controllers/connect.controller';

const connectRouter = express.Router();

connectRouter.use((req, res, next) => {
  res.setHeader(
    'Content-Security-Policy',
    "default-src 'self'; img-src https://*; style-src 'self' 'unsafe-inline';"
  );
  next();
});

connectRouter.route('/:token').get(connectController.routeView.bind(connectController));

connectRouter.route('/:token/oauth').get(connectController.oauthView.bind(connectController));

connectRouter
  .route('/:token/oauth')
  .post(connectController.upsertOauthConfig.bind(connectController));

connectRouter
  .route('/:token/api-key')
  .get(connectController.apiKeyAuthView.bind(connectController));

connectRouter.route('/:token/api-key').post(connectController.upsertApiKey.bind(connectController));

connectRouter.route('/:token/basic').get(connectController.basicAuthView.bind(connectController));

connectRouter.route('/:token/basic').post(connectController.upsertBasic.bind(connectController));

connectRouter
  .route('/:token/service-account')
  .get(connectController.serviceAccountAuthView.bind(connectController));

connectRouter
  .route('/:token/service-account')
  .post(connectController.upsertServiceAccount.bind(connectController));

export default connectRouter;
