import {
  Collection,
  DEFAULT_ERROR_MESSAGE,
  ENVIRONMENT_ID_LOCALS_KEY,
  ErrorCode,
  collectionService,
  errorService,
  linkedAccountService,
  now,
  providerService,
} from '@embed/shared';
import type { Request, Response } from 'express';
import { zodError } from '../utils/helpers';
import {
  CollectionObject,
  CollectionRecordsClearedObject,
  ImageSearchCollectionRequestSchema,
  QueryCollectionRequestSchema,
  UpdateCollectionRequestSchema,
} from '../utils/types';

class CollectionController {
  public async listCollections(req: Request, res: Response) {
    try {
      const environmentId = res.locals[ENVIRONMENT_ID_LOCALS_KEY];
      const integrationKey = req.params['integration_key'];

      if (!integrationKey) {
        return errorService.errorResponse(res, {
          code: ErrorCode.BadRequest,
          message: 'Integration unique key missing',
        });
      }

      const collections = await collectionService.listCollections(integrationKey, environmentId);

      if (!collections) {
        return errorService.errorResponse(res, {
          code: ErrorCode.InternalServerError,
          message: DEFAULT_ERROR_MESSAGE,
        });
      }

      const collectionObjects: CollectionObject[] = collections.map((collection) => {
        return {
          object: 'collection',
          unique_key: collection.unique_key,
          integration: collection.integration_key,
          is_enabled: collection.is_enabled,
          default_sync_frequency: collection.default_sync_frequency,
          auto_start_sync: collection.auto_start_sync,
          exclude_properties_from_sync: collection.exclude_properties_from_sync,
          text_embedding_model_override: collection.text_embedding_model_override,
          multimodal_embedding_model_override: collection.multimodal_embedding_model_override,
          multimodal_enabled_override: collection.multimodal_enabled_override,
          created_at: collection.created_at,
          updated_at: collection.updated_at,
        };
      });

      res.status(200).json({ object: 'list', data: collectionObjects });
    } catch (err) {
      await errorService.reportError(err);

      return errorService.errorResponse(res, {
        code: ErrorCode.InternalServerError,
        message: DEFAULT_ERROR_MESSAGE,
      });
    }
  }

  public async retrieveCollection(req: Request, res: Response) {
    try {
      const environmentId = res.locals[ENVIRONMENT_ID_LOCALS_KEY];
      const integrationKey = req.params['integration_key'];
      const collectionKey = req.params['collection_key'];

      if (!integrationKey) {
        return errorService.errorResponse(res, {
          code: ErrorCode.BadRequest,
          message: 'Integration unique key missing',
        });
      } else if (!collectionKey) {
        return errorService.errorResponse(res, {
          code: ErrorCode.BadRequest,
          message: 'Collection unique key missing',
        });
      }

      const collection = await collectionService.retrieveCollection(
        collectionKey,
        integrationKey,
        environmentId
      );

      if (!collection) {
        return errorService.errorResponse(res, {
          code: ErrorCode.NotFound,
          message: 'Collection not found',
        });
      }

      const collectionObject: CollectionObject = {
        object: 'collection',
        unique_key: collection.unique_key,
        integration: collection.integration_key,
        is_enabled: collection.is_enabled,
        default_sync_frequency: collection.default_sync_frequency,
        auto_start_sync: collection.auto_start_sync,
        exclude_properties_from_sync: collection.exclude_properties_from_sync,
        text_embedding_model_override: collection.text_embedding_model_override,
        multimodal_embedding_model_override: collection.multimodal_embedding_model_override,
        multimodal_enabled_override: collection.multimodal_enabled_override,
        created_at: collection.created_at,
        updated_at: collection.updated_at,
      };

      res.status(200).json(collectionObject);
    } catch (err) {
      await errorService.reportError(err);

      return errorService.errorResponse(res, {
        code: ErrorCode.InternalServerError,
        message: DEFAULT_ERROR_MESSAGE,
      });
    }
  }

