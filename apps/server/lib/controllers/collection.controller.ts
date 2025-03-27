import { CollectionProperty } from '@embed/providers';
import {
  Collection,
  DEFAULT_ERROR_MESSAGE,
  ENVIRONMENT_ID_LOCALS_KEY,
  ErrorCode,
  collectionService,
  connectionService,
  errorService,
  integrationService,
  now,
  providerService,
} from '@embed/shared';
import type { Request, Response } from 'express';
import collectionHook from '../hooks/collection.hook';
import { RESERVED_COLLECTION_PROPERTIES } from '../utils/constants';
import { zodError } from '../utils/helpers';
import {
  CollectionObject,
  QueryCollectionRequestSchema,
  UpdateCollectionRequestSchema,
} from '../utils/types';

class CollectionController {
  public async listCollections(req: Request, res: Response) {
    try {
      const environmentId = res.locals[ENVIRONMENT_ID_LOCALS_KEY];
      const integrationId = req.query['integration_id'];
      if (!integrationId || typeof integrationId !== 'string') {
        return errorService.errorResponse(res, {
          code: ErrorCode.BadRequest,
          message: 'Integration ID missing or invalid',
        });
      }

      const collections = await collectionService.listCollections({
        integrationId,
        environmentId,
      });

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
          configuration: collection.configuration as Record<string, any> | null,
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
      const integrationId = req.query['integration_id'];
      const collectionKey = req.params['collection_key'];

      if (!integrationId || typeof integrationId !== 'string') {
        return errorService.errorResponse(res, {
          code: ErrorCode.BadRequest,
          message: 'Integration ID missing or invalid',
        });
      } else if (!collectionKey) {
        return errorService.errorResponse(res, {
          code: ErrorCode.BadRequest,
          message: 'Collection unique key missing',
        });
      }

      const collection = await collectionService.retrieveCollection({
        collectionKey,
        integrationId,
        environmentId,
      });

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
        configuration: collection.configuration as Record<string, any> | null,
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
      const integrationId = req.query['integration_id'];
      const collectionKey = req.params['collection_key'];

      if (!integrationId || typeof integrationId !== 'string') {
        return errorService.errorResponse(res, {
          code: ErrorCode.BadRequest,
          message: 'Integration ID missing or invalid',
        });
      } else if (!collectionKey) {
        return errorService.errorResponse(res, {
          code: ErrorCode.BadRequest,
          message: 'Collection unique key missing',
        });
      }

      const updatedCollection = await collectionService.updateCollection({
        collectionKey,
        integrationId,
        environmentId,
        data: { is_enabled: true },
      });

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
        configuration: updatedCollection.configuration as Record<string, any> | null,
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
      const integrationId = req.query['integration_id'];
      const collectionKey = req.params['collection_key'];

      if (!integrationId || typeof integrationId !== 'string') {
        return errorService.errorResponse(res, {
          code: ErrorCode.BadRequest,
          message: 'Integration ID missing or invalid',
        });
      } else if (!collectionKey) {
        return errorService.errorResponse(res, {
          code: ErrorCode.BadRequest,
          message: 'Collection unique key missing',
        });
      }

      const updatedCollection = await collectionService.updateCollection({
        collectionKey,
        integrationId,
        environmentId,
        data: { is_enabled: false },
      });

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
        configuration: updatedCollection.configuration as Record<string, any> | null,
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
      const integrationId = req.query['integration_id'];
      const collectionKey = req.params['collection_key'];

      if (!integrationId || typeof integrationId !== 'string') {
        return errorService.errorResponse(res, {
          code: ErrorCode.BadRequest,
          message: 'Integration ID missing or invalid',
        });
      } else if (!collectionKey) {
        return errorService.errorResponse(res, {
          code: ErrorCode.BadRequest,
          message: 'Collection unique key missing',
        });
      }

      const initialCollection = await collectionService.retrieveCollection({
        collectionKey,
        integrationId,
        environmentId,
      });

      if (!initialCollection) {
        return errorService.errorResponse(res, {
          code: ErrorCode.NotFound,
          message: 'Collection not found',
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
        default_sync_frequency,
        auto_start_syncs,
        exclude_properties_from_syncs,
        configuration,
      } = parsedBody.data;

      const data: Partial<Collection> = { updated_at: now() };
      if (typeof default_sync_frequency !== 'undefined') {
        data.default_sync_frequency = default_sync_frequency;
      }

      if (typeof auto_start_syncs === 'boolean') {
        data.auto_start_syncs = auto_start_syncs;
      }

      if (typeof exclude_properties_from_syncs !== 'undefined') {
        exclude_properties_from_syncs.forEach((prop) => {
          if (RESERVED_COLLECTION_PROPERTIES.includes(prop)) {
            return errorService.errorResponse(res, {
              code: ErrorCode.BadRequest,
              message: `Cannot exclude reserved property ${prop}`,
            });
          }
        });

        data.exclude_properties_from_syncs = exclude_properties_from_syncs;
      }

      if (typeof configuration !== 'undefined') {
        data.configuration = configuration;
      }

      const updatedCollection = await collectionService.updateCollection({
        collectionKey,
        integrationId,
        environmentId,
        data,
      });

      if (!updatedCollection) {
        return errorService.errorResponse(res, {
          code: ErrorCode.InternalServerError,
          message: DEFAULT_ERROR_MESSAGE,
        });
      }

      collectionHook.collectionUpdated({
        initialCollection,
        updatedCollection,
      });

      const collectionObject: CollectionObject = {
        object: 'collection',
        unique_key: updatedCollection.unique_key,
        integration_id: updatedCollection.integration_id,
        provider_key: updatedCollection.provider_key,
        is_enabled: updatedCollection.is_enabled,
        default_sync_frequency: updatedCollection.default_sync_frequency,
        auto_start_syncs: updatedCollection.auto_start_syncs,
        exclude_properties_from_syncs: updatedCollection.exclude_properties_from_syncs,
        configuration: updatedCollection.configuration as Record<string, any> | null,
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
      const environmentId = res.locals[ENVIRONMENT_ID_LOCALS_KEY];
      const integrationId = req.query['integration_id'];
      if (!integrationId || typeof integrationId !== 'string') {
        return errorService.errorResponse(res, {
          code: ErrorCode.BadRequest,
          message: 'Integration ID missing or invalid',
        });
      }

      const integration = await integrationService.getIntegrationById(integrationId, environmentId);
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
      const environmentId = res.locals[ENVIRONMENT_ID_LOCALS_KEY];
      const integrationId = req.query['integration_id'];
      const collectionKey = req.params['collection_key'];

      if (!integrationId || typeof integrationId !== 'string') {
        return errorService.errorResponse(res, {
          code: ErrorCode.BadRequest,
          message: 'Integration ID missing or invalid',
        });
      } else if (!collectionKey) {
        return errorService.errorResponse(res, {
          code: ErrorCode.BadRequest,
          message: 'Collection unique key missing',
        });
      }

      const integration = await integrationService.getIntegrationById(integrationId, environmentId);
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
      const formattedSchema = CollectionController.formatCollectionSchema(schema);
      res.status(200).json(formattedSchema);
    } catch (err) {
      await errorService.reportError(err);

      return errorService.errorResponse(res, {
        code: ErrorCode.InternalServerError,
        message: DEFAULT_ERROR_MESSAGE,
      });
    }
  }

  public static formatCollectionSchema(schema: {
    description: string;
    properties: Record<string, CollectionProperty>;
    name: string;
    required?: string[] | undefined;
  }) {
    const formatProperties = (properties: Record<string, CollectionProperty>) => {
      return Object.fromEntries(
        Object.entries(properties)
          .filter(([k, v]) => !v.hidden)
          .map(([k, v]): [string, CollectionProperty] => {
            return [
              k,
              {
                type: v.type,
                description: v.description,
                items: v.items,
                filterable: v.filterable,
                vector_searchable: v.vector_searchable,
                keyword_searchable: v.keyword_searchable,
                properties: v.properties ? formatProperties(v.properties) : undefined,
              },
            ];
          })
      );
    };

    return { ...schema, properties: formatProperties(schema.properties) };
  }

  public async queryCollection(req: Request, res: Response) {
    try {
      const environmentId = res.locals[ENVIRONMENT_ID_LOCALS_KEY];
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

      const connection = await connectionService.getConnectionById(connectionId, integrationId);
      if (!connection) {
        return errorService.errorResponse(res, {
          code: ErrorCode.NotFound,
          message: 'Connection not found',
        });
      }

      const integration = await integrationService.getIntegrationById(integrationId, environmentId);
      if (!integration) {
        return errorService.errorResponse(res, {
          code: ErrorCode.NotFound,
          message: `Integration not found with ID ${integrationId}`,
        });
      }

      const parsedBody = QueryCollectionRequestSchema.safeParse(req.body);
      if (!parsedBody.success) {
        return errorService.errorResponse(res, {
          code: ErrorCode.BadRequest,
          message: zodError(parsedBody.error),
        });
      }

      if (parsedBody.data.image) {
        if (parsedBody.data.type !== undefined && parsedBody.data.type !== 'vector') {
          return errorService.errorResponse(res, {
            code: ErrorCode.BadRequest,
            message: 'Image search is only available for vector queries',
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

        return res.status(200).json({ object: 'list', data: results });
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
}

export default new CollectionController();
