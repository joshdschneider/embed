import { AuthScheme } from '@embed/providers';
import type { Integration } from '@embed/shared';
import {
  DEFAULT_ERROR_MESSAGE,
  ENVIRONMENT_ID_LOCALS_KEY,
  ErrorCode,
  actionService,
  collectionService,
  environmentService,
  errorService,
  integrationService,
  now,
  providerService,
} from '@embed/shared';
import crypto from 'crypto';
import type { Request, Response } from 'express';
import integrationHook from '../hooks/integration.hook';
import { zodError } from '../utils/helpers';
import {
  CreateIntegrationRequestSchema,
  EnvironmentType,
  IntegrationDeletedObject,
  IntegrationObject,
  IntegrationObjectWithCredentials,
  PaginationParametersSchema,
  UpdateIntegrationRequestSchema,
} from '../utils/types';

class IntegrationController {
  public async listIntegrations(req: Request, res: Response) {
    try {
      const environmentId = res.locals[ENVIRONMENT_ID_LOCALS_KEY];
      const searchQuery = req.query['query'] as string | undefined;
      const parsedParams = PaginationParametersSchema.safeParse(req.query);

      if (!parsedParams.success) {
        return errorService.errorResponse(res, {
          code: ErrorCode.BadRequest,
          message: zodError(parsedParams.error),
        });
      }

      const { before, after, limit, order } = parsedParams.data;
      const list = await integrationService.listIntegrations(environmentId, {
        query: searchQuery,
        order,
        pagination: { after, before, limit },
      });

      if (!list) {
        return errorService.errorResponse(res, {
          code: ErrorCode.InternalServerError,
          message: DEFAULT_ERROR_MESSAGE,
        });
      }

      const { integrations, firstId, lastId, hasMore } = list;
      const providers = await providerService.listProviders();
      if (!providers) {
        return errorService.errorResponse(res, {
          code: ErrorCode.InternalServerError,
          message: DEFAULT_ERROR_MESSAGE,
        });
      }

      const integrationObjects: IntegrationObject[] = integrations.map((integration) => {
        const provider = providers.find((p) => p.unique_key === integration.provider_key);
        return {
          object: 'integration',
          id: integration.id,
          provider_key: integration.provider_key,
          logo_url: provider?.logo_url || null,
          logo_url_dark_mode: provider?.logo_url_dark_mode || null,
          display_name: integration.display_name,
          is_enabled: integration.is_enabled,
          auth_schemes: integration.auth_schemes as AuthScheme[],
          connection_count: integration.connection_count,
          created_at: integration.created_at,
          updated_at: integration.updated_at,
        };
      });

      res.status(200).json({
        object: 'list',
        data: integrationObjects,
        first_id: firstId,
        last_id: lastId,
        has_more: hasMore,
      });
    } catch (err) {
      await errorService.reportError(err);

      return errorService.errorResponse(res, {
        code: ErrorCode.InternalServerError,
        message: DEFAULT_ERROR_MESSAGE,
      });
    }
  }

