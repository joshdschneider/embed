import express from 'express';
import oauthController from '../controllers/oauth.controller';

const oauthRouter = express.Router();

oauthRouter.route('/authorize').get(oauthController.authorize.bind(oauthController));

oauthRouter.route('/callback').get(oauthController.callback.bind(oauthController));

export default oauthRouter;
