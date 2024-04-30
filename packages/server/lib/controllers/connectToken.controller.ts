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
  now,
} from '@embed/shared';
import type { Request, Response } from 'express';
import connectTokenService from '../services/connectToken.service';
import { zodError } from '../utils/helpers';
import {
  ConnectTokenDeletedObject,
  ConnectTokenObject,
  CreateConnectTokenRequestSchema,
} from '../utils/types';

class ConnectTokenController {
  public async createConnectToken(req: Request, res: Response) {
    try {
      const environmentId = res.locals[ENVIRONMENT_ID_LOCALS_KEY];
      const parsedBody = CreateConnectTokenRequestSchema.safeParse(req.body);

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
        configuration,
        metadata,
      } = parsedBody.data;

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

      const connectToken = await connectTokenService.createConnectToken({
        id: generateId(Resource.ConnectToken),
        environment_id: environmentId,
        integration_id: integrationId,
        connection_id: connectionId || null,
        expires_at: expiresAt,
        language: language || 'en',
        redirect_url: redirectUrl || null,
        metadata: metadata || null,
        configuration: configuration || null,
        code_verifier: null,
        prefers_dark_mode: false,
        request_token_secret: null,
        websocket_client_id: null,
        connect_method: null,
        created_at: now(),
        updated_at: now(),
        deleted_at: null,
      });

      if (!connectToken) {
        return errorService.errorResponse(res, {
          code: ErrorCode.InternalServerError,
          message: DEFAULT_ERROR_MESSAGE,
        });
      }

      const activityId = await activityService.createActivity({
        id: generateId(Resource.Activity),
        environment_id: connectToken.environment_id,
        integration_id: connectToken.integration_id,
        connection_id: connectionId || null,
        connect_token_id: connectToken.id,
        action_key: null,
        collection_key: null,
        level: LogLevel.Info,
        action: LogAction.Connect,
        timestamp: now(),
      });

      await activityService.createActivityLog(activityId, {
        level: LogLevel.Info,
        message: 'Connect token created',
        timestamp: now(),
        payload: {
          token: connectToken.id,
          url: this.buildConnectTokenUrl(connectToken.id),
          expires_in_mins: this.expiresInMinutes(connectToken.expires_at),
          integration_id: connectToken.integration_id,
          redirect_url: connectToken.redirect_url,
          language: connectToken.language,
          metadata: connectToken.metadata,
          configuration: connectToken.configuration,
        },
      });

      const connectTokenObject: ConnectTokenObject = {
        object: 'connect_token',
        token: connectToken.id,
        url: this.buildConnectTokenUrl(connectToken.id),
        expires_in_mins: this.expiresInMinutes(connectToken.expires_at),
        integration_id: connectToken.integration_id,
        connection_id: connectToken.connection_id,
        redirect_url: connectToken.redirect_url,
        language: connectToken.language,
        metadata: connectToken.metadata as Record<string, any> | null,
        configuration: connectToken.configuration as Record<string, any> | null,
        created_at: connectToken.created_at,
      };

      res.status(201).send(connectTokenObject);
    } catch (err) {
      await errorService.reportError(err);

      return errorService.errorResponse(res, {
        code: ErrorCode.InternalServerError,
        message: DEFAULT_ERROR_MESSAGE,
      });
    }
  }

  public async listConnectTokens(req: Request, res: Response) {
    try {
      const environmentId = res.locals[ENVIRONMENT_ID_LOCALS_KEY];
      const connectTokens = await connectTokenService.listConnectTokens(environmentId);

      if (!connectTokens) {
        return errorService.errorResponse(res, {
          code: ErrorCode.InternalServerError,
          message: DEFAULT_ERROR_MESSAGE,
        });
      }

      const connectTokenObjects: ConnectTokenObject[] = connectTokens.map((connectToken) => {
        return {
          object: 'connect_token',
          token: connectToken.id,
          url: this.buildConnectTokenUrl(connectToken.id),
          expires_in_mins: this.expiresInMinutes(connectToken.expires_at),
          integration_id: connectToken.integration_id,
          connection_id: connectToken.connection_id,
          redirect_url: connectToken.redirect_url,
          language: connectToken.language,
          metadata: connectToken.metadata as Record<string, any> | null,
          configuration: connectToken.configuration as Record<string, any> | null,
          created_at: connectToken.created_at,
        };
      });

      res.status(200).json({ object: 'list', data: connectTokenObjects });
    } catch (err) {
      await errorService.reportError(err);

      return errorService.errorResponse(res, {
        code: ErrorCode.InternalServerError,
        message: DEFAULT_ERROR_MESSAGE,
      });
    }
  }

  public async retrieveConnectToken(req: Request, res: Response) {
    try {
      const connectTokenId = req.params['connect_token_id'];
      if (!connectTokenId) {
        return errorService.errorResponse(res, {
          code: ErrorCode.BadRequest,
          message: 'Token missing',
        });
      }

      const connectToken = await connectTokenService.getConnectTokenById(connectTokenId);
      if (!connectToken) {
        return errorService.errorResponse(res, {
          code: ErrorCode.NotFound,
          message: 'Connect token not found',
        });
      }

      const connectTokenObject: ConnectTokenObject = {
        object: 'connect_token',
        token: connectToken.id,
        url: this.buildConnectTokenUrl(connectToken.id),
        expires_in_mins: this.expiresInMinutes(connectToken.expires_at),
        integration_id: connectToken.integration_id,
        connection_id: connectToken.connection_id,
        redirect_url: connectToken.redirect_url,
        language: connectToken.language,
        metadata: connectToken.metadata as Record<string, any> | null,
        configuration: connectToken.configuration as Record<string, any> | null,
        created_at: connectToken.created_at,
      };

      res.status(200).send(connectTokenObject);
    } catch (err) {
      await errorService.reportError(err);

      return errorService.errorResponse(res, {
        code: ErrorCode.InternalServerError,
        message: DEFAULT_ERROR_MESSAGE,
      });
    }
  }

  public async deleteConnectToken(req: Request, res: Response) {
    try {
      const connectTokenId = req.params['connect_token_id'];
      if (!connectTokenId) {
        return errorService.errorResponse(res, {
          code: ErrorCode.BadRequest,
          message: 'Connect token missing',
        });
      }

      const deletedConnectToken = await connectTokenService.deleteConnectToken(connectTokenId);
      if (!deletedConnectToken) {
        return errorService.errorResponse(res, {
          code: ErrorCode.InternalServerError,
          message: DEFAULT_ERROR_MESSAGE,
        });
      }

      const connectTokenDeletedObject: ConnectTokenDeletedObject = {
        object: 'connect_token.deleted',
        token: deletedConnectToken.id,
        deleted: true,
      };

      res.status(200).send(connectTokenDeletedObject);
    } catch (err) {
      await errorService.reportError(err);

      return errorService.errorResponse(res, {
        code: ErrorCode.InternalServerError,
        message: DEFAULT_ERROR_MESSAGE,
      });
    }
  }

  private buildConnectTokenUrl(token: string) {
    const serverUrl = getServerUrl();
    if (!serverUrl) {
      throw new Error('Server URL is not defined');
    }

    return `${serverUrl}/connect/${token}`;
  }

  private expiresInMinutes(expiresAt: number) {
    return Math.floor((expiresAt - now()) / 60);
  }
}

export default new ConnectTokenController();