  public async retrieveIntegration(req: Request, res: Response) {
    try {
      const integrationId = req.params['integration_id'];
      const includeCredentials = req.query['include_credentials'] === 'true';

      if (!integrationId) {
        return errorService.errorResponse(res, {
          code: ErrorCode.BadRequest,
          message: 'Integration ID missing',
        });
      }

      const integration = await integrationService.getIntegrationById(integrationId);
      if (!integration) {
        return errorService.errorResponse(res, {
          code: ErrorCode.NotFound,
          message: 'Integration not found',
        });
      }

      const provider = await providerService.getProviderSpec(integration.provider_key);
      if (!provider) {
        return errorService.errorResponse(res, {
          code: ErrorCode.InternalServerError,
          message: `Provider specification not found for integration ${integration.provider_key}`,
        });
      }

      if (includeCredentials) {
        const integrationObject: IntegrationObjectWithCredentials = {
          object: 'integration',
          id: integration.id,
          provider_key: integration.provider_key,
          logo_url: provider.logo_url,
          logo_url_dark_mode: provider.logo_url_dark_mode || null,
          display_name: integration.display_name,
          is_enabled: integration.is_enabled,
          auth_schemes: integration.auth_schemes as AuthScheme[],
          is_using_test_credentials: integration.is_using_test_credentials,
          oauth_client_id: integration.oauth_client_id,
          oauth_client_secret: integration.oauth_client_secret,
          oauth_scopes: integration.oauth_scopes ? integration.oauth_scopes.split(',') : [],
          created_at: integration.created_at,
          updated_at: integration.updated_at,
        };

        res.status(200).send(integrationObject);
      } else {
        const integrationObject: IntegrationObject = {
          object: 'integration',
          id: integration.id,
          provider_key: integration.provider_key,
          logo_url: provider.logo_url,
          logo_url_dark_mode: provider.logo_url_dark_mode || null,
          display_name: integration.display_name,
          is_enabled: integration.is_enabled,
          auth_schemes: integration.auth_schemes as AuthScheme[],
          created_at: integration.created_at,
          updated_at: integration.updated_at,
        };

        res.status(200).send(integrationObject);
      }
    } catch (err) {
      await errorService.reportError(err);

      return errorService.errorResponse(res, {
        code: ErrorCode.InternalServerError,
        message: DEFAULT_ERROR_MESSAGE,
      });
    }
  }

  public async enableIntegration(req: Request, res: Response) {
    try {
      const integrationId = req.params['integration_id'];
      if (!integrationId) {
        return errorService.errorResponse(res, {
          code: ErrorCode.BadRequest,
          message: 'Integration unique key missing',
        });
      }

      const integration = await integrationService.getIntegrationById(integrationId);
      if (!integration) {
        return errorService.errorResponse(res, {
          code: ErrorCode.NotFound,
          message: 'Integration not found',
        });
      }

      const provider = await providerService.getProviderSpec(integration.provider_key);
      if (!provider) {
        return errorService.errorResponse(res, {
          code: ErrorCode.InternalServerError,
          message: DEFAULT_ERROR_MESSAGE,
        });
      }

      const updatedIntegration = await integrationService.updateIntegration(integrationId, {
        is_enabled: true,
      });

      if (!updatedIntegration) {
        return errorService.errorResponse(res, {
          code: ErrorCode.InternalServerError,
          message: DEFAULT_ERROR_MESSAGE,
        });
      }

      const integrationObject: IntegrationObject = {
        object: 'integration',
        id: updatedIntegration.id,
        provider_key: updatedIntegration.provider_key,
        display_name: updatedIntegration.display_name,
        logo_url: provider.logo_url,
        logo_url_dark_mode: provider.logo_url_dark_mode || null,
        is_enabled: updatedIntegration.is_enabled,
        auth_schemes: integration.auth_schemes as AuthScheme[],
        created_at: updatedIntegration.created_at,
        updated_at: updatedIntegration.updated_at,
      };

      res.status(200).send(integrationObject);
    } catch (err) {
      await errorService.reportError(err);

      return errorService.errorResponse(res, {
        code: ErrorCode.InternalServerError,
        message: DEFAULT_ERROR_MESSAGE,
      });
    }
  }

