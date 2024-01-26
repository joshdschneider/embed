import express from 'express';
import linkedAccountController from '../controllers/linkedAccount.controller';
import authMiddleware from '../middleware/auth.middleware';

const linkedAccountRouter = express.Router();

linkedAccountRouter.use(authMiddleware.apiKeyAuth.bind(authMiddleware));

linkedAccountRouter
  .route('/')
  .get(linkedAccountController.listLinkedAccounts.bind(linkedAccountController));

linkedAccountRouter
  .route('/:linked_account_id')
  .get(linkedAccountController.retrieveLinkedAccount.bind(linkedAccountController));

linkedAccountRouter
  .route('/:linked_account_id')
  .delete(linkedAccountController.deleteLinkedAccount.bind(linkedAccountController));

export default linkedAccountRouter;
