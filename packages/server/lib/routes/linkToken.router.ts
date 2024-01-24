import express from 'express';
import linkTokenController from '../controllers/linkToken.controller';
import authMiddleware from '../middleware/auth.middleware';

const linkTokenRouter = express.Router();

linkTokenRouter.use(authMiddleware.apiKeyAuth.bind(authMiddleware));

linkTokenRouter.route('/').get(linkTokenController.getLinkToken.bind(linkTokenController));

linkTokenRouter.route('/').post(linkTokenController.createLinkToken.bind(linkTokenController));

export default linkTokenRouter;
