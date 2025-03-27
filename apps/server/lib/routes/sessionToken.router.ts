import express from 'express';
import sessionTokenController from '../controllers/sessionToken.controller';
import authMiddleware from '../middleware/auth.middleware';

const sessionTokenRouter = express.Router();

sessionTokenRouter.use(authMiddleware.apiKeyAuth.bind(authMiddleware));

sessionTokenRouter
  .route('/')
  .post(sessionTokenController.createSessionToken.bind(sessionTokenController));

sessionTokenRouter
  .route('/')
  .get(sessionTokenController.listSessionTokens.bind(sessionTokenController));

sessionTokenRouter
  .route('/:session_token_id')
  .get(sessionTokenController.retrieveSessionToken.bind(sessionTokenController));

sessionTokenRouter
  .route('/:session_token_id')
  .delete(sessionTokenController.deleteSessionToken.bind(sessionTokenController));

export default sessionTokenRouter;
