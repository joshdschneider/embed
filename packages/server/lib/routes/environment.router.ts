import express from 'express';
import environmentController from '../controllers/environment.controller';
import authMiddleware from '../middleware/auth.middleware';

const environmentRouter = express.Router();

environmentRouter.use(authMiddleware.cloudEnvironmentAuth.bind(authMiddleware));

environmentRouter
  .route('/:environment_id')
  .get(environmentController.retrieveEnvironment.bind(environmentController));

environmentRouter
  .route('/:environment_id')
  .put(environmentController.modifyEnvironment.bind(environmentController));

export default environmentRouter;
