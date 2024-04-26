import express from 'express';
import linkController from '../controllers/link.controller';

const linkRouter = express.Router();

linkRouter.use((req, res, next) => {
  res.setHeader(
    'Content-Security-Policy',
    "default-src 'self'; img-src https://*; style-src 'self' 'unsafe-inline';"
  );
  next();
});

linkRouter.route('/:token').get(linkController.routeView.bind(linkController));

linkRouter.route('/:token/oauth').get(linkController.oauthView.bind(linkController));

linkRouter.route('/:token/oauth').post(linkController.upsertOauthConfig.bind(linkController));

linkRouter.route('/:token/api-key').get(linkController.apiKeyAuthView.bind(linkController));

linkRouter.route('/:token/api-key').post(linkController.upsertApiKey.bind(linkController));

linkRouter.route('/:token/basic').get(linkController.basicAuthView.bind(linkController));

linkRouter.route('/:token/basic').post(linkController.upsertBasic.bind(linkController));

export default linkRouter;
