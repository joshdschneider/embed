import express from 'express';
import connectionController from '../controllers/connection.controller';
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
  .put(connectionController.updateConnection.bind(connectionController));

connectionRouter
  .route('/:connection_id')
  .delete(connectionController.deleteConnection.bind(connectionController));

export default connectionRouter;
