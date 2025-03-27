import express from 'express';
import actionController from '../controllers/action.controller';
import authMiddleware from '../middleware/auth.middleware';

const actionRouter = express.Router();

actionRouter.use(authMiddleware.apiKeyAuth.bind(authMiddleware));

actionRouter.route('/').get(actionController.listActions.bind(actionController));

actionRouter.route('/schemas').get(actionController.listActionSchemas.bind(actionController));

actionRouter.route('/:action_key').get(actionController.retrieveAction.bind(actionController));

actionRouter
  .route('/:action_key/trigger')
  .post(actionController.triggerAction.bind(actionController));

actionRouter
  .route('/:action_key/enable')
  .post(actionController.enableAction.bind(actionController));

actionRouter
  .route('/:action_key/disable')
  .post(actionController.disableAction.bind(actionController));

actionRouter
  .route('/:action_key/schema')
  .get(actionController.retrieveActionSchema.bind(actionController));

actionRouter.route('/:action_key/runs').get(actionController.listActionRuns.bind(actionController));

actionRouter
  .route('/:action_key/runs/:action_run_id')
  .get(actionController.retrieveActionRun.bind(actionController));

export default actionRouter;
