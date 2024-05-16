import {
  DEFAULT_ERROR_MESSAGE,
  LogLevel,
  activityService,
  connectionService,
  environmentService,
  errorService,
  getServerUrl,
  integrationService,
  now,
} from '@embed/shared';
import type { Request, Response } from 'express';
import publisher from '../clients/publisher.client';
import connectionHook from '../hooks/connection.hook';
import sessionTokenService from '../services/sessionToken.service';

class FilePickerController {
  public async viewFiles(req: Request, res: Response) {
    const token = req.params['token'];
    const connectionId = req.query['connection_id'] as string | undefined;
    const action = req.query['action'] as string | undefined;
    const nonce = res.locals['nonce'];

    if (!token || typeof token !== 'string') {
      return await publisher.publishError(res, {
        error: 'Session token missing',
      });
    } else if (!connectionId || typeof connectionId !== 'string') {
      return await publisher.publishError(res, {
        error: 'Connection ID missing',
      });
    }

    const sessionToken = await sessionTokenService.getSessionTokenById(token);
    if (!sessionToken) {
      return await publisher.publishError(res, {
        error: 'Invalid session token',
      });
    }

    const connectMethod = sessionToken.connect_method || undefined;
    const wsClientId = sessionToken.websocket_client_id || undefined;
    const redirectUrl = sessionToken.redirect_url || undefined;
    const prefersDarkMode = sessionToken.prefers_dark_mode || false;

    const activityId = await activityService.findActivityIdBySessionToken(sessionToken.id);
    const branding = await environmentService.getEnvironmentBranding(sessionToken.environment_id);

    try {
      if (sessionToken.expires_at < now()) {
        const errorMessage = 'Session token expired';
        await activityService.createActivityLog(activityId, {
          timestamp: now(),
          level: LogLevel.Error,
          message: errorMessage,
        });

        return await publisher.publishError(res, {
          error: errorMessage,
          wsClientId,
          connectMethod,
          redirectUrl,
          branding,
          prefersDarkMode,
        });
      }

      const integration = await integrationService.getIntegrationById(sessionToken.integration_id);
      if (!integration) {
        throw new Error(`Failed to retrieve integration with ID ${sessionToken.integration_id}`);
      }

      if (!integration.is_enabled) {
        const errorMessage = 'Integration is disabled';
        await activityService.createActivityLog(activityId, {
          timestamp: now(),
          level: LogLevel.Error,
          message: errorMessage,
        });

        return await publisher.publishError(res, {
          error: errorMessage,
          wsClientId,
          connectMethod,
          redirectUrl,
          branding,
          prefersDarkMode,
        });
      }

      const serverUrl = getServerUrl();
      if (!serverUrl) {
        throw new Error('SERVER_URL is undefined');
      }

      await activityService.createActivityLog(activityId, {
        timestamp: now(),
        level: LogLevel.Info,
        message: `User viewed file picker`,
      });

      const connection = await connectionService.getConnectionById(connectionId);
      if (!connection) {
        throw new Error('Connection not found');
      }

      const credentials = JSON.parse(connection.credentials);
      const oauthToken = credentials['access_token'];

      switch (integration.provider_key) {
        case 'google-drive':
          return res.render('google-drive-file-picker', {
            session_token: token,
            oauth_token: oauthToken,
            connection_id: connectionId,
            action,
            nonce,
          });

        default:
          throw new Error(`File picker not supported for ${integration.provider_key}`);
      }
    } catch (err) {
      await errorService.reportError(err);
      await activityService.createActivityLog(activityId, {
        timestamp: now(),
        level: LogLevel.Error,
        message: 'Internal server error',
      });

      return await publisher.publishError(res, {
        error: DEFAULT_ERROR_MESSAGE,
        wsClientId,
        connectMethod,
        redirectUrl,
        branding,
        prefersDarkMode,
      });
    }
  }

