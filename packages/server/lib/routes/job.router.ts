import express from 'express';
import jobsController from '../controllers/jobs.controller';
import authMiddleware from '../middleware/auth.middleware';

const jobRouter = express.Router();

jobRouter.use(authMiddleware.internalAuth.bind(authMiddleware));

jobRouter.route('/add-new-provider').post(jobsController.addNewProvider.bind(jobsController));

export default jobRouter;
