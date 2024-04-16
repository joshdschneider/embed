import express from 'express';
import actionController from '../controllers/action.controller';
import collectionController from '../controllers/collection.controller';
import linkedAccountController from '../controllers/linkedAccount.controller';
import syncController from '../controllers/sync.controller';
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
  .route('/:linked_account_id/syncs')
  .get(syncController.listSyncs.bind(syncController));

linkedAccountRouter
  .route('/:linked_account_id/syncs/:collection_key')
  .get(syncController.retrieveSync.bind(syncController));

linkedAccountRouter
  .route('/:linked_account_id/syncs/:collection_key')
  .post(syncController.updateSync.bind(syncController));

linkedAccountRouter
  .route('/:linked_account_id/syncs/:collection_key/start')
  .post(syncController.startSync.bind(syncController));

linkedAccountRouter
  .route('/:linked_account_id/syncs/:collection_key/stop')
  .post(syncController.stopSync.bind(syncController));

linkedAccountRouter
  .route('/:linked_account_id/syncs/:collection_key/trigger')
  .post(syncController.triggerSync.bind(syncController));

linkedAccountRouter
  .route('/:linked_account_id/syncs/:collection_key/runs')
  .get(syncController.listSyncRuns.bind(syncController));

linkedAccountRouter
  .route('/:linked_account_id/syncs/:collection_key/runs/:run_id')
  .get(syncController.retrieveSyncRun.bind(syncController));

linkedAccountRouter
  .route('/:linked_account_id/collections/:collection_key')
  .get(collectionController.listCollectionRecords.bind(collectionController));

linkedAccountRouter
  .route('/:linked_account_id/collections/:collection_key/query')
  .post(collectionController.queryCollection.bind(collectionController));

linkedAccountRouter
  .route('/:linked_account_id/collections/:collection_key/:record_id')
  .get(collectionController.retrieveCollectionRecord.bind(collectionController));

linkedAccountRouter
  .route('/:linked_account_id/actions/:action_key/trigger')
  .post(actionController.triggerAction.bind(actionController));

linkedAccountRouter
  .route('/:linked_account_id/actions/:action_key/runs')
  .get(actionController.listActionRuns.bind(actionController));

linkedAccountRouter
  .route('/:linked_account_id/actions/:action_key/runs/:run_id')
  .get(actionController.retrieveActionRun.bind(actionController));

export default linkedAccountRouter;
