import express from 'express';
import previewController from '../controllers/preview.controller';
import authMiddleware from '../middleware/auth.middleware';

const previewRouter = express.Router();

previewRouter.use(authMiddleware.webEnvironmentAuth.bind(authMiddleware));

previewRouter.route('/').get(previewController.preview.bind(previewController));

export default previewRouter;
