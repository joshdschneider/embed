import express from 'express';
import multer from 'multer';
import proxyController from '../controllers/proxy.controller';
import authMiddleware from '../middleware/auth.middleware';

const proxyRouter = express.Router();

const multerMiddleware = multer({ storage: multer.memoryStorage() });

proxyRouter.use(authMiddleware.apiKeyAuth.bind(authMiddleware));

proxyRouter.use(multerMiddleware.any());

proxyRouter.route('/*').all(proxyController.routeRequest.bind(proxyController));

export default proxyRouter;
