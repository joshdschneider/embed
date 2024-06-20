import { AuthScheme } from '@embed/providers';
import {
  DEFAULT_ERROR_MESSAGE,
  ENVIRONMENT_ID_LOCALS_KEY,
  ErrorCode,
  OAuth1Credentials,
  OAuth2Credentials,
  Resource,
  connectionService,
  errorService,
  generateId,
  now,
} from '@embed/shared';
import type { Request, Response } from 'express';
import connectionHook from '../hooks/connection.hook';
import { zodError } from '../utils/helpers';
import {
  ConnectionCountObject,
  ConnectionDeletedObject,
  ConnectionObject,
  PaginationParametersSchema,
  UpdateConnectionRequestSchema,
  UpsertConnectionRequestSchema,
} from '../utils/types';

class ConnectionController {
  public async listConnections(req: Request, res: Response) {
    try {
      const environmentId = res.locals[ENVIRONMENT_ID_LOCALS_KEY];
      const integrationId = req.query['integration_id'] as string | undefined;
      const searchQuery = req.query['query'] as string | undefined;
      const parsedParams = PaginationParametersSchema.safeParse(req.query);

      if (!parsedParams.success) {
        return errorService.errorResponse(res, {
          code: ErrorCode.BadRequest,
          message: zodError(parsedParams.error),
        });
      }

      const { before, after, limit, order } = parsedParams.data;
      const list = await connectionService.listConnections(environmentId, {
        query: searchQuery,
        order,
        pagination: { after, before, limit },
        integrationId,
      });

      if (!list) {
        return errorService.errorResponse(res, {
          code: ErrorCode.InternalServerError,
          message: DEFAULT_ERROR_MESSAGE,
        });
      }

      const { connections, firstId, lastId, hasMore } = list;
      const connectionObjects: ConnectionObject[] = connections.map((connection) => {
        return {
          object: 'connection',
          id: connection.id,
          integration_id: connection.integration_id,
          auth_scheme: connection.auth_scheme as AuthScheme,
          configuration: connection.configuration as Record<string, any> | null,
          inclusions: connection.inclusions as Record<string, any> | null,
          exclusions: connection.exclusions as Record<string, any> | null,
          metadata: connection.metadata as Record<string, any> | null,
          created_at: connection.created_at,
          updated_at: connection.updated_at,
        };
      });

      res.status(200).json({
        object: 'list',
        data: connectionObjects,
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

  public async upsertConnection(req: Request, res: Response) {
    try {
      const environmentId = res.locals[ENVIRONMENT_ID_LOCALS_KEY];
      const parsedBody = UpsertConnectionRequestSchema.safeParse(req.body);
      if (!parsedBody.success) {
        return errorService.errorResponse(res, {
          code: ErrorCode.BadRequest,
          message: zodError(parsedBody.error),
        });
      }

      const authScheme = parsedBody.data.auth_scheme as AuthScheme;
      let credentials;

      if (authScheme === AuthScheme.OAuth2) {
        if (
          !('access_token' in parsedBody.data.credentials) ||
          !('refresh_token' in parsedBody.data.credentials)
        ) {
          return errorService.errorResponse(res, {
            code: ErrorCode.BadRequest,
            message: 'Access token required for OAuth2 connection',
          });
        }

        const oauth2tokens = {
          access_token: parsedBody.data.credentials.access_token,
          refresh_token: parsedBody.data.credentials.refresh_token,
          expires_at: parsedBody.data.credentials.expires_at
            ? new Date(parsedBody.data.credentials.expires_at * 1000)
            : undefined,
        };

        const oauth2Credentials: OAuth2Credentials = {
          type: AuthScheme.OAuth2,
          ...oauth2tokens,
          raw: { ...oauth2tokens },
        };

        credentials = JSON.stringify(oauth2Credentials);
      } else if (authScheme === AuthScheme.OAuth1) {
        if (
          !('oauth_token' in parsedBody.data.credentials) ||
          !('oauth_token_secret' in parsedBody.data.credentials)
        ) {
          return errorService.errorResponse(res, {
            code: ErrorCode.BadRequest,
            message: 'Access token required for OAuth2 connection',
          });
        }

        const oauth1tokens = {
          oauth_token: parsedBody.data.credentials.oauth_token,
          oauth_token_secret: parsedBody.data.credentials.oauth_token_secret,
        };

        const oauth1Credentials: OAuth1Credentials = {
          type: AuthScheme.OAuth1,
          ...oauth1tokens,
          raw: { ...oauth1tokens },
        };

        credentials = JSON.stringify(oauth1Credentials);
      } else if (authScheme === AuthScheme.ApiKey) {
        if (!('api_key' in parsedBody.data.credentials)) {
          return errorService.errorResponse(res, {
            code: ErrorCode.BadRequest,
            message: 'API key credentials required for API key connection',
          });
        }

        credentials = JSON.stringify({
          type: AuthScheme.ApiKey,
          api_key: parsedBody.data.credentials.api_key,
        });
      } else if (authScheme === AuthScheme.Basic) {
        if (
          !('username' in parsedBody.data.credentials) ||
          !('password' in parsedBody.data.credentials)
        ) {
          return errorService.errorResponse(res, {
            code: ErrorCode.BadRequest,
            message: 'Username and password required for basic auth connection',
          });
        }

        credentials = JSON.stringify({
          type: AuthScheme.Basic,
          username: parsedBody.data.credentials.username,
          password: parsedBody.data.credentials.password,
        });
      } else {
        throw new Error('Invalid auth scheme');
      }

      const response = await connectionService.upsertConnection({
        environment_id: environmentId,
        id: parsedBody.data.id || generateId(Resource.Connection),
        integration_id: parsedBody.data.integration_id,
        auth_scheme: parsedBody.data.auth_scheme,
        credentials: credentials,
        credentials_iv: null,
        credentials_tag: null,
        configuration: parsedBody.data.configuration || null,
        inclusions: parsedBody.data.inclusions || null,
        exclusions: parsedBody.data.exclusions || null,
        metadata: parsedBody.data.metadata || null,
        created_at: now(),
        updated_at: now(),
        deleted_at: null,
      });

      if (!response) {
        return errorService.errorResponse(res, {
          code: ErrorCode.InternalServerError,
          message: DEFAULT_ERROR_MESSAGE,
        });
      }

      if (response.action === 'created') {
        connectionHook.connectionCreated({ connection: response.connection, activityId: null });
      } else if (response.action === 'updated') {
        connectionHook.connectionUpdated({ connection: response.connection, activityId: null });
      } else {
        throw new Error('Invalid action returned from connection upsert');
      }

      const connection = response.connection;
      const connectionObject: ConnectionObject = {
        object: 'connection',
        id: connection.id,
        integration_id: connection.integration_id,
        auth_scheme: connection.auth_scheme as AuthScheme,
        configuration: connection.configuration as Record<string, any> | null,
        inclusions: connection.inclusions as Record<string, any> | null,
        exclusions: connection.exclusions as Record<string, any> | null,
        metadata: connection.metadata as Record<string, any> | null,
        created_at: connection.created_at,
        updated_at: connection.updated_at,
      };

      res.status(200).send(connectionObject);
    } catch (err) {
      await errorService.reportError(err);

      return errorService.errorResponse(res, {
        code: ErrorCode.InternalServerError,
        message: DEFAULT_ERROR_MESSAGE,
      });
    }
  }

  public async retrieveConnection(req: Request, res: Response) {
    try {
      const connectionId = req.params['connection_id'];
      const integrationId = req.query['integration_id'];

      if (!connectionId) {
        return errorService.errorResponse(res, {
          code: ErrorCode.BadRequest,
          message: 'Connection ID missing',
        });
      } else if (!integrationId || typeof integrationId !== 'string') {
        return errorService.errorResponse(res, {
          code: ErrorCode.BadRequest,
          message: 'Integration ID missing or invalid',
        });
      }

      const connection = await connectionService.getConnectionById(connectionId, integrationId);
      if (!connection) {
        return errorService.errorResponse(res, {
          code: ErrorCode.NotFound,
          message: 'Connection not found',
        });
      }

      const connectionObject: ConnectionObject = {
        object: 'connection',
        id: connection.id,
        integration_id: connection.integration_id,
        auth_scheme: connection.auth_scheme as AuthScheme,
        configuration: connection.configuration as Record<string, any> | null,
        inclusions: connection.inclusions as Record<string, any> | null,
        exclusions: connection.exclusions as Record<string, any> | null,
        metadata: connection.metadata as Record<string, any> | null,
        created_at: connection.created_at,
        updated_at: connection.updated_at,
      };

      res.status(200).send(connectionObject);
    } catch (err) {
      await errorService.reportError(err);

      return errorService.errorResponse(res, {
        code: ErrorCode.InternalServerError,
        message: DEFAULT_ERROR_MESSAGE,
      });
    }
  }

  public async updateConnection(req: Request, res: Response) {
    try {
      const connectionId = req.params['connection_id'];
      const integrationId = req.query['integration_id'];

      if (!connectionId) {
        return errorService.errorResponse(res, {
          code: ErrorCode.BadRequest,
          message: 'Connection ID missing',
        });
      } else if (!integrationId || typeof integrationId !== 'string') {
        return errorService.errorResponse(res, {
          code: ErrorCode.BadRequest,
          message: 'Integration ID missing or invalid',
        });
      }

      const parsedBody = UpdateConnectionRequestSchema.safeParse(req.body);
      if (!parsedBody.success) {
        return errorService.errorResponse(res, {
          code: ErrorCode.BadRequest,
          message: zodError(parsedBody.error),
        });
      }

      const connection = await connectionService.updateConnection(connectionId, integrationId, {
        configuration: parsedBody.data.configuration,
        inclusions: parsedBody.data.inclusions,
        exclusions: parsedBody.data.exclusions,
        metadata: parsedBody.data.metadata,
      });

      if (!connection) {
        return errorService.errorResponse(res, {
          code: ErrorCode.InternalServerError,
          message: DEFAULT_ERROR_MESSAGE,
        });
      }

      const connectionObject: ConnectionObject = {
        object: 'connection',
        id: connection.id,
        integration_id: connection.integration_id,
        auth_scheme: connection.auth_scheme as AuthScheme,
        configuration: connection.configuration as Record<string, any> | null,
        inclusions: connection.inclusions as Record<string, any> | null,
        exclusions: connection.exclusions as Record<string, any> | null,
        metadata: connection.metadata as Record<string, any> | null,
        created_at: connection.created_at,
        updated_at: connection.updated_at,
      };

      res.status(200).send(connectionObject);
    } catch (err) {
      await errorService.reportError(err);

      return errorService.errorResponse(res, {
        code: ErrorCode.InternalServerError,
        message: DEFAULT_ERROR_MESSAGE,
      });
    }
  }

  public async deleteConnection(req: Request, res: Response) {
    try {
      const connectionId = req.params['connection_id'];
      const integrationId = req.query['integration_id'];

      if (!connectionId) {
        return errorService.errorResponse(res, {
          code: ErrorCode.BadRequest,
          message: 'Connection ID missing',
        });
      } else if (!integrationId || typeof integrationId !== 'string') {
        return errorService.errorResponse(res, {
          code: ErrorCode.BadRequest,
          message: 'Integration ID missing or invalid',
        });
      }

      const connection = await connectionService.deleteConnection(connectionId, integrationId);
      if (!connection) {
        return errorService.errorResponse(res, {
          code: ErrorCode.InternalServerError,
          message: DEFAULT_ERROR_MESSAGE,
        });
      }

      const connectionDeletedObject: ConnectionDeletedObject = {
        object: 'connection',
        id: connection.id,
        deleted: true,
      };

      res.status(200).json(connectionDeletedObject);
    } catch (err) {
      await errorService.reportError(err);

      return errorService.errorResponse(res, {
        code: ErrorCode.InternalServerError,
        message: DEFAULT_ERROR_MESSAGE,
      });
    }
  }

  public async getConnectionCount(req: Request, res: Response) {
    try {
      const environmentId = res.locals[ENVIRONMENT_ID_LOCALS_KEY];
      const connectionCount = await connectionService.getConnectionCount(environmentId);

      if (connectionCount == null) {
        return errorService.errorResponse(res, {
          code: ErrorCode.InternalServerError,
          message: DEFAULT_ERROR_MESSAGE,
        });
      }

      const connectionCountObject: ConnectionCountObject = {
        object: 'connection_count',
        connection_count: connectionCount,
      };

      res.status(200).json(connectionCountObject);
    } catch (err) {
      await errorService.reportError(err);

      return errorService.errorResponse(res, {
        code: ErrorCode.InternalServerError,
        message: DEFAULT_ERROR_MESSAGE,
      });
    }
  }
}

export default new ConnectionController();
