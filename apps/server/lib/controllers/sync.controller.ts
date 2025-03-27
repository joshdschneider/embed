import {
  DEFAULT_ERROR_MESSAGE,
  ErrorCode,
  SyncRunStatus,
  SyncStatus,
  collectionService,
  connectionService,
  errorService,
  syncService,
} from '@embed/shared';
import type { Request, Response } from 'express';
import { zodError } from '../utils/helpers';
import { SyncObject, SyncRunObject, UpdateSyncRequestSchema } from '../utils/types';

class SyncController {
  public async listSyncs(req: Request, res: Response) {
    const integrationId = req.query['integration_id'];
    const connectionId = req.query['connection_id'];

    if (!integrationId || typeof integrationId !== 'string') {
      return errorService.errorResponse(res, {
        code: ErrorCode.BadRequest,
        message: 'Integration ID missing or invalid',
      });
    } else if (!connectionId || typeof connectionId !== 'string') {
      return errorService.errorResponse(res, {
        code: ErrorCode.BadRequest,
        message: 'Connection ID missing or invalid',
      });
    }

    try {
      const connection = await connectionService.getConnectionById(connectionId, integrationId);
      if (!connection) {
        return errorService.errorResponse(res, {
          code: ErrorCode.NotFound,
          message: 'Connection not found',
        });
      }

      const syncs = await syncService.listSyncs({ connectionId, integrationId });
      if (!syncs) {
        return errorService.errorResponse(res, {
          code: ErrorCode.InternalServerError,
          message: DEFAULT_ERROR_MESSAGE,
        });
      }

      const syncObjects: SyncObject[] = syncs.map((sync) => {
        return {
          object: 'sync',
          collection_key: sync.collection_key,
          integration_id: sync.integration_id,
          provider_key: sync.provider_key,
          connection_id: sync.connection_id,
          status: sync.status as SyncStatus,
          frequency: sync.frequency,
          last_synced_at: sync.last_synced_at,
          created_at: sync.created_at,
          updated_at: sync.updated_at,
        };
      });

      res.status(200).json({ object: 'list', data: syncObjects });
    } catch (err) {
      await errorService.reportError(err);

      return errorService.errorResponse(res, {
        code: ErrorCode.InternalServerError,
        message: DEFAULT_ERROR_MESSAGE,
      });
    }
  }

  public async retrieveSync(req: Request, res: Response) {
    const integrationId = req.query['integration_id'];
    const connectionId = req.query['connection_id'];
    const collectionKey = req.params['collection_key'];

    if (!integrationId || typeof integrationId !== 'string') {
      return errorService.errorResponse(res, {
        code: ErrorCode.BadRequest,
        message: 'Integration ID missing or invalid',
      });
    } else if (!connectionId || typeof connectionId !== 'string') {
      return errorService.errorResponse(res, {
        code: ErrorCode.BadRequest,
        message: 'Connection ID missing or invalid',
      });
    } else if (!collectionKey) {
      return errorService.errorResponse(res, {
        code: ErrorCode.BadRequest,
        message: 'Collection unique key missing',
      });
    }

    try {
      const sync = await syncService.retrieveSync({
        integrationId,
        connectionId,
        collectionKey,
      });

      if (!sync) {
        return errorService.errorResponse(res, {
          code: ErrorCode.NotFound,
          message: 'Sync not found',
        });
      }

      const syncObject: SyncObject = {
        object: 'sync',
        collection_key: sync.collection_key,
        integration_id: sync.integration_id,
        provider_key: sync.provider_key,
        connection_id: sync.connection_id,
        status: sync.status as SyncStatus,
        frequency: sync.frequency,
        last_synced_at: sync.last_synced_at,
        created_at: sync.created_at,
        updated_at: sync.updated_at,
      };

      res.status(200).json(syncObject);
    } catch (err) {
      await errorService.reportError(err);

      return errorService.errorResponse(res, {
        code: ErrorCode.InternalServerError,
        message: DEFAULT_ERROR_MESSAGE,
      });
    }
  }

