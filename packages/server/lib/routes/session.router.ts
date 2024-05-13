import crypto from 'crypto';
import express from 'express';
import sessionController from '../controllers/session.controller';

const sessionRouter = express.Router();

sessionRouter.use((req, res, next) => {
  const nonce = crypto.randomBytes(16).toString('base64');
  res.locals['nonce'] = nonce;
  res.setHeader(
    'Content-Security-Policy',
    `script-src 'self' 'nonce-${nonce}'; style-src 'self' 'unsafe-inline'; img-src https://*;`
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
