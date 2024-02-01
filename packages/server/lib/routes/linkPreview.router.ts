import express from 'express';
import linkPreviewController from '../controllers/linkPreview.controller';
import authMiddleware from '../middleware/auth.middleware';

const linkPreviewRouter = express.Router();

linkPreviewRouter.use(authMiddleware.cloudEnvironmentAuth.bind(authMiddleware));

linkPreviewRouter.route('/').get(linkPreviewController.listView.bind(linkPreviewController));

linkPreviewRouter
  .route('/i/:integration')
  .get(linkPreviewController.consentView.bind(linkPreviewController));

export default linkPreviewRouter;
