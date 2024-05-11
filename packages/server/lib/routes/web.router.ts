import express from 'express';
import activityController from '../controllers/activity.controller';
import apiKeyController from '../controllers/apiKey.controller';
import environmentController from '../controllers/environment.controller';
import organizationController from '../controllers/organization.controller';
import previewController from '../controllers/preview.controller';
import userController from '../controllers/user.controller';
import authMiddleware from '../middleware/auth.middleware';

const webRouter = express.Router();

webRouter
  .route('/users')
  .post(
    authMiddleware.webUserAuth.bind(authMiddleware),
    userController.handleUserAuth.bind(userController)
  );

webRouter
  .route('/users/:user_id')
  .get(
    authMiddleware.webUserAuth.bind(authMiddleware),
    userController.retrieveUserWithOrg.bind(userController)
  );

webRouter
  .route('/users/:user_id')
  .post(
    authMiddleware.webUserAuth.bind(authMiddleware),
    userController.updateProfile.bind(userController)
  );

webRouter
  .route('/environments')
  .get(
    authMiddleware.webUserAuth.bind(authMiddleware),
    environmentController.listEnvironments.bind(environmentController)
  );

webRouter
  .route('/environments/:environment_id')
  .get(
    authMiddleware.webEnvironmentAuth.bind(authMiddleware),
    environmentController.retrieveEnvironment.bind(environmentController)
  );

webRouter.use(authMiddleware.webEnvironmentAuth.bind(authMiddleware));

webRouter
  .route('/environments/:environment_id')
  .post(environmentController.modifyEnvironment.bind(environmentController));

webRouter
  .route('/organizations/:organization_id')
  .post(organizationController.updateOrganization.bind(organizationController));

webRouter
  .route('/organizations/:organization_id/members')
  .get(organizationController.getOrganizationMembers.bind(organizationController));

webRouter
  .route('/organizations/:organization_id/invitations')
  .get(organizationController.getOrganizationInvitations.bind(organizationController));

webRouter
  .route('/organizations/:organization_id/invitations/:invitation_id/revoke')
  .post(organizationController.revokeOrganizationInvitation.bind(organizationController));

webRouter
  .route('/organizations/:organization_id/invitations')
  .post(organizationController.inviteUserToOrganization.bind(organizationController));

webRouter.route('/activities').get(activityController.listActivities.bind(activityController));

webRouter.route('/api-keys').post(apiKeyController.generateApiKey.bind(apiKeyController));

webRouter.route('/api-keys').get(apiKeyController.listApiKeys.bind(apiKeyController));

webRouter.route('/api-keys/:api_key_id').post(apiKeyController.updateApiKey.bind(apiKeyController));

webRouter
  .route('/api-keys/:api_key_id')
  .delete(apiKeyController.deleteApiKey.bind(apiKeyController));

webRouter.route('/connect-preview').get(previewController.preview.bind(previewController));

export default webRouter;
