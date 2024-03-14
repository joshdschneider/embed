import {
  DEFAULT_ERROR_MESSAGE,
  ErrorCode,
  SyncRunStatus,
  SyncRunType,
  SyncStatus,
  errorService,
  syncService,
} from '@kit/shared';
import type { Request, Response } from 'express';
import { zodError } from '../utils/helpers';
import { SyncObject, SyncRunObject, UpdateSyncRequestSchema } from '../utils/types';

class SyncController {
  public async listSyncs(req: Request, res: Response) {
    try {
      const linkedAccountId = req.params['linked_account_id'];
      if (!linkedAccountId) {
        return errorService.errorResponse(res, {
          code: ErrorCode.BadRequest,
          message: 'Linked account ID missing',
        });
      }

      const syncs = await syncService.listSyncs(linkedAccountId);
      if (!syncs) {
        return errorService.errorResponse(res, {
          code: ErrorCode.InternalServerError,
          message: DEFAULT_ERROR_MESSAGE,
        });
      }

      const syncObjects: SyncObject[] = syncs.map((sync) => {
        return {
          object: 'sync',
          collection: sync.collection_key,
          integration: sync.integration_key,
          linked_account: sync.linked_account_id,
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
    try {
      const linkedAccountId = req.params['linked_account_id'];
      const collectionKey = req.params['collection_key'];

      if (!linkedAccountId) {
        return errorService.errorResponse(res, {
          code: ErrorCode.BadRequest,
          message: 'Linked account ID missing',
        });
      } else if (!collectionKey) {
        return errorService.errorResponse(res, {
          code: ErrorCode.BadRequest,
          message: 'Collection unique key missing',
        });
      }

      const sync = await syncService.retrieveSync(linkedAccountId, collectionKey);

      if (!sync) {
        return errorService.errorResponse(res, {
          code: ErrorCode.NotFound,
          message: 'Sync not found',
        });
      }

      const syncObject: SyncObject = {
        object: 'sync',
        collection: sync.collection_key,
        integration: sync.integration_key,
        linked_account: sync.linked_account_id,
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
    try {
      const linkedAccountId = req.params['linked_account_id'];
      const collectionKey = req.params['collection_key'];

      if (!linkedAccountId) {
        return errorService.errorResponse(res, {
          code: ErrorCode.BadRequest,
          message: 'Linked account ID missing',
        });
      } else if (!collectionKey) {
        return errorService.errorResponse(res, {
          code: ErrorCode.BadRequest,
          message: 'Collection unique key missing',
        });
      }

      const parsedBody = UpdateSyncRequestSchema.safeParse(req.body);

      if (!parsedBody.success) {
        return errorService.errorResponse(res, {
          code: ErrorCode.BadRequest,
          message: zodError(parsedBody.error),
        });
      }

      const { frequency } = parsedBody.data;
      const updatedSync = await syncService.updateSync(linkedAccountId, collectionKey, {
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
        collection: updatedSync.collection_key,
        integration: updatedSync.integration_key,
        linked_account: updatedSync.linked_account_id,
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
    try {
      const linkedAccountId = req.params['linked_account_id'];
      const collectionKey = req.params['collection_key'];

      if (!linkedAccountId) {
        return errorService.errorResponse(res, {
          code: ErrorCode.BadRequest,
          message: 'Linked account ID missing',
        });
      } else if (!collectionKey) {
        return errorService.errorResponse(res, {
          code: ErrorCode.BadRequest,
          message: 'Collection unique key missing',
        });
      }

      // const sync = await syncService.startSync(linkedAccountId, collectionKey);

      // if (!sync) {
      //   return errorService.errorResponse(res, {
      //     code: ErrorCode.InternalServerError,
      //     message: DEFAULT_ERROR_MESSAGE,
      //   });
      // }

      // const syncObject: SyncObject = {
      //   object: 'sync',
      //   collection: sync.collection_key,
      //   integration: sync.integration_key,
      //   linked_account: sync.linked_account_id,
      //   status: sync.status as SyncStatus,
      //   frequency: sync.frequency,
      //   last_synced_at: sync.last_synced_at,
      //   created_at: sync.created_at,
      //   updated_at: sync.updated_at,
      // };

      res.status(200).json({});
    } catch (err) {
      await errorService.reportError(err);

      return errorService.errorResponse(res, {
        code: ErrorCode.InternalServerError,
        message: DEFAULT_ERROR_MESSAGE,
      });
    }
  }

  public async stopSync(req: Request, res: Response) {
    try {
      const linkedAccountId = req.params['linked_account_id'];
      const collectionKey = req.params['collection_key'];

      if (!linkedAccountId) {
        return errorService.errorResponse(res, {
          code: ErrorCode.BadRequest,
          message: 'Linked account ID missing',
        });
      } else if (!collectionKey) {
        return errorService.errorResponse(res, {
          code: ErrorCode.BadRequest,
          message: 'Collection unique key missing',
        });
      }

      const sync = await syncService.stopSync(linkedAccountId, collectionKey);

      if (!sync) {
        return errorService.errorResponse(res, {
          code: ErrorCode.InternalServerError,
          message: DEFAULT_ERROR_MESSAGE,
        });
      }

      const syncObject: SyncObject = {
        object: 'sync',
        collection: sync.collection_key,
        integration: sync.integration_key,
        linked_account: sync.linked_account_id,
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

  public async triggerSync(req: Request, res: Response) {
    try {
      const linkedAccountId = req.params['linked_account_id'];
      const collectionKey = req.params['collection_key'];

      if (!linkedAccountId) {
        return errorService.errorResponse(res, {
          code: ErrorCode.BadRequest,
          message: 'Linked account ID missing',
        });
      } else if (!collectionKey) {
        return errorService.errorResponse(res, {
          code: ErrorCode.BadRequest,
          message: 'Collection unique key missing',
        });
      }

      const sync = await syncService.triggerSync(linkedAccountId, collectionKey);

      if (!sync) {
        return errorService.errorResponse(res, {
          code: ErrorCode.InternalServerError,
          message: DEFAULT_ERROR_MESSAGE,
        });
      }

      const syncObject: SyncObject = {
        object: 'sync',
        collection: sync.collection_key,
        integration: sync.integration_key,
        linked_account: sync.linked_account_id,
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
    try {
      const linkedAccountId = req.params['linked_account_id'];
      const collectionKey = req.params['collection_key'];

      if (!linkedAccountId) {
        return errorService.errorResponse(res, {
          code: ErrorCode.BadRequest,
          message: 'Linked account ID missing',
        });
      } else if (!collectionKey) {
        return errorService.errorResponse(res, {
          code: ErrorCode.BadRequest,
          message: 'Collection unique key missing',
        });
      }

      const syncRuns = await syncService.listSyncRuns(linkedAccountId, collectionKey);

      if (!syncRuns) {
        return errorService.errorResponse(res, {
          code: ErrorCode.InternalServerError,
          message: DEFAULT_ERROR_MESSAGE,
        });
      }

      const syncRunObjects: SyncRunObject[] = syncRuns.map((run) => {
        return {
          object: 'sync_run',
          collection: run.collection_key,
          integration: run.integration_key,
          linked_account: run.linked_account_id,
          type: run.type as SyncRunType,
          status: run.status as SyncRunStatus,
          records_added: run.records_added,
          records_updated: run.records_updated,
          records_deleted: run.records_deleted,
          created_at: run.created_at,
          updated_at: run.updated_at,
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
    try {
      const syncRunId = req.params['run_id'];
      if (!syncRunId) {
        return errorService.errorResponse(res, {
          code: ErrorCode.BadRequest,
          message: 'Sync run ID missing',
        });
      }

      const syncRun = await syncService.retrieveSyncRun(syncRunId);
      if (!syncRun) {
        return errorService.errorResponse(res, {
          code: ErrorCode.InternalServerError,
          message: DEFAULT_ERROR_MESSAGE,
        });
      }

      const syncRunObject: SyncRunObject = {
        object: 'sync_run',
        collection: syncRun.collection_key,
        integration: syncRun.integration_key,
        linked_account: syncRun.linked_account_id,
        type: syncRun.type as SyncRunType,
        status: syncRun.status as SyncRunStatus,
        records_added: syncRun.records_added,
        records_updated: syncRun.records_updated,
        records_deleted: syncRun.records_deleted,
        created_at: syncRun.created_at,
        updated_at: syncRun.updated_at,
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
