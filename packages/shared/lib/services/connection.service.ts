import { AuthScheme, OAuth2, ProviderSpecification } from '@embed/providers';
import { Connection } from '@prisma/client';
import ElasticClient from '../clients/elastic.client';
import { getFreshOAuth2Credentials } from '../clients/oauth2.client';
import { DEFAULT_LIMIT, MAX_LIMIT, MIN_LIMIT } from '../utils/constants';
import { database } from '../utils/database';
import { QueryMode } from '../utils/enums';
import { now } from '../utils/helpers';
import encryptionService from './encryption.service';
import errorService from './error.service';
import integrationService from './integration.service';
import recordService from './record.service';
import syncService from './sync.service';

class ConnectionService {
  public async upsertConnection(connection: Connection): Promise<{
    connection: Connection;
    action: 'created' | 'updated';
  } | null> {
    try {
      const credentialsHash = encryptionService.hashString(connection.credentials);
      const encryptedConnection = encryptionService.encryptConnection({
        ...connection,
        credentials_hash: credentialsHash,
      });

      const duplicate = await database.connection.findFirst({
        where: {
          OR: [
            { id: encryptedConnection.id, deleted_at: null },
            { credentials_hash: encryptedConnection.credentials_hash, deleted_at: null },
          ],
        },
      });

      if (duplicate) {
        const existingConnection = await database.connection.update({
          where: { id: duplicate.id },
          data: {
            display_name: encryptedConnection.display_name,
            credentials: encryptedConnection.credentials,
            credentials_iv: encryptedConnection.credentials_iv,
            credentials_tag: encryptedConnection.credentials_tag,
            configuration: encryptedConnection.configuration || undefined,
            inclusions: encryptedConnection.inclusions || undefined,
            exclusions: encryptedConnection.exclusions || undefined,
            metadata: encryptedConnection.metadata || undefined,
            updated_at: now(),
          },
        });

        return {
          connection: encryptionService.decryptConnection(existingConnection),
          action: 'updated',
        };
      }

      const newConnection = await database.connection.create({
        data: {
          ...encryptedConnection,
          configuration: encryptedConnection.configuration || undefined,
          inclusions: encryptedConnection.inclusions || undefined,
          exclusions: encryptedConnection.exclusions || undefined,
          metadata: encryptedConnection.metadata || undefined,
        },
      });

      return {
        connection: encryptionService.decryptConnection(newConnection),
        action: 'created',
      };
    } catch (err) {
      await errorService.reportError(err);
      return null;
    }
  }

  public async listConnections(
    environmentId: string,
    options?: {
      query?: string;
      order?: 'asc' | 'desc';
      pagination?: {
        limit?: number;
        before?: string;
        after?: string;
      };
      integrationId?: string;
    }
  ): Promise<{
    connections: Connection[];
    hasMore: boolean;
    firstId: string | null;
    lastId: string | null;
  } | null> {
    try {
      const limit = Math.min(
        MAX_LIMIT,
        Math.max(MIN_LIMIT, options?.pagination?.limit || DEFAULT_LIMIT)
      );

      const order = options?.order || 'desc';
      const query = options?.query;
      const whereClause = {
        environment_id: environmentId,
        deleted_at: null,
        ...(options?.integrationId && { integration_id: options.integrationId }),
        ...(options?.query && {
          OR: [
            { id: { contains: query, mode: QueryMode.insensitive } },
            { display_name: { contains: query, mode: QueryMode.insensitive } },
            { integration_id: { contains: query, mode: QueryMode.insensitive } },
            { integration: { display_name: { contains: query, mode: QueryMode.insensitive } } },
          ],
        }),
      };

      let orderBy = { created_at: order };
      let cursorCondition = {};
      let take = limit + 1;

      if (options?.pagination?.after) {
        cursorCondition = { cursor: { id: options.pagination.after }, skip: 1 };
      } else if (options?.pagination?.before) {
        cursorCondition = { cursor: { id: options.pagination.before }, skip: 1 };
        orderBy = { created_at: order === 'asc' ? 'desc' : 'asc' };
        take = -take;
      }

      let connections = await database.connection.findMany({
        where: whereClause,
        orderBy,
        take,
        ...cursorCondition,
      });

      const hasMore = connections.length > limit;
      if (hasMore) {
        connections = connections.slice(0, -1);
      }

      if (options?.pagination?.before) {
        connections.reverse();
      }

      const decryptedConnections = connections.map((conn) => {
        return encryptionService.decryptConnection(conn);
      });

      return {
        connections: decryptedConnections,
        hasMore,
        firstId: decryptedConnections[0]?.id || null,
        lastId: decryptedConnections[decryptedConnections.length - 1]?.id || null,
      };
    } catch (err) {
      await errorService.reportError(err);
      return null;
    }
  }