  public async disableIntegration(req: Request, res: Response) {
    try {
      const integrationId = req.params['integration_id'];
      if (!integrationId) {
        return errorService.errorResponse(res, {
          code: ErrorCode.BadRequest,
          message: 'Integration unique key missing',
        });
      }

      const integration = await integrationService.getIntegrationById(integrationId);
      if (!integration) {
        return errorService.errorResponse(res, {
          code: ErrorCode.NotFound,
          message: 'Integration not found',
        });
      }

      const provider = await providerService.getProviderSpec(integration.provider_key);
      if (!provider) {
        return errorService.errorResponse(res, {
          code: ErrorCode.InternalServerError,
          message: DEFAULT_ERROR_MESSAGE,
        });
      }

      const updatedIntegration = await integrationService.updateIntegration(integrationId, {
        is_enabled: false,
      });

      if (!updatedIntegration) {
        return errorService.errorResponse(res, {
          code: ErrorCode.InternalServerError,
          message: DEFAULT_ERROR_MESSAGE,
        });
      }

      integrationHook.onIntegrationDisabled(updatedIntegration);

      const integrationObject: IntegrationObject = {
        object: 'integration',
        id: updatedIntegration.id,
        provider_key: updatedIntegration.provider_key,
        display_name: updatedIntegration.display_name,
        is_enabled: updatedIntegration.is_enabled,
        logo_url: provider.logo_url,
        logo_url_dark_mode: provider.logo_url_dark_mode || null,
        auth_schemes: integration.auth_schemes as AuthScheme[],
        created_at: updatedIntegration.created_at,
        updated_at: updatedIntegration.updated_at,
      };

      res.status(200).send(integrationObject);
    } catch (err) {
      await errorService.reportError(err);

      return errorService.errorResponse(res, {
        code: ErrorCode.InternalServerError,
        message: DEFAULT_ERROR_MESSAGE,
      });
    }
  }

  public async createIntegration(req: Request, res: Response) {
    try {
      const environmentId = res.locals[ENVIRONMENT_ID_LOCALS_KEY];
      const parsedBody = CreateIntegrationRequestSchema.safeParse(req.body);
      if (!parsedBody.success) {
        return errorService.errorResponse(res, {
          code: ErrorCode.BadRequest,
          message: zodError(parsedBody.error),
        });
      }

      const {
        provider_key,
        auth_schemes,
        display_name,
        use_test_credentials,
        oauth_client_id,
        oauth_client_secret,
        oauth_scopes,
      } = parsedBody.data;

      const provider = await providerService.getProviderSpec(provider_key);
      if (!provider) {
        return errorService.errorResponse(res, {
          code: ErrorCode.InternalServerError,
          message: `Provider not found with key ${provider_key}`,
        });
      }

      const environment = await environmentService.getEnvironmentById(environmentId);
      if (!environment) {
        return errorService.errorResponse(res, {
          code: ErrorCode.InternalServerError,
          message: DEFAULT_ERROR_MESSAGE,
        });
      }

      const authSchemes = provider.auth.map((auth) => auth.scheme);
      if (auth_schemes && auth_schemes.some((auth) => !authSchemes.includes(auth as AuthScheme))) {
        return errorService.errorResponse(res, {
          code: ErrorCode.BadRequest,
          message: `Auth scheme(s) not supported by provider: ${auth_schemes.join(', ')}`,
        });
      }

      if (auth_schemes?.includes(AuthScheme.OAuth2)) {
        if (use_test_credentials) {
          if (environment.type === EnvironmentType.Production) {
            return errorService.errorResponse(res, {
              code: ErrorCode.BadRequest,
              message: 'Test credentials not allowed in production environment',
            });
          }
        }

        if (!use_test_credentials && (!oauth_client_id || !oauth_client_secret)) {
          return errorService.errorResponse(res, {
            code: ErrorCode.BadRequest,
            message: 'OAuth credentials required',
          });
        }
      }

      const createdIntegration = await integrationService.createIntegration({
        id: IntegrationController.generateId(provider_key),
        environment_id: environmentId,
        is_enabled: true,
        provider_key,
        auth_schemes: auth_schemes || authSchemes,
        display_name: display_name || null,
        is_using_test_credentials: use_test_credentials || false,
        oauth_client_id: oauth_client_id || null,
        oauth_client_secret: oauth_client_secret || null,
        oauth_client_secret_iv: null,
        oauth_client_secret_tag: null,
        oauth_scopes: !oauth_scopes ? null : oauth_scopes.join(','),
        created_at: now(),
        updated_at: now(),
        deleted_at: null,
      });

      if (!createdIntegration) {
        return errorService.errorResponse(res, {
          code: ErrorCode.InternalServerError,
          message: DEFAULT_ERROR_MESSAGE,
        });
      }

      if (provider.collections && provider.collections.length > 0) {
        for (const collection of provider.collections) {
          await collectionService.createCollection({
            unique_key: collection.unique_key,
            provider_key: provider.unique_key,
            environment_id: createdIntegration.environment_id,
            integration_id: createdIntegration.id,
            is_enabled: environment.auto_enable_collections,
            auto_start_syncs: environment.auto_start_syncs,
            default_sync_frequency: environment.default_sync_frequency,
            exclude_properties_from_syncs: [],
            multimodal_embedding_model: environment.default_multimodal_embedding_model,
            text_embedding_model: environment.default_text_embedding_model,
            multimodal_enabled: environment.multimodal_enabled_by_default,
            configuration: null,
            created_at: now(),
            updated_at: now(),
            deleted_at: null,
          });
        }
      }

      if (provider.actions && provider.actions.length > 0) {
        for (const action of provider.actions) {
          await actionService.createAction({
            unique_key: action.unique_key,
            provider_key: provider.unique_key,
            environment_id: createdIntegration.environment_id,
            integration_id: createdIntegration.id,
            is_enabled: environment.auto_enable_actions,
            configuration: null,
            created_at: now(),
            updated_at: now(),
            deleted_at: null,
          });
        }
      }

      const integrationObject: IntegrationObjectWithCredentials = {
        object: 'integration',
        id: createdIntegration.id,
        provider_key: createdIntegration.provider_key,
        display_name: createdIntegration.display_name,
        is_enabled: createdIntegration.is_enabled,
        logo_url: provider.logo_url,
        logo_url_dark_mode: provider.logo_url_dark_mode || null,
        auth_schemes: createdIntegration.auth_schemes as AuthScheme[],
        is_using_test_credentials: createdIntegration.is_using_test_credentials,
        oauth_client_id: createdIntegration.oauth_client_id,
        oauth_client_secret: createdIntegration.oauth_client_secret,
        oauth_scopes: createdIntegration.oauth_scopes
          ? createdIntegration.oauth_scopes.split(',')
          : [],
        created_at: createdIntegration.created_at,
        updated_at: createdIntegration.updated_at,
      };

      res.status(200).send(integrationObject);
    } catch (err) {
      await errorService.reportError(err);

      return errorService.errorResponse(res, {
        code: ErrorCode.InternalServerError,
        message: DEFAULT_ERROR_MESSAGE,
      });
    }
  }

