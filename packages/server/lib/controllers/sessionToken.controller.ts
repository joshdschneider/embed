import {
  DEFAULT_ERROR_MESSAGE,
  ENVIRONMENT_ID_LOCALS_KEY,
  ErrorCode,
  LogAction,
  LogLevel,
  Resource,
  SUPPORTED_LANGUAGES,
  activityService,
  connectionService,
  errorService,
  generateId,
  getServerUrl,
  integrationService,
  now,
  providerService,
} from '@embed/shared';
import type { Request, Response } from 'express';
import sessionTokenService from '../services/sessionToken.service';
import { zodError } from '../utils/helpers';
import {
  ConnectionType,
  CreateSessionTokenRequestSchema,
  SessionTokenDeletedObject,
  SessionTokenObject,
} from '../utils/types';

class SessionTokenController {
  public async createSessionToken(req: Request, res: Response) {
    try {
      const environmentId = res.locals[ENVIRONMENT_ID_LOCALS_KEY];
      const parsedBody = CreateSessionTokenRequestSchema.safeParse(req.body);

      if (!parsedBody.success) {
        return errorService.errorResponse(res, {
          code: ErrorCode.BadRequest,
          message: zodError(parsedBody.error),
        });
      }

      const {
        integration_id: integrationId,
        connection_id: connectionId,
        expires_in_mins: expiresInMins,
        language,
        redirect_url: redirectUrl,
        type,
        display_name: displayName,
        use_file_picker,
        configuration,
        inclusions,
        exclusions,
        metadata,
      } = parsedBody.data;

      const integration = await integrationService.getIntegrationById(integrationId);
      if (!integration) {
        return errorService.errorResponse(res, {
          code: ErrorCode.NotFound,
          message: `Integration not found with ID ${integrationId}`,
        });
      }

      if (type && type === ConnectionType.Organization) {
        const providerSpec = await providerService.getProviderSpec(integration.provider_key);
        if (!providerSpec) {
          throw new Error(`Failed to get provider specifcation for ${integration.provider_key}`);
        }

        if (!providerSpec.can_have_organization_account) {
          return errorService.errorResponse(res, {
            code: ErrorCode.BadRequest,
            message: `Integration ${integration.provider_key} does not support organization connections`,
          });
        }
      } else if (type && type !== ConnectionType.Individual) {
        return errorService.errorResponse(res, {
          code: ErrorCode.BadRequest,
          message: `Invalid connection type ${type}`,
        });
      }

      if (connectionId) {
        const connection = await connectionService.getConnectionById(connectionId);
        if (!connection) {
          return errorService.errorResponse(res, {
            code: ErrorCode.NotFound,
            message: 'Can not reconnect account: Connection not found',
          });
        }

        if (connection.integration_id !== integrationId) {
          return errorService.errorResponse(res, {
            code: ErrorCode.BadRequest,
            message: `Connection ${connectionId} must reconnect to integration ${connection.integration_id}`,
          });
        }
      }

      const minMinutes = 30;
      const maxMinutes = 10080;
      const defaultMinutes = 60;

      if (expiresInMins && (expiresInMins < minMinutes || expiresInMins > maxMinutes)) {
        return errorService.errorResponse(res, {
          code: ErrorCode.BadRequest,
          message: 'Invalid expires_in_mins',
        });
      }

      const expiresAt = expiresInMins
        ? now() + expiresInMins * defaultMinutes
        : now() + minMinutes * defaultMinutes;

      if (language && SUPPORTED_LANGUAGES.indexOf(language) === -1) {
        return errorService.errorResponse(res, {
          code: ErrorCode.BadRequest,
          message: `Unsupported language ${language}`,
        });
      }

      if (redirectUrl) {
        try {
          new URL(redirectUrl);
        } catch {
          return errorService.errorResponse(res, {
            code: ErrorCode.BadRequest,
            message: 'Invalid redirect URL',
          });
        }
      }

      const sessionToken = await sessionTokenService.createSessionToken({
        id: generateId(Resource.SessionToken),
        environment_id: environmentId,
        integration_id: integrationId,
        connection_id: connectionId || null,
        expires_at: expiresAt,
        language: language || 'en',
        redirect_url: redirectUrl || null,
        type: type || null,
        display_name: displayName || null,
        use_file_picker: use_file_picker,
        configuration: configuration || null,
        inclusions: inclusions || null,
        exclusions: exclusions || null,
        metadata: metadata || null,
        code_verifier: null,
        prefers_dark_mode: false,
        request_token_secret: null,
        websocket_client_id: null,
        connect_method: null,
        created_at: now(),
        updated_at: now(),
        deleted_at: null,
      });

      if (!sessionToken) {
        return errorService.errorResponse(res, {
          code: ErrorCode.InternalServerError,
          message: DEFAULT_ERROR_MESSAGE,
        });
      }

      const activityId = await activityService.createActivity({
        id: generateId(Resource.Activity),
        environment_id: sessionToken.environment_id,
        integration_id: sessionToken.integration_id,
        connection_id: connectionId || null,
        session_token_id: sessionToken.id,
        action_key: null,
        collection_key: null,
        level: LogLevel.Info,
        action: LogAction.Connect,
        timestamp: now(),
      });

      await activityService.createActivityLog(activityId, {
        level: LogLevel.Info,
        message: 'Session token created',
        timestamp: now(),
        payload: {
          token: sessionToken.id,
          url: this.buildSessionTokenUrl(sessionToken.id),
          expires_in_mins: this.expiresInMinutes(sessionToken.expires_at),
          integration_id: sessionToken.integration_id,
          redirect_url: sessionToken.redirect_url,
          language: sessionToken.language,
          metadata: sessionToken.metadata,
          configuration: sessionToken.configuration,
        },
      });

      const sessionTokenObject: SessionTokenObject = {
        object: 'session_token',
        token: sessionToken.id,
        url: this.buildSessionTokenUrl(sessionToken.id),
        expires_in_mins: this.expiresInMinutes(sessionToken.expires_at),
        integration_id: sessionToken.integration_id,
        connection_id: sessionToken.connection_id,
        redirect_url: sessionToken.redirect_url,
        type: sessionToken.type as ConnectionType | null,
        language: sessionToken.language,
        metadata: sessionToken.metadata as Record<string, any> | null,
        configuration: sessionToken.configuration as Record<string, any> | null,
        created_at: sessionToken.created_at,
      };

      res.status(201).send(sessionTokenObject);
    } catch (err) {
      await errorService.reportError(err);

      return errorService.errorResponse(res, {
        code: ErrorCode.InternalServerError,
        message: DEFAULT_ERROR_MESSAGE,
      });
    }
  }

