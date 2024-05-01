import { AuthScheme } from '@embed/providers';
import {
  DEFAULT_ERROR_MESSAGE,
  ENVIRONMENT_ID_LOCALS_KEY,
  ErrorCode,
  connectionService,
  errorService,
} from '@embed/shared';
import type { Request, Response } from 'express';
import { zodError } from '../utils/helpers';
import {
  ConnectionDeletedObject,
  ConnectionObject,
  PaginationParametersSchema,
  UpdateConnectionRequestSchema,
} from '../utils/types';

class ConnectionController {
  public async listConnections(req: Request, res: Response) {
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
      const list = await connectionService.listConnections(environmentId, {
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

      const { connections, firstId, lastId, hasMore } = list;
      const connectionObjects: ConnectionObject[] = connections.map((connection) => {
        return {
          object: 'connection',
          id: connection.id,
          integration_id: connection.integration_id,
          type: connection.type,
          display_name: connection.display_name,
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
      // TODO
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
      if (!connectionId) {
        return errorService.errorResponse(res, {
          code: ErrorCode.BadRequest,
          message: 'Connection ID missing',
        });
      }

      const connection = await connectionService.getConnectionById(connectionId);
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
        type: connection.type,
        display_name: connection.display_name,
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
      if (!connectionId) {
        return errorService.errorResponse(res, {
          code: ErrorCode.BadRequest,
          message: 'Connection ID missing',
        });
      }

      const parsedBody = UpdateConnectionRequestSchema.safeParse(req.body);
      if (!parsedBody.success) {
        return errorService.errorResponse(res, {
          code: ErrorCode.BadRequest,
          message: zodError(parsedBody.error),
        });
      }

      const connection = await connectionService.updateConnection(connectionId, {
        configuration: parsedBody.data.configuration,
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
        type: connection.type,
        display_name: connection.display_name,
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
      if (!connectionId) {
        return errorService.errorResponse(res, {
          code: ErrorCode.BadRequest,
          message: 'Connection ID missing',
        });
      }

      const connection = await connectionService.deleteConnection(connectionId);
      if (!connection) {
        return errorService.errorResponse(res, {
          code: ErrorCode.InternalServerError,
          message: DEFAULT_ERROR_MESSAGE,
        });
      }

      const connectionDeletedObject: ConnectionDeletedObject = {
        object: 'connection.deleted',
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
}

export default new ConnectionController();
