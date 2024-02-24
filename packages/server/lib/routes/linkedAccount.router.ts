import express from 'express';
import actionController from '../controllers/action.controller';
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
  .post(linkedAccountController.updateLinkedAccount.bind(linkedAccountController));

linkedAccountRouter
  .route('/:linked_account_id')
  .delete(linkedAccountController.deleteLinkedAccount.bind(linkedAccountController));

linkedAccountRouter
  .route('/:linked_account_id/actions/:action_key/runs')
  .get(actionController.listActionRuns.bind(actionController));

linkedAccountRouter
  .route('/:linked_account_id/actions/:action_key/runs/:run_id')
  .get(actionController.retrieveActionRun.bind(actionController));

linkedAccountRouter
  .route('/:linked_account_id/actions/:action_key/trigger')
  .post(actionController.triggerAction.bind(actionController));

export default linkedAccountRouter;
