import express from 'express';
import connectTokenController from '../controllers/connectToken.controller';
import authMiddleware from '../middleware/auth.middleware';

const connectTokenRouter = express.Router();

connectTokenRouter.use(authMiddleware.apiKeyAuth.bind(authMiddleware));

connectTokenRouter
  .route('/')
  .post(connectTokenController.createConnectToken.bind(connectTokenController));

connectTokenRouter
  .route('/')
  .get(connectTokenController.listConnectTokens.bind(connectTokenController));

connectTokenRouter
  .route('/:connect_token_id')
  .get(connectTokenController.retrieveConnectToken.bind(connectTokenController));

connectTokenRouter
  .route('/:connect_token_id')
  .delete(connectTokenController.deleteConnectToken.bind(connectTokenController));

export default connectTokenRouter;
