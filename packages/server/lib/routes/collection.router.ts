import express from 'express';
import collectionController from '../controllers/collection.controller';
import authMiddleware from '../middleware/auth.middleware';

const collectionRouter = express.Router();

collectionRouter.use(authMiddleware.apiKeyAuth.bind(authMiddleware));

collectionRouter.route('/').get(collectionController.listCollections.bind(collectionController));

collectionRouter
  .route('/:collection_key')
  .get(collectionController.retrieveCollection.bind(collectionController));

collectionRouter
  .route('/:collection_key')
  .put(collectionController.updateCollection.bind(collectionController));

collectionRouter
  .route('/:collection_key/enable')
  .post(collectionController.enableCollection.bind(collectionController));

collectionRouter
  .route('/:collection_key/disable')
  .post(collectionController.disableCollection.bind(collectionController));

collectionRouter
  .route('/:collection_key/query')
  .post(collectionController.queryCollection.bind(collectionController));

export default collectionRouter;
