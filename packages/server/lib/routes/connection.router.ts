import express from 'express';
import actionController from '../controllers/action.controller';
import collectionController from '../controllers/collection.controller';
import connectionController from '../controllers/connection.controller';
import syncController from '../controllers/sync.controller';
import authMiddleware from '../middleware/auth.middleware';

const connectionRouter = express.Router();

connectionRouter.use(authMiddleware.apiKeyAuth.bind(authMiddleware));

connectionRouter.route('/').get(connectionController.listConnections.bind(connectionController));

connectionRouter.route('/').post(connectionController.upsertConnection.bind(connectionController));

connectionRouter
  .route('/:connection_id')
  .get(connectionController.retrieveConnection.bind(connectionController));

connectionRouter
  .route('/:connection_id')
  .post(connectionController.updateConnection.bind(connectionController));

connectionRouter
  .route('/:connection_id')
  .delete(connectionController.deleteConnection.bind(connectionController));

connectionRouter
  .route('/:connection_id/collections/:collection_key/query')
  .post(collectionController.queryCollection.bind(collectionController));

connectionRouter
  .route('/:connection_id/collections/:collection_key/records')
  .get(collectionController.listCollectionRecords.bind(collectionController));

connectionRouter
  .route('/:connection_id/collections/:collection_key/records/:record_id')
  .get(collectionController.retrieveCollectionRecord.bind(collectionController));

connectionRouter.route('/:connection_id/syncs').get(syncController.listSyncs.bind(syncController));

connectionRouter
  .route('/:connection_id/syncs/:collection_key')
  .get(syncController.retrieveSync.bind(syncController));

connectionRouter
  .route('/:connection_id/syncs/:collection_key')
  .post(syncController.updateSync.bind(syncController));

connectionRouter
  .route('/:connection_id/syncs/:collection_key/start')
  .post(syncController.startSync.bind(syncController));

connectionRouter
  .route('/:connection_id/syncs/:collection_key/stop')
  .post(syncController.stopSync.bind(syncController));

connectionRouter
  .route('/:connection_id/syncs/:collection_key/trigger')
  .post(syncController.triggerSync.bind(syncController));

connectionRouter
  .route('/:connection_id/syncs/:collection_key/runs')
  .get(syncController.listSyncRuns.bind(syncController));

connectionRouter
  .route('/:connection_id/syncs/:collection_key/runs/:run_id')
  .get(syncController.retrieveSyncRun.bind(syncController));

connectionRouter
  .route('/:connection_id/actions/:action_key/trigger')
  .post(actionController.triggerAction.bind(actionController));

connectionRouter
  .route('/:connection_id/actions/:action_key/runs')
  .get(actionController.listActionRuns.bind(actionController));

connectionRouter
  .route('/:connection_id/actions/:action_key/runs/:run_id')
  .get(actionController.retrieveActionRun.bind(actionController));

export default connectionRouter;