  public async updateSync(req: Request, res: Response) {
    const integrationId = req.query['integration_id'];
    const connectionId = req.query['connection_id'];
    const collectionKey = req.params['collection_key'];

    if (!integrationId || typeof integrationId !== 'string') {
      return errorService.errorResponse(res, {
        code: ErrorCode.BadRequest,
        message: 'Integration ID missing or invalid',
      });
    } else if (!connectionId || typeof connectionId !== 'string') {
      return errorService.errorResponse(res, {
        code: ErrorCode.BadRequest,
        message: 'Connection ID missing or invalid',
      });
    } else if (!collectionKey) {
      return errorService.errorResponse(res, {
        code: ErrorCode.BadRequest,
        message: 'Collection unique key missing',
      });
    }

    try {
      const parsedBody = UpdateSyncRequestSchema.safeParse(req.body);
      if (!parsedBody.success) {
        return errorService.errorResponse(res, {
          code: ErrorCode.BadRequest,
          message: zodError(parsedBody.error),
        });
      }

      const { frequency } = parsedBody.data;
      const updatedSync = await syncService.updateSyncFrequency({
        integrationId,
        connectionId,
        collectionKey,
        frequency,
      });

      if (!updatedSync) {
        return errorService.errorResponse(res, {
          code: ErrorCode.InternalServerError,
          message: DEFAULT_ERROR_MESSAGE,
        });
      }

      const syncObject: SyncObject = {
        object: 'sync',
        collection_key: updatedSync.collection_key,
        integration_id: updatedSync.integration_id,
        provider_key: updatedSync.provider_key,
        connection_id: updatedSync.connection_id,
        status: updatedSync.status as SyncStatus,
        frequency: updatedSync.frequency,
        last_synced_at: updatedSync.last_synced_at,
        created_at: updatedSync.created_at,
        updated_at: updatedSync.updated_at,
      };

      res.status(200).json(syncObject);
    } catch (err) {
      await errorService.reportError(err);

      return errorService.errorResponse(res, {
        code: ErrorCode.InternalServerError,
        message: DEFAULT_ERROR_MESSAGE,
      });
    }
  }

  public async startSync(req: Request, res: Response) {
    const integrationId = req.query['integration_id'];
    const connectionId = req.query['connection_id'];
    const collectionKey = req.params['collection_key'];

    if (!integrationId || typeof integrationId !== 'string') {
      return errorService.errorResponse(res, {
        code: ErrorCode.BadRequest,
        message: 'Integration ID missing or invalid',
      });
    } else if (!connectionId || typeof connectionId !== 'string') {
      return errorService.errorResponse(res, {
        code: ErrorCode.BadRequest,
        message: 'Connection ID missing or invalid',
      });
    } else if (!collectionKey) {
      return errorService.errorResponse(res, {
        code: ErrorCode.BadRequest,
        message: 'Collection unique key missing',
      });
    }

    const sync = await syncService.retrieveSync({
      integrationId,
      connectionId,
      collectionKey,
    });

    if (!sync) {
      return errorService.errorResponse(res, {
        code: ErrorCode.NotFound,
        message: `Sync not found for collection ${collectionKey} on connection ${connectionId}`,
      });
    }

    const collection = await collectionService.retrieveCollection({
      integrationId: sync.integration_id,
      collectionKey: sync.collection_key,
      environmentId: sync.environment_id,
    });

    if (!collection) {
      return errorService.errorResponse(res, {
        code: ErrorCode.NotFound,
        message: `Collection not found for sync`,
      });
    } else if (!collection.is_enabled) {
      return errorService.errorResponse(res, {
        code: ErrorCode.Forbidden,
        message: `Collection is disabled`,
      });
    }

    try {
      const startedSync = await syncService.startSync(sync);
      if (!startedSync) {
        return errorService.errorResponse(res, {
          code: ErrorCode.InternalServerError,
          message: DEFAULT_ERROR_MESSAGE,
        });
      }

      const syncObject: SyncObject = {
        object: 'sync',
        collection_key: startedSync.collection_key,
        integration_id: startedSync.integration_id,
        provider_key: startedSync.provider_key,
        connection_id: startedSync.connection_id,
        status: startedSync.status as SyncStatus,
        frequency: startedSync.frequency,
        last_synced_at: startedSync.last_synced_at,
        created_at: startedSync.created_at,
        updated_at: startedSync.updated_at,
      };

      res.status(200).json(syncObject);
    } catch (err) {
      await errorService.reportError(err);

      return errorService.errorResponse(res, {
        code: ErrorCode.InternalServerError,
        message: DEFAULT_ERROR_MESSAGE,
      });
    }
  }

