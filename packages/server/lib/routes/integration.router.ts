import express from 'express';
import actionController from '../controllers/action.controller';
import collectionController from '../controllers/collection.controller';
import integrationController from '../controllers/integration.controller';
import authMiddleware from '../middleware/auth.middleware';

const integrationRouter = express.Router();

integrationRouter.use(authMiddleware.apiKeyAuth.bind(authMiddleware));

integrationRouter
  .route('/')
  .get(integrationController.listIntegrations.bind(integrationController));

integrationRouter
  .route('/rerank')
  .post(integrationController.rerankIntegrations.bind(integrationController));

integrationRouter
  .route('/:integration_key')
  .get(integrationController.retrieveIntegration.bind(integrationController));

integrationRouter
  .route('/:integration_key')
  .post(integrationController.updateIntegration.bind(integrationController));

integrationRouter
  .route('/:integration_key/enable')
  .post(integrationController.enableIntegration.bind(integrationController));

integrationRouter
  .route('/:integration_key/disable')
  .post(integrationController.disableIntegration.bind(integrationController));

integrationRouter
  .route('/:integration_key/collections')
  .get(collectionController.listCollections.bind(collectionController));

integrationRouter
  .route('/:integration_key/collections/schemas')
  .get(collectionController.listCollectionSchemas.bind(collectionController));

integrationRouter
  .route('/:integration_key/collections/:collection_key')
  .get(collectionController.retrieveCollection.bind(collectionController));

integrationRouter
  .route('/:integration_key/collections/:collection_key')
  .post(collectionController.updateCollection.bind(collectionController));

integrationRouter
  .route('/:integration_key/collections/:collection_key/enable')
  .post(collectionController.enableCollection.bind(collectionController));

integrationRouter
  .route('/:integration_key/collections/:collection_key/disable')
  .post(collectionController.disableCollection.bind(collectionController));

integrationRouter
  .route('/:integration_key/collections/:collection_key/schema')
  .get(collectionController.retrieveCollectionSchema.bind(collectionController));

integrationRouter
  .route('/:integration_key/actions')
  .get(actionController.listActions.bind(actionController));

integrationRouter
  .route('/:integration_key/actions/schemas')
  .get(actionController.listActionSchemas.bind(actionController));

integrationRouter
  .route('/:integration_key/actions/:action_key')
  .get(actionController.retrieveAction.bind(actionController));

integrationRouter
  .route('/:integration_key/actions/:action_key/enable')
  .post(actionController.enableAction.bind(actionController));

integrationRouter
  .route('/:integration_key/actions/:action_key/disable')
  .post(actionController.disableAction.bind(actionController));

integrationRouter
  .route('/:integration_key/actions/:action_key/schema')
  .get(actionController.retrieveActionSchema.bind(actionController));

export default integrationRouter;
