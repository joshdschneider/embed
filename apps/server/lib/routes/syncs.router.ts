import express from 'express';
import syncController from '../controllers/sync.controller';
import authMiddleware from '../middleware/auth.middleware';

const syncRouter = express.Router();

syncRouter.use(authMiddleware.apiKeyAuth.bind(authMiddleware));

syncRouter.route('/').get(syncController.listSyncs.bind(syncController));

syncRouter.route('/:collection_key').get(syncController.retrieveSync.bind(syncController));

syncRouter.route('/:collection_key').put(syncController.updateSync.bind(syncController));

syncRouter.route('/:collection_key/start').post(syncController.startSync.bind(syncController));

syncRouter.route('/:collection_key/stop').post(syncController.stopSync.bind(syncController));

syncRouter.route('/:collection_key/trigger').post(syncController.triggerSync.bind(syncController));

syncRouter.route('/:collection_key/runs').get(syncController.listSyncRuns.bind(syncController));

syncRouter
  .route('/:collection_key/runs/:sync_run_id')
  .get(syncController.retrieveSyncRun.bind(syncController));

export default syncRouter;
