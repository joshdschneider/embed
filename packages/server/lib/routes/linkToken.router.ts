import express from 'express';
import linkTokenController from '../controllers/linkToken.controller';
import authMiddleware from '../middleware/auth.middleware';

const linkTokenRouter = express.Router();

linkTokenRouter.use(authMiddleware.apiKeyAuth.bind(authMiddleware));

linkTokenRouter.route('/').post(linkTokenController.createLinkToken.bind(linkTokenController));

linkTokenRouter
  .route('/:token')
  .get(linkTokenController.retrieveLinkToken.bind(linkTokenController));

linkTokenRouter.route('/').put(linkTokenController.modifyLinkToken.bind(linkTokenController));

export default linkTokenRouter;
