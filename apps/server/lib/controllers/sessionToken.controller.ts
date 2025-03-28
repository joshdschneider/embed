import { AuthScheme } from '@embed/providers';
import {
  DEFAULT_ERROR_MESSAGE,
  DEFAULT_LANGUAGE,
  ENVIRONMENT_ID_LOCALS_KEY,
  ErrorCode,
  LogAction,
  LogLevel,
  Resource,
  UsageAction,
  activityService,
  connectionService,
  errorService,
  generateId,
  getServerUrl,
  integrationService,
  now,
  usageService,
} from '@embed/shared';
import type { Request, Response } from 'express';
import sessionTokenService from '../services/sessionToken.service';
import { zodError } from '../utils/helpers';
import {
  CreateSessionTokenRequestSchema,
  SessionTokenDeletedObject,
  SessionTokenObject,
} from '../utils/types';

class SessionTokenController {
  public async createSessionToken(req: Request, res: Response) {
    try {
      const environmentId = res.locals[ENVIRONMENT_ID_LOCALS_KEY];
      const limitExceeded = await usageService.usageLimitExceeded(
        environmentId,
        UsageAction.CreateConnection
      );

      if (limitExceeded) {
        return errorService.errorResponse(res, {
          code: ErrorCode.BadRequest,
          message: 'Connection limit reached for staging environment',
        });
      }

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
        redirect_url: redirectUrl,
        auth_scheme: authScheme,
        configuration,
        inclusions,
        exclusions,
        metadata,
      } = parsedBody.data;

      const integration = await integrationService.getIntegrationById(integrationId, environmentId);
      if (!integration) {
        return errorService.errorResponse(res, {
          code: ErrorCode.NotFound,
          message: `Integration not found with ID ${integrationId}`,
        });
      }

      let selectedAuthScheme: string | null = null;

      if (connectionId) {
        const connection = await connectionService.getConnectionById(connectionId, integrationId);
        if (connection) {
          if (connection.integration_id !== integrationId) {
            return errorService.errorResponse(res, {
              code: ErrorCode.BadRequest,
              message: `Connection ${connectionId} must reconnect to integration ${connection.integration_id}`,
            });
          }

          if (authScheme && connection.auth_scheme && authScheme !== connection.auth_scheme) {
            return errorService.errorResponse(res, {
              code: ErrorCode.BadRequest,
              message: `Auth scheme must match the connection's existing auth scheme: ${connection.auth_scheme}`,
            });
          } else {
            selectedAuthScheme = connection.auth_scheme;
          }
        }
      }

      if (!selectedAuthScheme) {
        if (authScheme) {
          if (!integration.auth_schemes.includes(authScheme)) {
            return errorService.errorResponse(res, {
              code: ErrorCode.BadRequest,
              message: `Invalid auth scheme ${authScheme}`,
            });
          } else {
            selectedAuthScheme = authScheme;
          }
        } else {
          selectedAuthScheme = integration.auth_schemes.includes(AuthScheme.OAuth2)
            ? AuthScheme.OAuth2
            : integration.auth_schemes[0]!;
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
        auth_scheme: selectedAuthScheme,
        language: DEFAULT_LANGUAGE,
        redirect_url: redirectUrl || null,
        configuration: configuration || null,
        inclusions: inclusions || null,
        exclusions: exclusions || null,
        metadata: metadata || null,
        code_verifier: null,
        prefers_dark_mode: false,
        request_token_secret: null,
        websocket_client_id: null,
        flow: null,
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
          expires_at: sessionToken.expires_at,
          integration_id: sessionToken.integration_id,
          connection_id: sessionToken.connection_id,
          redirect_url: sessionToken.redirect_url,
          language: sessionToken.language || DEFAULT_LANGUAGE,
          metadata: sessionToken.metadata,
          configuration: sessionToken.configuration,
          created_at: sessionToken.created_at,
        },
      });

      const sessionTokenObject: SessionTokenObject = {
        object: 'session_token',
        token: sessionToken.id,
        url: this.buildSessionTokenUrl(sessionToken.id),
        expires_at: sessionToken.expires_at,
        auth_scheme: sessionToken.auth_scheme,
        integration_id: sessionToken.integration_id,
        connection_id: sessionToken.connection_id,
        redirect_url: sessionToken.redirect_url,
        configuration: sessionToken.configuration as Record<string, any> | null,
        inclusions: sessionToken.inclusions as Record<string, any> | null,
        exclusions: sessionToken.exclusions as Record<string, any> | null,
        metadata: sessionToken.metadata as Record<string, any> | null,
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
          auth_scheme: sessionToken.auth_scheme,
          expires_at: sessionToken.expires_at,
          integration_id: sessionToken.integration_id,
          connection_id: sessionToken.connection_id,
          redirect_url: sessionToken.redirect_url,
          language: DEFAULT_LANGUAGE,
          configuration: sessionToken.configuration as Record<string, any> | null,
          inclusions: sessionToken.inclusions as Record<string, any> | null,
          exclusions: sessionToken.exclusions as Record<string, any> | null,
          metadata: sessionToken.metadata as Record<string, any> | null,
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
        auth_scheme: sessionToken.auth_scheme,
        expires_at: sessionToken.expires_at,
        integration_id: sessionToken.integration_id,
        connection_id: sessionToken.connection_id,
        redirect_url: sessionToken.redirect_url,
        configuration: sessionToken.configuration as Record<string, any> | null,
        inclusions: sessionToken.inclusions as Record<string, any> | null,
        exclusions: sessionToken.exclusions as Record<string, any> | null,
        metadata: sessionToken.metadata as Record<string, any> | null,
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
        object: 'session_token',
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