  public async stopSync(req: Request, res: Response) {
    const integrationId = req.query['integration_id'];
    const connectionId = req.query['connection_id'];
    const collectionKey = req.params['collection_key'];

    if (!integrationId || typeof integrationId !== 'string') {
      return errorService.errorResponse(res, {
        code: ErrorCode.BadRequest,
        message: 'Integration ID missing or invalid',
      });
    } else if (!connectionId || typeof connectionId !== 'string') {
      return errorService.errorResponse(res, {
        code: ErrorCode.BadRequest,
        message: 'Connection ID missing or invalid',
      });
    } else if (!collectionKey) {
      return errorService.errorResponse(res, {
        code: ErrorCode.BadRequest,
        message: 'Collection unique key missing',
      });
    }

    const sync = await syncService.retrieveSync({
      integrationId,
      connectionId,
      collectionKey,
    });

    if (!sync) {
      return errorService.errorResponse(res, {
        code: ErrorCode.NotFound,
        message: `Sync not found for collection ${collectionKey} on connection ${connectionId}`,
      });
    }

    if (sync.status === SyncStatus.Stopped) {
      const collection = await collectionService.retrieveCollection({
        integrationId: sync.integration_id,
        collectionKey: sync.collection_key,
        environmentId: sync.environment_id,
      });

      if (!collection) {
        return errorService.errorResponse(res, {
          code: ErrorCode.NotFound,
          message: `Collection not found for sync`,
        });
      } else if (!collection.is_enabled) {
        return errorService.errorResponse(res, {
          code: ErrorCode.Forbidden,
          message: `Collection is disabled`,
        });
      }
    }

    try {
      const stoppedSync = await syncService.stopSync(sync);
      if (!stoppedSync) {
        throw new Error('Failed to stop sync');
      }

      const syncObject: SyncObject = {
        object: 'sync',
        collection_key: stoppedSync.collection_key,
        integration_id: stoppedSync.integration_id,
        provider_key: stoppedSync.provider_key,
        connection_id: stoppedSync.connection_id,
        status: stoppedSync.status as SyncStatus,
        frequency: stoppedSync.frequency,
        last_synced_at: stoppedSync.last_synced_at,
        created_at: stoppedSync.created_at,
        updated_at: stoppedSync.updated_at,
      };

      res.status(200).json(syncObject);
    } catch (err) {
      await errorService.reportError(err);

      return errorService.errorResponse(res, {
        code: ErrorCode.InternalServerError,
        message: DEFAULT_ERROR_MESSAGE,
      });
    }
  }

  public async triggerSync(req: Request, res: Response) {
    const integrationId = req.query['integration_id'];
    const connectionId = req.params['connection_id'];
    const collectionKey = req.params['collection_key'];

    if (!integrationId || typeof integrationId !== 'string') {
      return errorService.errorResponse(res, {
        code: ErrorCode.BadRequest,
        message: 'Integration ID missing or invalid',
      });
    } else if (!connectionId || typeof connectionId !== 'string') {
      return errorService.errorResponse(res, {
        code: ErrorCode.BadRequest,
        message: 'Connection ID missing or invalid',
      });
    } else if (!collectionKey) {
      return errorService.errorResponse(res, {
        code: ErrorCode.BadRequest,
        message: 'Collection unique key missing',
      });
    }

    const sync = await syncService.retrieveSync({
      integrationId,
      connectionId,
      collectionKey,
    });

    if (!sync) {
      return errorService.errorResponse(res, {
        code: ErrorCode.NotFound,
        message: `Sync not found with collection ${collectionKey} for connection ${connectionId}`,
      });
    }

    const collection = await collectionService.retrieveCollection({
      integrationId: sync.integration_id,
      collectionKey: sync.collection_key,
      environmentId: sync.environment_id,
    });

    if (!collection) {
      return errorService.errorResponse(res, {
        code: ErrorCode.NotFound,
        message: `Collection not found for sync`,
      });
    } else if (!collection.is_enabled) {
      return errorService.errorResponse(res, {
        code: ErrorCode.Forbidden,
        message: `Collection is disabled`,
      });
    }

    try {
      const triggeredSync = await syncService.triggerSync(sync);
      if (!triggeredSync) {
        return errorService.errorResponse(res, {
          code: ErrorCode.InternalServerError,
          message: `Failed to trigger sync`,
        });
      }

      const syncObject: SyncObject = {
        object: 'sync',
        collection_key: sync.collection_key,
        integration_id: sync.integration_id,
        provider_key: sync.provider_key,
        connection_id: sync.connection_id,
        status: sync.status as SyncStatus,
        frequency: sync.frequency,
        last_synced_at: sync.last_synced_at,
        created_at: sync.created_at,
        updated_at: sync.updated_at,
      };

      res.status(200).json(syncObject);
    } catch (err) {
      await errorService.reportError(err);

      return errorService.errorResponse(res, {
        code: ErrorCode.InternalServerError,
        message: DEFAULT_ERROR_MESSAGE,
      });
    }
  }

