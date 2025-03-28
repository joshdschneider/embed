import { Action, Integration } from '@prisma/client';
import fs from 'fs';
import yaml from 'js-yaml';
import {
  DEFAULT_LIMIT,
  MAX_LIMIT,
  MIN_LIMIT,
  getProviderCredentialsPath,
} from '../utils/constants';
import { database } from '../utils/database';
import { QueryMode } from '../utils/enums';
import { now } from '../utils/helpers';
import actionService from './action.service';
import collectionService from './collection.service';
import encryptionService from './encryption.service';
import errorService from './error.service';

class IntegrationService {
  public async createIntegration(integration: Integration): Promise<Integration | null> {
    try {
      const encryptedIntegration = encryptionService.encryptIntegration(integration);
      const createdIntegration = await database.integration.create({
        data: encryptedIntegration,
      });

      return encryptionService.decryptIntegration(createdIntegration);
    } catch (err) {
      await errorService.reportError(err);
      return null;
    }
  }

  public async getIntegrationById(
    integrationId: string,
    environmentId: string
  ): Promise<Integration | null> {
    try {
      const integration = await database.integration.findUnique({
        where: {
          id_environment_id: {
            id: integrationId,
            environment_id: environmentId,
          },
          deleted_at: null,
        },
      });

      if (!integration) {
        return null;
      }

      return encryptionService.decryptIntegration(integration);
    } catch (err) {
      await errorService.reportError(err);
      return null;
    }
  }

  public async getIntegrationActions(
    integrationId: string,
    environmentId: string
  ): Promise<Action[] | null> {
    try {
      const integration = await database.integration.findUnique({
        where: {
          id_environment_id: {
            id: integrationId,
            environment_id: environmentId,
          },
          deleted_at: null,
        },
        select: { actions: true },
      });

      if (!integration) {
        return null;
      }

      return integration.actions;
    } catch (err) {
      await errorService.reportError(err);
      return null;
    }
  }

  public async listIntegrations(
    environmentId: string,
    options?: {
      query?: string;
      order?: 'asc' | 'desc';
      pagination?: {
        limit?: number;
        before?: string;
        after?: string;
      };
    }
  ): Promise<{
    integrations: (Integration & { connection_count: number })[];
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
        ...(options?.query && {
          OR: [
            { id: { contains: query, mode: QueryMode.insensitive } },
            { provider_key: { contains: query, mode: QueryMode.insensitive } },
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

      let integrations = await database.integration.findMany({
        where: whereClause,
        orderBy,
        take,
        ...cursorCondition,
        include: { _count: { select: { connections: true } } },
      });

      const hasMore = integrations.length > limit;
      if (hasMore) {
        integrations = integrations.slice(0, -1);
      }

      if (options?.pagination?.before) {
        integrations.reverse();
      }

      const decryptedIntegrations = integrations
        .map((i) => ({ ...i, connection_count: i._count.connections }))
        .map((i) => encryptionService.decryptIntegration(i)) as (Integration & {
        connection_count: number;
      })[];

      return {
        integrations: decryptedIntegrations,
        hasMore,
        firstId: decryptedIntegrations[0]?.id || null,
        lastId: decryptedIntegrations[decryptedIntegrations.length - 1]?.id || null,
      };
    } catch (err) {
      await errorService.reportError(err);
      return null;
    }
  }

  public async updateIntegration(
    integrationId: string,
    environmentId: string,
    data: Partial<Integration>
  ): Promise<Integration | null> {
    try {
      if (data.oauth_client_secret) {
        const encryptedIntegration = encryptionService.encryptIntegration({
          ...data,
        } as Integration);
        data.oauth_client_secret = encryptedIntegration.oauth_client_secret;
        data.oauth_client_secret_iv = encryptedIntegration.oauth_client_secret_iv;
        data.oauth_client_secret_tag = encryptedIntegration.oauth_client_secret_tag;
      }

      const integration = await database.integration.update({
        where: {
          id_environment_id: {
            id: integrationId,
            environment_id: environmentId,
          },
          deleted_at: null,
        },
        data: { ...data, updated_at: now() },
      });

      return encryptionService.decryptIntegration(integration);
    } catch (err) {
      await errorService.reportError(err);
      return null;
    }
  }

  public async deleteIntegration(integrationId: string, environmentId: string): Promise<boolean> {
    try {
      const collections = await collectionService.listCollections({
        integrationId,
        environmentId,
      });

      if (!collections) {
        return false;
      }

      for (const collection of collections) {
        const collectionDeleted = await collectionService.deleteCollection({
          integrationId,
          collectionKey: collection.unique_key,
          environmentId: collection.environment_id,
        });

        if (!collectionDeleted) {
          return false;
        }
      }

      const actions = await actionService.listActions({
        integrationId,
        environmentId,
      });

      if (!actions) {
        return false;
      }

      for (const action of actions) {
        const actionDeleted = await actionService.deleteAction({
          actionKey: action.unique_key,
          integrationId,
          environmentId,
        });

        if (!actionDeleted) {
          return false;
        }
      }

      await database.integration.update({
        where: {
          id_environment_id: {
            id: integrationId,
            environment_id: environmentId,
          },
        },
        data: { deleted_at: now() },
      });

      return true;
    } catch (err) {
      await errorService.reportError(err);
      return false;
    }
  }

  public getIntegrationOauthCredentials(integration: Integration): {
    oauth_client_id: string;
    oauth_client_secret: string;
  } {
    if (!integration.is_using_test_credentials) {
      if (!integration.oauth_client_id || !integration.oauth_client_secret) {
        throw new Error('Client credentials are missing');
      }

      return {
        oauth_client_id: integration.oauth_client_id,
        oauth_client_secret: integration.oauth_client_secret,
      };
    }

    const filePath = getProviderCredentialsPath();
    if (!filePath) {
      throw new Error('Failed to load provider credentials');
    }

    const fileContents = fs.readFileSync(filePath, 'utf8');
    const credentials = yaml.load(fileContents) as {
      [key: string]: {
        oauth_client_id: string;
        oauth_client_secret: string;
      };
    };

    const defaultProviderCredentials = credentials[integration.provider_key];
    if (!defaultProviderCredentials) {
      throw new Error(`Failed to load default credentials for ${integration.provider_key}`);
    }

    return defaultProviderCredentials;
  }
}

export default new IntegrationService();