  public async getConnectionById(connectionId: string): Promise<Connection | null> {
    try {
      const connection = await database.connection.findUnique({
        where: { id: connectionId, deleted_at: null },
      });

      if (!connection) {
        return null;
      }

      return encryptionService.decryptConnection(connection);
    } catch (err) {
      await errorService.reportError(err);
      return null;
    }
  }

  public async updateConnection(
    connectionId: string,
    data: Partial<Connection>
  ): Promise<Connection | null> {
    try {
      if (data.credentials) {
        const encryptedConnection = encryptionService.encryptConnection({
          ...(data as Connection),
          credentials: data.credentials,
          credentials_iv: null,
          credentials_tag: null,
        });

        data.credentials = encryptedConnection.credentials;
        data.credentials_iv = encryptedConnection.credentials_iv;
        data.credentials_tag = encryptedConnection.credentials_tag;
      }

      const connection = await database.connection.update({
        where: { id: connectionId, deleted_at: null },
        data: {
          ...data,
          configuration: data.configuration || undefined,
          inclusions: data.inclusions || undefined,
          exclusions: data.exclusions || undefined,
          metadata: data.metadata || undefined,
          updated_at: now(),
        },
      });

      if (!connection) {
        return null;
      }

      return encryptionService.decryptConnection(connection);
    } catch (err) {
      await errorService.reportError(err);
      return null;
    }
  }

  public async deleteConnection(connectionId: string): Promise<Connection | null> {
    try {
      const connection = await database.connection.findUnique({
        where: { id: connectionId },
      });

      if (!connection) {
        return null;
      }

      await recordService.deleteRecordsForConnection(connectionId);
      const syncs = await syncService.listSyncs(connectionId);

      if (syncs) {
        const elastic = ElasticClient.getInstance();
        for (const sync of syncs) {
          await elastic.deleteObjectsForConnection({
            environmentId: sync.environment_id,
            integrationId: sync.integration_id,
            collectionKey: sync.collection_key,
            connectionId,
          });

          await syncService.deleteSync(sync);
        }
      }

      const deletedConnection = await database.connection.update({
        where: { id: connectionId, deleted_at: null },
        data: { deleted_at: now() },
      });

      return encryptionService.decryptConnection(deletedConnection);
    } catch (err) {
      await errorService.reportError(err);
      return null;
    }
  }

  public async attemptTokenRefresh(
    connection: Connection,
    providerSpec: ProviderSpecification
  ): Promise<string | null> {
    try {
      const auth = providerSpec.auth.find((auth) => auth.scheme === AuthScheme.OAuth2);
      if (!auth) {
        return null;
      }

      const integration = await integrationService.getIntegrationById(connection.integration_id);
      if (!integration) {
        throw new Error('Failed to get integration during token refresh');
      }

      const freshOAuth2Credentials = await getFreshOAuth2Credentials(
        integration,
        auth as OAuth2,
        connection
      );

      await this.updateConnection(connection.id, {
        credentials: JSON.stringify(freshOAuth2Credentials),
      });

      return freshOAuth2Credentials.access_token;
    } catch (err) {
      await errorService.reportError(err);
      return null;
    }
  }
}

export default new ConnectionService();