  public async listSessionTokens(req: Request, res: Response) {
    try {
      const environmentId = res.locals[ENVIRONMENT_ID_LOCALS_KEY];
      const sessionTokens = await sessionTokenService.listSessionTokens(environmentId);

      if (!sessionTokens) {
        return errorService.errorResponse(res, {
          code: ErrorCode.InternalServerError,
          message: DEFAULT_ERROR_MESSAGE,
        });
      }

      const sessionTokenObjects: SessionTokenObject[] = sessionTokens.map((sessionToken) => {
        return {
          object: 'session_token',
          token: sessionToken.id,
          url: this.buildSessionTokenUrl(sessionToken.id),
          expires_in_mins: this.expiresInMinutes(sessionToken.expires_at),
          integration_id: sessionToken.integration_id,
          connection_id: sessionToken.connection_id,
          redirect_url: sessionToken.redirect_url,
          type: sessionToken.type as ConnectionType | null,
          language: sessionToken.language,
          metadata: sessionToken.metadata as Record<string, any> | null,
          configuration: sessionToken.configuration as Record<string, any> | null,
          created_at: sessionToken.created_at,
        };
      });

      res.status(200).json({ object: 'list', data: sessionTokenObjects });
    } catch (err) {
      await errorService.reportError(err);

      return errorService.errorResponse(res, {
        code: ErrorCode.InternalServerError,
        message: DEFAULT_ERROR_MESSAGE,
      });
    }
  }

  public async retrieveSessionToken(req: Request, res: Response) {
    try {
      const sessionTokenId = req.params['session_token_id'];
      if (!sessionTokenId) {
        return errorService.errorResponse(res, {
          code: ErrorCode.BadRequest,
          message: 'Token missing',
        });
      }

      const sessionToken = await sessionTokenService.getSessionTokenById(sessionTokenId);
      if (!sessionToken) {
        return errorService.errorResponse(res, {
          code: ErrorCode.NotFound,
          message: 'Session token not found',
        });
      }

      const sessionTokenObject: SessionTokenObject = {
        object: 'session_token',
        token: sessionToken.id,
        url: this.buildSessionTokenUrl(sessionToken.id),
        expires_in_mins: this.expiresInMinutes(sessionToken.expires_at),
        integration_id: sessionToken.integration_id,
        connection_id: sessionToken.connection_id,
        redirect_url: sessionToken.redirect_url,
        type: sessionToken.type as ConnectionType | null,
        language: sessionToken.language,
        metadata: sessionToken.metadata as Record<string, any> | null,
        configuration: sessionToken.configuration as Record<string, any> | null,
        created_at: sessionToken.created_at,
      };

      res.status(200).send(sessionTokenObject);
    } catch (err) {
      await errorService.reportError(err);

      return errorService.errorResponse(res, {
        code: ErrorCode.InternalServerError,
        message: DEFAULT_ERROR_MESSAGE,
      });
    }
  }

  public async deleteSessionToken(req: Request, res: Response) {
    try {
      const sessionTokenId = req.params['session_token_id'];
      if (!sessionTokenId) {
        return errorService.errorResponse(res, {
          code: ErrorCode.BadRequest,
          message: 'Session token missing',
        });
      }

      const deletedSessionToken = await sessionTokenService.deleteSessionToken(sessionTokenId);
      if (!deletedSessionToken) {
        return errorService.errorResponse(res, {
          code: ErrorCode.InternalServerError,
          message: DEFAULT_ERROR_MESSAGE,
        });
      }

      const sessionTokenDeletedObject: SessionTokenDeletedObject = {
        object: 'session_token.deleted',
        token: deletedSessionToken.id,
        deleted: true,
      };

      res.status(200).send(sessionTokenDeletedObject);
    } catch (err) {
      await errorService.reportError(err);

      return errorService.errorResponse(res, {
        code: ErrorCode.InternalServerError,
        message: DEFAULT_ERROR_MESSAGE,
      });
    }
  }

  private buildSessionTokenUrl(token: string) {
    const serverUrl = getServerUrl();
    if (!serverUrl) {
      throw new Error('Server URL is not defined');
    }

    return `${serverUrl}/session/${token}`;
  }

  private expiresInMinutes(expiresAt: number) {
    return Math.floor((expiresAt - now()) / 60);
  }
}

export default new SessionTokenController();