  public async listSyncRuns(req: Request, res: Response) {
    const integrationId = req.query['integration_id'];
    const connectionId = req.query['connection_id'];
    const collectionKey = req.params['collection_key'];

    if (!integrationId || typeof integrationId !== 'string') {
      return errorService.errorResponse(res, {
        code: ErrorCode.BadRequest,
        message: 'Integration ID missing or invalid',
      });
    } else if (!connectionId || typeof connectionId !== 'string') {
      return errorService.errorResponse(res, {
        code: ErrorCode.BadRequest,
        message: 'Connection ID missing or invalid',
      });
    } else if (!collectionKey) {
      return errorService.errorResponse(res, {
        code: ErrorCode.BadRequest,
        message: 'Collection unique key missing',
      });
    }

    try {
      const syncRuns = await syncService.listSyncRuns({
        integrationId,
        connectionId,
        collectionKey,
      });

      if (!syncRuns) {
        return errorService.errorResponse(res, {
          code: ErrorCode.InternalServerError,
          message: DEFAULT_ERROR_MESSAGE,
        });
      }

      const syncRunObjects: SyncRunObject[] = syncRuns.map((run) => {
        return {
          object: 'sync_run',
          id: run.id,
          collection_key: run.collection_key,
          integration_id: run.integration_id,
          connection_id: run.connection_id,
          status: run.status as SyncRunStatus,
          records_added: run.records_added,
          records_updated: run.records_updated,
          records_deleted: run.records_deleted,
          timestamp: run.timestamp,
          duration: run.duration,
        };
      });

      res.status(200).json({ object: 'list', data: syncRunObjects });
    } catch (err) {
      await errorService.reportError(err);

      return errorService.errorResponse(res, {
        code: ErrorCode.InternalServerError,
        message: DEFAULT_ERROR_MESSAGE,
      });
    }
  }

  public async retrieveSyncRun(req: Request, res: Response) {
    const runId = req.params['sync_run_id'];
    if (!runId) {
      return errorService.errorResponse(res, {
        code: ErrorCode.BadRequest,
        message: 'Sync run ID missing',
      });
    }

    try {
      const run = await syncService.retrieveSyncRun(runId);
      if (!run) {
        return errorService.errorResponse(res, {
          code: ErrorCode.InternalServerError,
          message: DEFAULT_ERROR_MESSAGE,
        });
      }

      const syncRunObject: SyncRunObject = {
        object: 'sync_run',
        id: run.id,
        collection_key: run.collection_key,
        integration_id: run.integration_id,
        connection_id: run.connection_id,
        status: run.status as SyncRunStatus,
        records_added: run.records_added,
        records_updated: run.records_updated,
        records_deleted: run.records_deleted,
        timestamp: run.timestamp,
        duration: run.duration,
      };

      res.status(200).json(syncRunObject);
    } catch (err) {
      await errorService.reportError(err);

      return errorService.errorResponse(res, {
        code: ErrorCode.InternalServerError,
        message: DEFAULT_ERROR_MESSAGE,
      });
    }
  }
}

export default new SyncController();
