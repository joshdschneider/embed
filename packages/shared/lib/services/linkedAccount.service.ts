import { AuthScheme, OAuth2, ProviderSpecification } from '@embed/providers';
import { LinkedAccount } from '@prisma/client';
import crypto from 'crypto';
import ElasticClient from '../clients/elastic.client';
import { getFreshOAuth2Credentials } from '../clients/oauth2.client';
import { DEFAULT_LIMIT, MAX_LIMIT, MIN_LIMIT } from '../utils/constants';
import { database } from '../utils/database';
import { now } from '../utils/helpers';
import encryptionService from './encryption.service';
import errorService from './error.service';
import integrationService from './integration.service';
import syncService from './sync.service';

class LinkedAccountService {
  public async upsertLinkedAccount(linkedAccount: LinkedAccount): Promise<{
    linkedAccount: LinkedAccount;
    action: 'created' | 'updated';
  } | null> {
    try {
      const encryptedLinkedAccount = encryptionService.encryptLinkedAccount(linkedAccount);

      const duplicateLinkedAccount = await database.linkedAccount.findUnique({
        where: { id: encryptedLinkedAccount.id, deleted_at: null },
      });

      if (duplicateLinkedAccount) {
        const existingLinkedAccount = await database.linkedAccount.update({
          where: { id: duplicateLinkedAccount.id },
          data: {
            integration_key: encryptedLinkedAccount.integration_key,
            configuration: encryptedLinkedAccount.configuration || undefined,
            credentials: encryptedLinkedAccount.credentials,
            credentials_iv: encryptedLinkedAccount.credentials_iv,
            credentials_tag: encryptedLinkedAccount.credentials_tag,
            updated_at: now(),
          },
        });

        return {
          linkedAccount: encryptionService.decryptLinkedAccount(existingLinkedAccount),
          action: 'updated',
        };
      }

      const newLinkedAccount = await database.linkedAccount.create({
        data: {
          ...encryptedLinkedAccount,
          configuration: encryptedLinkedAccount.configuration || {},
          metadata: encryptedLinkedAccount.metadata || undefined,
        },
      });

      return {
        linkedAccount: encryptionService.decryptLinkedAccount(newLinkedAccount),
        action: 'created',
      };
    } catch (err) {
      await errorService.reportError(err);
      return null;
    }
  }

  public generateId(integrationKey: string, byteLength = 8) {
    return `${integrationKey.replace('-', '_')}_${crypto.randomBytes(byteLength).toString('hex')}`;
  }

  public async listLinkedAccounts(
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
    linkedAccounts: LinkedAccount[];
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

      const whereClause = {
        environment_id: environmentId,
        deleted_at: null,
        ...(options?.query && {
          OR: [
            { id: { contains: options.query } },
            { integration_provider: { contains: options.query } },
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

      let linkedAccounts = await database.linkedAccount.findMany({
        where: whereClause,
        orderBy,
        take,
        ...cursorCondition,
      });

      const hasMore = linkedAccounts.length > limit;
      if (hasMore) {
        linkedAccounts = linkedAccounts.slice(0, -1);
      }

      if (options?.pagination?.before) {
        linkedAccounts.reverse();
      }

      const decryptedLinkedAccounts = linkedAccounts.map((linkedAccount) => {
        return encryptionService.decryptLinkedAccount(linkedAccount);
      });

      return {
        linkedAccounts: decryptedLinkedAccounts,
        hasMore,
        firstId: linkedAccounts[0]?.id || null,
        lastId: linkedAccounts[linkedAccounts.length - 1]?.id || null,
      };
    } catch (err) {
      await errorService.reportError(err);
      return null;
    }
  }

  public async getLinkedAccountById(linkedAccountId: string): Promise<LinkedAccount | null> {
    try {
      const linkedAccount = await database.linkedAccount.findUnique({
        where: { id: linkedAccountId, deleted_at: null },
      });

      if (!linkedAccount) {
        return null;
      }

      return encryptionService.decryptLinkedAccount(linkedAccount);
    } catch (err) {
      await errorService.reportError(err);
      return null;
    }
  }

  public async updateLinkedAccount(
    linkedAccountId: string,
    data: Partial<LinkedAccount>
  ): Promise<LinkedAccount | null> {
    try {
      if (data.credentials) {
        const encryptedLinkedAccount = encryptionService.encryptLinkedAccount({
          ...(data as LinkedAccount),
          credentials: data.credentials,
          credentials_iv: null,
          credentials_tag: null,
        });

        data.credentials = encryptedLinkedAccount.credentials;
        data.credentials_iv = encryptedLinkedAccount.credentials_iv;
        data.credentials_tag = encryptedLinkedAccount.credentials_tag;
      }

      const linkedAccount = await database.linkedAccount.update({
        where: { id: linkedAccountId, deleted_at: null },
        data: {
          ...data,
          configuration: data.configuration || undefined,
          metadata: data.metadata || undefined,
          updated_at: now(),
        },
      });

      if (!linkedAccount) {
        return null;
      }

      return encryptionService.decryptLinkedAccount(linkedAccount);
    } catch (err) {
      await errorService.reportError(err);
      return null;
    }
  }

  public async deleteLinkedAccount(linkedAccountId: string): Promise<LinkedAccount | null> {
    try {
      const linkedAccount = await database.linkedAccount.findUnique({
        where: { id: linkedAccountId },
      });

      if (!linkedAccount) {
        return null;
      }

      const syncs = await syncService.listSyncs(linkedAccountId);
      if (syncs) {
        for (const sync of syncs) {
          await syncService.deleteSync(linkedAccount.id, sync.collection_key);
        }
      }

      const deletedLinkedAccount = await database.linkedAccount.update({
        where: {
          id: linkedAccountId,
          deleted_at: null,
        },
        data: { deleted_at: now() },
      });

      return encryptionService.decryptLinkedAccount(deletedLinkedAccount);
    } catch (err) {
      await errorService.reportError(err);
      return null;
    }
  }

  public async attemptTokenRefresh(
    linkedAccount: LinkedAccount,
    providerSpec: ProviderSpecification
  ): Promise<string | null> {
    try {
      if (providerSpec.auth.scheme !== AuthScheme.OAuth2) {
        return null;
      }

      const integration = await integrationService.getIntegrationByKey(
        linkedAccount.integration_key,
        linkedAccount.environment_id
      );

      if (!integration) {
        throw new Error('Failed to get integration during token refresh');
      }

      const freshOAuth2Credentials = await getFreshOAuth2Credentials(
        integration,
        providerSpec.auth as OAuth2,
        linkedAccount
      );

      await this.updateLinkedAccount(linkedAccount.id, {
        credentials: JSON.stringify(freshOAuth2Credentials),
      });

      return freshOAuth2Credentials.access_token;
    } catch (err) {
      await errorService.reportError(err);
      return null;
    }
  }

  public async createIndexForLinkedAccount(
    environmentId: string,
    linkedAccountId: string,
    integrationKey: string,
    collectionKey: string
  ): Promise<boolean> {
    try {
      const elastic = ElasticClient.getInstance();
      return await elastic.createIndex({
        environmentId,
        linkedAccountId,
        integrationKey,
        collectionKey,
      });
    } catch (err) {
      await errorService.reportError(err);
      return false;
    }
  }
}

export default new LinkedAccountService();
