import express from 'express';
import jobsController from '../controllers/jobs.controller';
import authMiddleware from '../middleware/auth.middleware';

const jobRouter = express.Router();

jobRouter.use(authMiddleware.internalAuth.bind(authMiddleware));

jobRouter.route('/seed-integrations').post(jobsController.seedIntegrations.bind(jobsController));

export default jobRouter;
