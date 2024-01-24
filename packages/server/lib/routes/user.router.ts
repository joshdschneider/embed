import express from 'express';
import userController from '../controllers/user.controller';
import authMiddleware from '../middleware/auth.middleware';

const userRouter = express.Router();

userRouter.use(authMiddleware.cloudUserAuth.bind(authMiddleware));

userRouter.route('/:user_id').get(userController.retrieveUser.bind(userController));

userRouter.route('/:user_id/account').get(userController.retrieveUserAccount.bind(userController));

userRouter.route('/').post(userController.createUser.bind(userController));

export default userRouter;