  public async enableCollection(req: Request, res: Response) {
    try {
      const environmentId = res.locals[ENVIRONMENT_ID_LOCALS_KEY];
      const integrationKey = req.params['integration_key'];
      const collectionKey = req.params['collection_key'];

      if (!integrationKey) {
        return errorService.errorResponse(res, {
          code: ErrorCode.BadRequest,
          message: 'Integration unique key missing',
        });
      } else if (!collectionKey) {
        return errorService.errorResponse(res, {
          code: ErrorCode.BadRequest,
          message: 'Collection unique key missing',
        });
      }

      const updatedCollection = await collectionService.updateCollection(
        collectionKey,
        integrationKey,
        environmentId,
        { is_enabled: true }
      );

      if (!updatedCollection) {
        return errorService.errorResponse(res, {
          code: ErrorCode.InternalServerError,
          message: DEFAULT_ERROR_MESSAGE,
        });
      }

      const collectionObject: CollectionObject = {
        object: 'collection',
        unique_key: updatedCollection.unique_key,
        integration: updatedCollection.integration_key,
        is_enabled: updatedCollection.is_enabled,
        default_sync_frequency: updatedCollection.default_sync_frequency,
        auto_start_sync: updatedCollection.auto_start_sync,
        exclude_properties_from_sync: updatedCollection.exclude_properties_from_sync,
        text_embedding_model_override: updatedCollection.text_embedding_model_override,
        multimodal_embedding_model_override: updatedCollection.multimodal_embedding_model_override,
        multimodal_enabled_override: updatedCollection.multimodal_enabled_override,
        created_at: updatedCollection.created_at,
        updated_at: updatedCollection.updated_at,
      };

      res.status(200).json(collectionObject);
    } catch (err) {
      await errorService.reportError(err);

      return errorService.errorResponse(res, {
        code: ErrorCode.InternalServerError,
        message: DEFAULT_ERROR_MESSAGE,
      });
    }
  }

  public async disableCollection(req: Request, res: Response) {
    try {
      const environmentId = res.locals[ENVIRONMENT_ID_LOCALS_KEY];
      const integrationKey = req.params['integration_key'];
      const collectionKey = req.params['collection_key'];

      if (!integrationKey) {
        return errorService.errorResponse(res, {
          code: ErrorCode.BadRequest,
          message: 'Integration unique key missing',
        });
      } else if (!collectionKey) {
        return errorService.errorResponse(res, {
          code: ErrorCode.BadRequest,
          message: 'Collection unique key missing',
        });
      }

      const updatedCollection = await collectionService.updateCollection(
        collectionKey,
        integrationKey,
        environmentId,
        { is_enabled: false }
      );

      if (!updatedCollection) {
        return errorService.errorResponse(res, {
          code: ErrorCode.InternalServerError,
          message: DEFAULT_ERROR_MESSAGE,
        });
      }

      const collectionObject: CollectionObject = {
        object: 'collection',
        unique_key: updatedCollection.unique_key,
        integration: updatedCollection.integration_key,
        is_enabled: updatedCollection.is_enabled,
        default_sync_frequency: updatedCollection.default_sync_frequency,
        auto_start_sync: updatedCollection.auto_start_sync,
        exclude_properties_from_sync: updatedCollection.exclude_properties_from_sync,
        text_embedding_model_override: updatedCollection.text_embedding_model_override,
        multimodal_embedding_model_override: updatedCollection.multimodal_embedding_model_override,
        multimodal_enabled_override: updatedCollection.multimodal_enabled_override,
        created_at: updatedCollection.created_at,
        updated_at: updatedCollection.updated_at,
      };

      res.status(200).json(collectionObject);
    } catch (err) {
      await errorService.reportError(err);

      return errorService.errorResponse(res, {
        code: ErrorCode.InternalServerError,
        message: DEFAULT_ERROR_MESSAGE,
      });
    }
  }

