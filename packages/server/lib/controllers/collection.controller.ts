import {
  Collection,
  DEFAULT_ERROR_MESSAGE,
  ErrorCode,
  collectionService,
  connectionService,
  errorService,
  integrationService,
  now,
  providerService,
} from '@embed/shared';
import type { Request, Response } from 'express';
import { zodError } from '../utils/helpers';
import {
  CollectionObject,
  ImageSearchCollectionRequestSchema,
  QueryCollectionRequestSchema,
  UpdateCollectionRequestSchema,
} from '../utils/types';

class CollectionController {
  public async listCollections(req: Request, res: Response) {
    try {
      const integrationId = req.params['integration_id'];
      if (!integrationId) {
        return errorService.errorResponse(res, {
          code: ErrorCode.BadRequest,
          message: 'Integration ID missing',
        });
      }

      const collections = await collectionService.listCollections(integrationId);
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
          integration_id: collection.integration_id,
          provider_key: collection.provider_key,
          is_enabled: collection.is_enabled,
          default_sync_frequency: collection.default_sync_frequency,
          auto_start_syncs: collection.auto_start_syncs,
          exclude_properties_from_syncs: collection.exclude_properties_from_syncs,
          text_embedding_model: collection.text_embedding_model,
          multimodal_embedding_model: collection.multimodal_embedding_model,
          multimodal_enabled: collection.multimodal_enabled,
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
      const integrationId = req.params['integration_id'];
      const collectionKey = req.params['collection_key'];

      if (!integrationId) {
        return errorService.errorResponse(res, {
          code: ErrorCode.BadRequest,
          message: 'Integration ID missing',
        });
      } else if (!collectionKey) {
        return errorService.errorResponse(res, {
          code: ErrorCode.BadRequest,
          message: 'Collection unique key missing',
        });
      }

      const collection = await collectionService.retrieveCollection(collectionKey, integrationId);
      if (!collection) {
        return errorService.errorResponse(res, {
          code: ErrorCode.NotFound,
          message: 'Collection not found',
        });
      }

      const collectionObject: CollectionObject = {
        object: 'collection',
        unique_key: collection.unique_key,
        integration_id: collection.integration_id,
        provider_key: collection.provider_key,
        is_enabled: collection.is_enabled,
        default_sync_frequency: collection.default_sync_frequency,
        auto_start_syncs: collection.auto_start_syncs,
        exclude_properties_from_syncs: collection.exclude_properties_from_syncs,
        text_embedding_model: collection.text_embedding_model,
        multimodal_embedding_model: collection.multimodal_embedding_model,
        multimodal_enabled: collection.multimodal_enabled,
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
      const integrationId = req.params['integration_id'];
      const collectionKey = req.params['collection_key'];

      if (!integrationId) {
        return errorService.errorResponse(res, {
          code: ErrorCode.BadRequest,
          message: 'Integration ID missing',
        });
      } else if (!collectionKey) {
        return errorService.errorResponse(res, {
          code: ErrorCode.BadRequest,
          message: 'Collection unique key missing',
        });
      }

      const updatedCollection = await collectionService.updateCollection(
        collectionKey,
        integrationId,
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
        integration_id: updatedCollection.integration_id,
        provider_key: updatedCollection.provider_key,
        is_enabled: updatedCollection.is_enabled,
        default_sync_frequency: updatedCollection.default_sync_frequency,
        auto_start_syncs: updatedCollection.auto_start_syncs,
        exclude_properties_from_syncs: updatedCollection.exclude_properties_from_syncs,
        text_embedding_model: updatedCollection.text_embedding_model,
        multimodal_embedding_model: updatedCollection.multimodal_embedding_model,
        multimodal_enabled: updatedCollection.multimodal_enabled,
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
      const integrationId = req.params['integration_id'];
      const collectionKey = req.params['collection_key'];

      if (!integrationId) {
        return errorService.errorResponse(res, {
          code: ErrorCode.BadRequest,
          message: 'Integration ID missing',
        });
      } else if (!collectionKey) {
        return errorService.errorResponse(res, {
          code: ErrorCode.BadRequest,
          message: 'Collection unique key missing',
        });
      }

      const updatedCollection = await collectionService.updateCollection(
        collectionKey,
        integrationId,
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
        integration_id: updatedCollection.integration_id,
        provider_key: updatedCollection.provider_key,
        is_enabled: updatedCollection.is_enabled,
        default_sync_frequency: updatedCollection.default_sync_frequency,
        auto_start_syncs: updatedCollection.auto_start_syncs,
        exclude_properties_from_syncs: updatedCollection.exclude_properties_from_syncs,
        text_embedding_model: updatedCollection.text_embedding_model,
        multimodal_embedding_model: updatedCollection.multimodal_embedding_model,
        multimodal_enabled: updatedCollection.multimodal_enabled,
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
      const integrationId = req.params['integration_id'];
      const collectionKey = req.params['collection_key'];

      if (!integrationId) {
        return errorService.errorResponse(res, {
          code: ErrorCode.BadRequest,
          message: 'Integration ID missing',
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

      const {
        is_enabled,
        default_sync_frequency,
        auto_start_syncs,
        exclude_properties_from_syncs,
        text_embedding_model,
        multimodal_embedding_model,
        multimodal_enabled,
      } = parsedBody.data;

      const data: Partial<Collection> = { updated_at: now() };
      if (typeof is_enabled === 'boolean') {
        data.is_enabled = is_enabled;
      }

      if (typeof default_sync_frequency !== 'undefined') {
        data.default_sync_frequency = default_sync_frequency;
      }

      if (typeof auto_start_syncs === 'boolean') {
        data.auto_start_syncs = auto_start_syncs;
      }

      if (typeof exclude_properties_from_syncs !== 'undefined') {
        data.exclude_properties_from_syncs = exclude_properties_from_syncs;
      }

      if (typeof text_embedding_model !== 'undefined') {
        data.text_embedding_model = text_embedding_model;
      }

      if (typeof multimodal_embedding_model !== 'undefined') {
        data.multimodal_embedding_model = multimodal_embedding_model;
      }

      if (typeof multimodal_enabled === 'boolean') {
        data.multimodal_enabled = multimodal_enabled;
      }

      const updatedCollection = await collectionService.updateCollection(
        collectionKey,
        integrationId,
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
        integration_id: updatedCollection.integration_id,
        provider_key: updatedCollection.provider_key,
        is_enabled: updatedCollection.is_enabled,
        default_sync_frequency: updatedCollection.default_sync_frequency,
        auto_start_syncs: updatedCollection.auto_start_syncs,
        exclude_properties_from_syncs: updatedCollection.exclude_properties_from_syncs,
        text_embedding_model: updatedCollection.text_embedding_model,
        multimodal_embedding_model: updatedCollection.multimodal_embedding_model,
        multimodal_enabled: updatedCollection.multimodal_enabled,
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
      const integrationId = req.params['integration_id'];
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

      const providerSpec = await providerService.getProviderSpec(integration.provider_key);
      if (!providerSpec) {
        return errorService.errorResponse(res, {
          code: ErrorCode.NotFound,
          message: `Specification not found for ${integration.provider_key}`,
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
      const integrationId = req.params['integration_id'];
      const collectionKey = req.params['collection_key'];

      if (!integrationId) {
        return errorService.errorResponse(res, {
          code: ErrorCode.BadRequest,
          message: 'Integration ID missing',
        });
      } else if (!collectionKey) {
        return errorService.errorResponse(res, {
          code: ErrorCode.BadRequest,
          message: 'Collection unique key missing',
        });
      }

      const integration = await integrationService.getIntegrationById(integrationId);
      if (!integration) {
        return errorService.errorResponse(res, {
          code: ErrorCode.NotFound,
          message: 'Integration not found',
        });
      }

      const providerSpec = await providerService.getProviderSpec(integration.provider_key);
      if (!providerSpec) {
        return errorService.errorResponse(res, {
          code: ErrorCode.NotFound,
          message: `Specification not found for ${integration.provider_key}`,
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
      const connectionId = req.params['connection_id'];
      const collectionKey = req.params['collection_key'];

      if (!connectionId) {
        return errorService.errorResponse(res, {
          code: ErrorCode.BadRequest,
          message: 'Connection ID missing',
        });
      } else if (!collectionKey) {
        return errorService.errorResponse(res, {
          code: ErrorCode.BadRequest,
          message: 'Collection unique key missing',
        });
      }

      const connection = await connectionService.getConnectionById(connectionId);
      if (!connection) {
        return errorService.errorResponse(res, {
          code: ErrorCode.NotFound,
          message: 'Connection not found',
        });
      }

      const integration = await integrationService.getIntegrationById(connection.integration_id);
      if (!integration) {
        return errorService.errorResponse(res, {
          code: ErrorCode.NotFound,
          message: `Integration not found for connection ${connection.id}`,
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
        connection,
        providerKey: integration.provider_key,
        collectionKey,
        queryOptions: parsedBody.data,
      });

      if (!results) {
        return errorService.errorResponse(res, {
          code: ErrorCode.InternalServerError,
          message: DEFAULT_ERROR_MESSAGE,
        });
      }

      res.status(200).json({ object: 'list', data: results });
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
      const connectionId = req.params['connection_id'];
      const collectionKey = req.params['collection_key'];

      if (!connectionId) {
        return errorService.errorResponse(res, {
          code: ErrorCode.BadRequest,
          message: 'Connection ID missing',
        });
      } else if (!collectionKey) {
        return errorService.errorResponse(res, {
          code: ErrorCode.BadRequest,
          message: 'Collection unique key missing',
        });
      }

      const connection = await connectionService.getConnectionById(connectionId);
      if (!connection) {
        return errorService.errorResponse(res, {
          code: ErrorCode.NotFound,
          message: 'Connection not found',
        });
      }

      const integration = await integrationService.getIntegrationById(connection.integration_id);
      if (!integration) {
        return errorService.errorResponse(res, {
          code: ErrorCode.NotFound,
          message: `Integration not found for connection ${connection.id}`,
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
        connection,
        providerKey: integration.provider_key,
        collectionKey,
        imageSearchOptions: parsedBody.data,
      });

      if (!results) {
        return errorService.errorResponse(res, {
          code: ErrorCode.InternalServerError,
          message: DEFAULT_ERROR_MESSAGE,
        });
      }

      res.status(200).json({ object: 'list', data: results });
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
}

export default new CollectionController();
