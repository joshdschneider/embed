import express from 'express';
import linkTokenController from '../controllers/linkToken.controller';
import authMiddleware from '../middleware/auth.middleware';

const linkTokenRouter = express.Router();

linkTokenRouter.use(authMiddleware.apiKeyAuth.bind(authMiddleware));

linkTokenRouter.route('/').post(linkTokenController.createLinkToken.bind(linkTokenController));

linkTokenRouter.route('/').get(linkTokenController.listLinkTokens.bind(linkTokenController));

linkTokenRouter
  .route('/:link_token_id')
  .get(linkTokenController.retrieveLinkToken.bind(linkTokenController));

linkTokenRouter
  .route('/:link_token_id')
  .post(linkTokenController.updateLinkToken.bind(linkTokenController));

export default linkTokenRouter;