  public async updateCollection(req: Request, res: Response) {
    try {
      const environmentId = res.locals[ENVIRONMENT_ID_LOCALS_KEY];
      const integrationKey = req.params['integration_key'];
      const collectionKey = req.params['collection_key'];

      if (!integrationKey) {
        return errorService.errorResponse(res, {
          code: ErrorCode.BadRequest,
          message: 'Integration unique key missing',
        });
      } else if (!collectionKey) {
        return errorService.errorResponse(res, {
          code: ErrorCode.BadRequest,
          message: 'Collection unique key missing',
        });
      }

      const parsedBody = UpdateCollectionRequestSchema.safeParse(req.body);

      if (!parsedBody.success) {
        return errorService.errorResponse(res, {
          code: ErrorCode.BadRequest,
          message: zodError(parsedBody.error),
        });
      }

      const { default_sync_frequency, auto_start_sync, exclude_properties_from_sync } =
        parsedBody.data;

      const data: Partial<Collection> = { updated_at: now() };

      if (typeof default_sync_frequency !== 'undefined') {
        data.default_sync_frequency = default_sync_frequency;
      }

      if (typeof auto_start_sync === 'boolean') {
        data.auto_start_sync = auto_start_sync;
      }

      if (typeof exclude_properties_from_sync !== 'undefined') {
        data.exclude_properties_from_sync = exclude_properties_from_sync;
      }

      const updatedCollection = await collectionService.updateCollection(
        collectionKey,
        integrationKey,
        environmentId,
        data
      );

      if (!updatedCollection) {
        return errorService.errorResponse(res, {
          code: ErrorCode.InternalServerError,
          message: DEFAULT_ERROR_MESSAGE,
        });
      }

      const collectionObject: CollectionObject = {
        object: 'collection',
        unique_key: updatedCollection.unique_key,
        integration: updatedCollection.integration_key,
        is_enabled: updatedCollection.is_enabled,
        default_sync_frequency: updatedCollection.default_sync_frequency,
        auto_start_sync: updatedCollection.auto_start_sync,
        exclude_properties_from_sync: updatedCollection.exclude_properties_from_sync,
        text_embedding_model_override: updatedCollection.text_embedding_model_override,
        multimodal_embedding_model_override: updatedCollection.multimodal_embedding_model_override,
        multimodal_enabled_override: updatedCollection.multimodal_enabled_override,
        created_at: updatedCollection.created_at,
        updated_at: updatedCollection.updated_at,
      };

      res.status(200).json(collectionObject);
    } catch (err) {
      await errorService.reportError(err);

      return errorService.errorResponse(res, {
        code: ErrorCode.InternalServerError,
        message: DEFAULT_ERROR_MESSAGE,
      });
    }
  }

  public async listCollectionSchemas(req: Request, res: Response) {
    try {
      const integrationKey = req.params['integration_key'];

      if (!integrationKey) {
        return errorService.errorResponse(res, {
          code: ErrorCode.BadRequest,
          message: 'Integration unique key missing',
        });
      }

      const providerSpec = await providerService.getProviderSpec(integrationKey);

      if (!providerSpec) {
        return errorService.errorResponse(res, {
          code: ErrorCode.NotFound,
          message: `Specification not found for ${integrationKey}`,
        });
      }

      const entries = Object.entries(providerSpec.collections || {});
      const schemas = entries.map(([k, v]) => v.schema);

      res.status(200).json({ object: 'list', data: schemas });
    } catch (err) {
      await errorService.reportError(err);

      return errorService.errorResponse(res, {
        code: ErrorCode.InternalServerError,
        message: DEFAULT_ERROR_MESSAGE,
      });
    }
  }

  public async retrieveCollectionSchema(req: Request, res: Response) {
    try {
      const integrationKey = req.params['integration_key'];
      const collectionKey = req.params['collection_key'];

      if (!integrationKey) {
        return errorService.errorResponse(res, {
          code: ErrorCode.BadRequest,
          message: 'Integration unique key missing',
        });
      } else if (!collectionKey) {
        return errorService.errorResponse(res, {
          code: ErrorCode.BadRequest,
          message: 'Collection unique key missing',
        });
      }

      const providerSpec = await providerService.getProviderSpec(integrationKey);

      if (!providerSpec) {
        return errorService.errorResponse(res, {
          code: ErrorCode.NotFound,
          message: `Specification not found for ${integrationKey}`,
        });
      }

      const entries = Object.entries(providerSpec.collections || {});
      const collection = entries.find(([k, v]) => k === collectionKey);

      if (!collection) {
        return errorService.errorResponse(res, {
          code: ErrorCode.NotFound,
          message: `Schema not found for ${collectionKey}`,
        });
      }

      const schema = collection[1].schema;
      res.status(200).json(schema);
    } catch (err) {
      await errorService.reportError(err);

      return errorService.errorResponse(res, {
        code: ErrorCode.InternalServerError,
        message: DEFAULT_ERROR_MESSAGE,
      });
    }
  }