  public async pickFiles(req: Request, res: Response) {
    const token = req.params['token'];
    const action = req.body['action'] as string | undefined;
    const connectionId = req.body.connection_id as string | undefined;

    if (!token || typeof token !== 'string') {
      return await publisher.publishError(res, {
        error: 'Session token missing',
      });
    }

    const sessionToken = await sessionTokenService.getSessionTokenById(token);
    if (!sessionToken) {
      return await publisher.publishError(res, {
        error: 'Invalid session token',
      });
    }

    if (!connectionId || typeof connectionId !== 'string') {
      return await publisher.publishError(res, {
        error: 'Connection ID missing',
      });
    }

    const selectedFiles = JSON.parse(req.body.selected_files) as string[];
    if (!selectedFiles || !Array.isArray(selectedFiles)) {
      return await publisher.publishError(res, {
        error: 'Selected files missing',
      });
    }

    const connectMethod = sessionToken.connect_method || undefined;
    const wsClientId = sessionToken.websocket_client_id || undefined;
    const redirectUrl = sessionToken.redirect_url || undefined;
    const prefersDarkMode = sessionToken.prefers_dark_mode || false;

    const activityId = await activityService.findActivityIdBySessionToken(sessionToken.id);
    const branding = await environmentService.getEnvironmentBranding(sessionToken.environment_id);

    try {
      if (sessionToken.expires_at < now()) {
        const errorMessage = 'Session token expired';
        await activityService.createActivityLog(activityId, {
          timestamp: now(),
          level: LogLevel.Error,
          message: errorMessage,
        });

        return await publisher.publishError(res, {
          error: errorMessage,
          wsClientId,
          connectMethod,
          redirectUrl,
          branding,
          prefersDarkMode,
        });
      }

      const integration = await integrationService.getIntegrationById(sessionToken.integration_id);
      if (!integration) {
        throw new Error(`Failed to retrieve integration with ID ${sessionToken.integration_id}`);
      }

      if (!integration.is_enabled) {
        const errorMessage = 'Integration is disabled';
        await activityService.createActivityLog(activityId, {
          timestamp: now(),
          level: LogLevel.Error,
          message: errorMessage,
        });

        return await publisher.publishError(res, {
          error: errorMessage,
          wsClientId,
          connectMethod,
          redirectUrl,
          branding,
          prefersDarkMode,
        });
      }

      const connection = await connectionService.getConnectionById(connectionId);
      if (!connection) {
        throw new Error('Connection not found');
      }

      const updatedConnection = await connectionService.updateConnection(connectionId, {
        inclusions: {
          ...(connection.inclusions as object),
          files: selectedFiles,
        },
      });

      if (!updatedConnection) {
        throw new Error('Failed to update connection');
      }

      await activityService.createActivityLog(activityId, {
        timestamp: now(),
        level: LogLevel.Info,
        message: `Saving selected files to connection`,
        payload: {
          connection: connectionId,
          selected_files: selectedFiles,
        },
      });

      if (action === 'created') {
        connectionHook.connectionCreated({ connection: updatedConnection, activityId });
      } else if (action === 'updated') {
        connectionHook.connectionUpdated({ connection: updatedConnection, activityId });
      }

      await sessionTokenService.deleteSessionToken(sessionToken.id);

      return await publisher.publishSuccess(res, {
        connectionId: updatedConnection.id,
        wsClientId,
        connectMethod,
        redirectUrl,
        branding,
        prefersDarkMode,
      });
    } catch (err) {
      await errorService.reportError(err);
      await activityService.createActivityLog(activityId, {
        timestamp: now(),
        level: LogLevel.Error,
        message: 'Internal server error',
      });

      return await publisher.publishError(res, {
        error: DEFAULT_ERROR_MESSAGE,
        wsClientId,
        connectMethod,
        redirectUrl,
        branding,
        prefersDarkMode,
      });
    }
  }
}

export default new FilePickerController();
