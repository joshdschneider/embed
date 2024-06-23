import { AuthScheme } from '@embed/providers';
import {
  DEFAULT_AUTO_ENABLE_ACTIONS,
  DEFAULT_AUTO_ENABLE_COLLECTIONS,
  DEFAULT_AUTO_START_SYNCS,
  DEFAULT_BRANDING,
  DEFAULT_ERROR_MESSAGE,
  DEFAULT_MULTIMODAL_EMBEDDING_MODEL,
  DEFAULT_MULTIMODAL_ENABLED,
  DEFAULT_SYNC_FREQUENCY,
  DEFAULT_TEXT_EMBEDDING_MODEL,
  EnvironmentType,
  ErrorCode,
  Organization,
  Resource,
  User,
  apiKeyService,
  environmentService,
  errorService,
  generateId,
  integrationService,
  now,
} from '@embed/shared';
import type { Request, Response } from 'express';
import organizationService from '../services/organization.service';
import userService from '../services/user.service';
import { DEFAULT_EMAIL_SUBSCRIPTIONS, DEFAULT_ORGANIZATION_NAME } from '../utils/constants';
import { generateSecretKey, zodError } from '../utils/helpers';
import { UpdateUserRequestSchema } from '../utils/types';

class UserController {
  public async handleUserAuth(req: Request, res: Response) {
    try {
      const user = req.body['user'];
      const organizationId = req.body['organization_id'] as string | undefined;

      if (!user) {
        return errorService.errorResponse(res, {
          code: ErrorCode.BadRequest,
          message: 'User missing',
        });
      }

      let _user: User;
      let _organization: Organization;

      const orgName = user.first_name ? `${user.first_name}'s Team` : DEFAULT_ORGANIZATION_NAME;
      const existingUser = await userService.getUserById(user.id);
      if (!existingUser) {
        const newUser = await userService.persistUser({
          id: user.id,
          email: user.email,
          first_name: user.first_name,
          last_name: user.last_name,
          email_subscriptions: DEFAULT_EMAIL_SUBSCRIPTIONS,
          created_at: now(),
          updated_at: now(),
          deleted_at: null,
        });

        if (!newUser) {
          return errorService.errorResponse(res, {
            code: ErrorCode.InternalServerError,
            message: DEFAULT_ERROR_MESSAGE,
          });
        }

        const newUserOrg = await organizationService.createOrganization(orgName);
        if (!newUserOrg) {
          return errorService.errorResponse(res, {
            code: ErrorCode.InternalServerError,
            message: DEFAULT_ERROR_MESSAGE,
          });
        }

        const newUserOrgMembership = await organizationService.createOrganizationMembership({
          userId: newUser.id,
          organizationId: newUserOrg.id,
        });

        if (!newUserOrgMembership) {
          return errorService.errorResponse(res, {
            code: ErrorCode.InternalServerError,
            message: DEFAULT_ERROR_MESSAGE,
          });
        }

        _user = newUser;
        _organization = newUserOrg;
      } else if (existingUser.organization_memberships.length === 0) {
        const existingUserNewOrg = await organizationService.createOrganization(orgName);
        if (!existingUserNewOrg) {
          return errorService.errorResponse(res, {
            code: ErrorCode.InternalServerError,
            message: DEFAULT_ERROR_MESSAGE,
          });
        }

        const existingUserNewOrgMembership = await organizationService.createOrganizationMembership(
          { userId: existingUser.id, organizationId: existingUserNewOrg.id }
        );

        if (!existingUserNewOrgMembership) {
          return errorService.errorResponse(res, {
            code: ErrorCode.InternalServerError,
            message: DEFAULT_ERROR_MESSAGE,
          });
        }

        _user = existingUser;
        _organization = existingUserNewOrg;
      } else {
        let existingOrgId = organizationId;
        if (!existingOrgId) {
          existingOrgId = existingUser.organization_memberships[0]!.organization_id;
        }

        if (
          !existingUser.organization_memberships.some((om) => om.organization_id === organizationId)
        ) {
          await organizationService.createOrganizationMembership({
            userId: existingUser.id,
            organizationId: existingOrgId,
          });
        }

        const existingOrg = await organizationService.getOrganizationById(existingOrgId);
        if (!existingOrg) {
          return errorService.errorResponse(res, {
            code: ErrorCode.NotFound,
            message: 'Organization not found',
          });
        }

        return res.status(200).json({
          object: 'user',
          id: existingUser.id,
          email: existingUser.email,
          first_name: existingUser.first_name,
          last_name: existingUser.last_name,
          email_subscriptions: existingUser.email_subscriptions,
          organization: {
            object: 'organization',
            id: existingOrg.id,
            name: existingOrg.name,
          },
        });
      }

      const stagingEnvironment = await environmentService.createEnvironment({
        id: generateId(Resource.Environment),
        organization_id: _organization.id,
        type: EnvironmentType.Staging,
        auto_enable_collections: DEFAULT_AUTO_ENABLE_COLLECTIONS,
        auto_enable_actions: DEFAULT_AUTO_ENABLE_ACTIONS,
        auto_start_syncs: DEFAULT_AUTO_START_SYNCS,
        default_sync_frequency: DEFAULT_SYNC_FREQUENCY,
        default_multimodal_embedding_model: DEFAULT_MULTIMODAL_EMBEDDING_MODEL,
        default_text_embedding_model: DEFAULT_TEXT_EMBEDDING_MODEL,
        multimodal_enabled_by_default: DEFAULT_MULTIMODAL_ENABLED,
        branding: DEFAULT_BRANDING,
        created_at: now(),
        updated_at: now(),
        deleted_at: null,
      });

      if (!stagingEnvironment) {
        return errorService.errorResponse(res, {
          code: ErrorCode.InternalServerError,
          message: DEFAULT_ERROR_MESSAGE,
        });
      }

      const key = generateSecretKey(EnvironmentType.Staging);
      const apiKey = await apiKeyService.createApiKey({
        id: generateId(Resource.ApiKey),
        environment_id: stagingEnvironment.id,
        key,
        key_hash: null,
        key_iv: null,
        key_tag: null,
        display_name: null,
        created_at: now(),
        updated_at: now(),
        deleted_at: null,
      });

      if (!apiKey) {
        return errorService.errorResponse(res, {
          code: ErrorCode.InternalServerError,
          message: DEFAULT_ERROR_MESSAGE,
        });
      }

      const integration = await integrationService.createIntegration({
        id: 'github-test',
        environment_id: stagingEnvironment.id,
        is_enabled: true,
        provider_key: 'github',
        auth_schemes: [AuthScheme.OAuth2],
        is_using_test_credentials: true,
        oauth_client_id: null,
        oauth_client_secret: null,
        oauth_client_secret_iv: null,
        oauth_client_secret_tag: null,
        oauth_scopes: null,
        created_at: now(),
        updated_at: now(),
        deleted_at: null,
      });

      if (!integration) {
        const err = new Error('Failed to create initial integration');
        await errorService.reportError(err);
      }

      return res.status(200).json({
        object: 'user',
        id: _user.id,
        email: _user.email,
        first_name: _user.first_name,
        last_name: _user.last_name,
        email_subscriptions: _user.email_subscriptions,
        organization: {
          object: 'organization',
          id: _organization.id,
          name: _organization.name,
        },
      });
    } catch (err) {
      await errorService.reportError(err);

      return errorService.errorResponse(res, {
        code: ErrorCode.InternalServerError,
        message: DEFAULT_ERROR_MESSAGE,
      });
    }
  }

