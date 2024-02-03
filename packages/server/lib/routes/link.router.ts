import express from 'express';
import linkController from '../controllers/link.controller';

const linkRouter = express.Router();

linkRouter.route('/:token').get(linkController.listView.bind(linkController));

linkRouter.route('/:token/i/:integration').get(linkController.consentView.bind(linkController));

linkRouter.route('/:token/i/:integration').post(linkController.saveConsent.bind(linkController));

linkRouter.route('/:token/oauth').get(linkController.oauthView.bind(linkController));

linkRouter.route('/:token/oauth').post(linkController.upsertOauthConfig.bind(linkController));

linkRouter.route('/:token/api-key').get(linkController.apiKeyAuthView.bind(linkController));

linkRouter.route('/:token/api-key').post(linkController.upsertApiKey.bind(linkController));

linkRouter.route('/:token/basic').get(linkController.basicAuthView.bind(linkController));

linkRouter.route('/:token/basic').post(linkController.upsertBasic.bind(linkController));

export default linkRouter;