  private static generateId(providerKey: string, byteLength: number = 8) {
    return `${providerKey.replace('-', '_')}_${crypto.randomBytes(byteLength).toString('hex')}`;
  }

  public async updateIntegration(req: Request, res: Response) {
    try {
      const environmentId = res.locals[ENVIRONMENT_ID_LOCALS_KEY];
      const integrationId = req.params['integration_id'];
      if (!integrationId) {
        return errorService.errorResponse(res, {
          code: ErrorCode.BadRequest,
          message: 'Integration unique key missing',
        });
      }

      const integration = await integrationService.getIntegrationById(integrationId);
      if (!integration) {
        return errorService.errorResponse(res, {
          code: ErrorCode.NotFound,
          message: 'Integration not found',
        });
      }

      const provider = await providerService.getProviderSpec(integration.provider_key);
      if (!provider) {
        return errorService.errorResponse(res, {
          code: ErrorCode.InternalServerError,
          message: `Provider specification not found for integration ${integration.provider_key}`,
        });
      }

      const parsedBody = UpdateIntegrationRequestSchema.safeParse(req.body);
      if (!parsedBody.success) {
        return errorService.errorResponse(res, {
          code: ErrorCode.BadRequest,
          message: zodError(parsedBody.error),
        });
      }

      const {
        display_name,
        is_using_test_credentials,
        oauth_client_id,
        oauth_client_secret,
        oauth_scopes,
      } = parsedBody.data;

      if (integration.auth_schemes.includes(AuthScheme.OAuth2)) {
        if (is_using_test_credentials) {
          const environment = await environmentService.getEnvironmentById(environmentId);
          if (!environment) {
            return errorService.errorResponse(res, {
              code: ErrorCode.InternalServerError,
              message: DEFAULT_ERROR_MESSAGE,
            });
          }

          if (environment.type === EnvironmentType.Production) {
            return errorService.errorResponse(res, {
              code: ErrorCode.BadRequest,
              message: 'Test credentials not allowed in production environment',
            });
          }
        }

        if (is_using_test_credentials === false && (!oauth_client_id || !oauth_client_secret)) {
          return errorService.errorResponse(res, {
            code: ErrorCode.BadRequest,
            message: 'OAuth credentials required',
          });
        }
      }

      const data: Partial<Integration> = { updated_at: now() };
      if (typeof display_name !== 'undefined') {
        data.display_name = display_name;
      }

      if (
        typeof is_using_test_credentials === 'boolean' &&
        integration.auth_schemes.includes(AuthScheme.OAuth2)
      ) {
        data.is_using_test_credentials = is_using_test_credentials;
      }

      if (
        typeof oauth_client_id !== 'undefined' &&
        integration.auth_schemes.includes(AuthScheme.OAuth2)
      ) {
        data.oauth_client_id = oauth_client_id;
      }

      if (
        typeof oauth_client_secret !== 'undefined' &&
        integration.auth_schemes.includes(AuthScheme.OAuth2)
      ) {
        data.oauth_client_secret = oauth_client_secret;
      }

      if (
        typeof oauth_scopes !== 'undefined' &&
        integration.auth_schemes.includes(AuthScheme.OAuth2)
      ) {
        data.oauth_scopes = oauth_scopes === null ? null : oauth_scopes.join(',');
      }

      const updatedIntegration = await integrationService.updateIntegration(integrationId, {
        ...data,
      });

      if (!updatedIntegration) {
        return errorService.errorResponse(res, {
          code: ErrorCode.InternalServerError,
          message: DEFAULT_ERROR_MESSAGE,
        });
      }

      const integrationObject: IntegrationObjectWithCredentials = {
        object: 'integration',
        id: updatedIntegration.id,
        provider_key: updatedIntegration.provider_key,
        display_name: updatedIntegration.display_name,
        is_enabled: updatedIntegration.is_enabled,
        logo_url: provider.logo_url,
        logo_url_dark_mode: provider.logo_url_dark_mode || null,
        auth_schemes: updatedIntegration.auth_schemes as AuthScheme[],
        is_using_test_credentials: updatedIntegration.is_using_test_credentials,
        oauth_client_id: updatedIntegration.oauth_client_id,
        oauth_client_secret: updatedIntegration.oauth_client_secret,
        oauth_scopes: updatedIntegration.oauth_scopes
          ? updatedIntegration.oauth_scopes.split(',')
          : [],
        created_at: updatedIntegration.created_at,
        updated_at: updatedIntegration.updated_at,
      };

      res.status(200).send(integrationObject);
    } catch (err) {
      await errorService.reportError(err);

      return errorService.errorResponse(res, {
        code: ErrorCode.InternalServerError,
        message: DEFAULT_ERROR_MESSAGE,
      });
    }
  }

  public async deleteIntegration(req: Request, res: Response) {
    try {
      const integrationId = req.params['integration_id'];
      if (!integrationId) {
        return errorService.errorResponse(res, {
          code: ErrorCode.BadRequest,
          message: 'Integration unique key missing',
        });
      }

      const integrationDeleted = await integrationService.deleteIntegration(integrationId);
      if (!integrationDeleted) {
        return errorService.errorResponse(res, {
          code: ErrorCode.BadRequest,
          message: 'Failed to delete integration',
        });
      }

      const integrationDeletedObject: IntegrationDeletedObject = {
        object: 'integration.deleted',
        id: integrationId,
        deleted: true,
      };

      res.status(200).json(integrationDeletedObject);
    } catch (err) {
      await errorService.reportError(err);

      return errorService.errorResponse(res, {
        code: ErrorCode.InternalServerError,
        message: DEFAULT_ERROR_MESSAGE,
      });
    }
  }
}

export default new IntegrationController();