  public async retrieveUserWithOrg(req: Request, res: Response) {
    try {
      const { user_id } = req.params;
      const { organization_id } = req.query;

      if (!user_id) {
        return errorService.errorResponse(res, {
          code: ErrorCode.BadRequest,
          message: 'User ID missing',
        });
      } else if (!organization_id || typeof organization_id !== 'string') {
        return errorService.errorResponse(res, {
          code: ErrorCode.BadRequest,
          message: 'Organization ID missing or invalid',
        });
      }

      const user = await userService.getUserById(user_id);
      if (!user) {
        return errorService.errorResponse(res, {
          code: ErrorCode.NotFound,
          message: 'User not found',
        });
      } else if (
        !user.organization_memberships.some((org) => org.organization_id === organization_id)
      ) {
        return errorService.errorResponse(res, {
          code: ErrorCode.Forbidden,
          message: `User is not a member of organization with ID ${organization_id}`,
        });
      }

      const organization = await organizationService.getOrganizationById(organization_id);
      if (!organization) {
        return errorService.errorResponse(res, {
          code: ErrorCode.NotFound,
          message: 'Organization not found',
        });
      }

      return res.status(200).json({
        object: 'user',
        id: user.id,
        email: user.email,
        first_name: user.first_name,
        last_name: user.last_name,
        email_subscriptions: user.email_subscriptions,
        organization: {
          object: 'organization',
          id: organization.id,
          name: organization.name,
        },
      });
    } catch (err) {
      await errorService.reportError(err);

      return errorService.errorResponse(res, {
        code: ErrorCode.InternalServerError,
        message: DEFAULT_ERROR_MESSAGE,
      });
    }
  }

  public async updateProfile(req: Request, res: Response) {
    try {
      const { user_id } = req.params;
      if (!user_id) {
        return errorService.errorResponse(res, {
          code: ErrorCode.BadRequest,
          message: 'User ID missing',
        });
      }

      const parsedBody = UpdateUserRequestSchema.safeParse(req.body);
      if (!parsedBody.success) {
        return errorService.errorResponse(res, {
          code: ErrorCode.BadRequest,
          message: zodError(parsedBody.error),
        });
      }

      const user = await userService.updateUser(user_id, {
        first_name: parsedBody.data.first_name,
        last_name: parsedBody.data.last_name,
        email_subscriptions: parsedBody.data.email_subscriptions,
      });

      if (!user) {
        return errorService.errorResponse(res, {
          code: ErrorCode.InternalServerError,
          message: DEFAULT_ERROR_MESSAGE,
        });
      }

      return res.status(200).json({
        object: 'user',
        id: user.id,
        email: user.email,
        first_name: user.first_name,
        last_name: user.last_name,
        email_subscriptions: user.email_subscriptions,
      });
    } catch (err) {
      await errorService.reportError(err);

      return errorService.errorResponse(res, {
        code: ErrorCode.InternalServerError,
        message: DEFAULT_ERROR_MESSAGE,
      });
    }
  }
}

export default new UserController();