  public async queryCollection(req: Request, res: Response) {
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

      const linkedAccount = await linkedAccountService.getLinkedAccountById(linkedAccountId);
      if (!linkedAccount) {
        return errorService.errorResponse(res, {
          code: ErrorCode.NotFound,
          message: 'Linked account not found',
        });
      }

      const parsedBody = QueryCollectionRequestSchema.safeParse(req.body);
      if (!parsedBody.success) {
        return errorService.errorResponse(res, {
          code: ErrorCode.BadRequest,
          message: zodError(parsedBody.error),
        });
      }

      const results = await collectionService.queryCollection({
        linkedAccount,
        collectionKey,
        queryOptions: parsedBody.data,
      });

      if (!results) {
        return errorService.errorResponse(res, {
          code: ErrorCode.InternalServerError,
          message: DEFAULT_ERROR_MESSAGE,
        });
      }

      res.status(200).json({
        object: 'list',
        data: results,
      });
    } catch (err) {
      await errorService.reportError(err);

      return errorService.errorResponse(res, {
        code: ErrorCode.InternalServerError,
        message: DEFAULT_ERROR_MESSAGE,
      });
    }
  }

  public async imageSearchCollection(req: Request, res: Response) {
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

      const linkedAccount = await linkedAccountService.getLinkedAccountById(linkedAccountId);
      if (!linkedAccount) {
        return errorService.errorResponse(res, {
          code: ErrorCode.NotFound,
          message: 'Linked account not found',
        });
      }

      const parsedBody = ImageSearchCollectionRequestSchema.safeParse(req.body);
      if (!parsedBody.success) {
        return errorService.errorResponse(res, {
          code: ErrorCode.BadRequest,
          message: zodError(parsedBody.error),
        });
      }

      const results = await collectionService.imageSearchCollection({
        linkedAccount,
        collectionKey,
        imageSearchOptions: parsedBody.data,
      });

      if (!results) {
        return errorService.errorResponse(res, {
          code: ErrorCode.InternalServerError,
          message: DEFAULT_ERROR_MESSAGE,
        });
      }

      res.status(200).json({
        object: 'list',
        data: results,
      });
    } catch (err) {
      await errorService.reportError(err);

      return errorService.errorResponse(res, {
        code: ErrorCode.InternalServerError,
        message: DEFAULT_ERROR_MESSAGE,
      });
    }
  }

  public async listCollectionRecords(req: Request, res: Response) {
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

  public async retrieveCollectionRecord(req: Request, res: Response) {
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

  public async clearCollectionRecords(req: Request, res: Response) {
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

    try {
      const dataCleared = await collectionService.clearCollectionRecords(
        linkedAccountId,
        collectionKey
      );

      if (!dataCleared) {
        return errorService.errorResponse(res, {
          code: ErrorCode.InternalServerError,
          message: `Failed to clear synced data due to an internal error`,
        });
      }

      const syncDataClearedObject: CollectionRecordsClearedObject = {
        object: 'collection.records_cleared',
        linked_account: linkedAccountId,
        collection: collectionKey,
        records_cleared: true,
      };

      res.status(200).json(syncDataClearedObject);
    } catch (err) {
      await errorService.reportError(err);

      return errorService.errorResponse(res, {
        code: ErrorCode.InternalServerError,
        message: DEFAULT_ERROR_MESSAGE,
      });
    }
  }
}

export default new CollectionController();
