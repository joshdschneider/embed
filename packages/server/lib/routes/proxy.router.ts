import express from 'express';
import multer from 'multer';
import proxyController from '../controllers/proxy.controller';
import authMiddleware from '../middleware/auth.middleware';

const linkTokenRouter = express.Router();
const multerMiddleware = multer({ storage: multer.memoryStorage() });

linkTokenRouter.use(authMiddleware.apiKeyAuth.bind(authMiddleware));
linkTokenRouter.use(multerMiddleware.any());

linkTokenRouter.route('/*').all(proxyController.routeRequest.bind(proxyController));

export default linkTokenRouter;
