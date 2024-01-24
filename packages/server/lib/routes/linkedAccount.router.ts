import express from 'express';
import linkedAccountController from '../controllers/linkedAccount.controller';
import authMiddleware from '../middleware/auth.middleware';

const linkedAccountRouter = express.Router();

linkedAccountRouter.use(authMiddleware.apiKeyAuth.bind(authMiddleware));

linkedAccountRouter
  .route('/')
  .get(linkedAccountController.listLinkedAccounts.bind(linkedAccountController));

export default linkedAccountRouter;
