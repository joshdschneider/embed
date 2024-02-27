import { LinkedAccount } from '@prisma/client';
import { DEFAULT_LIMIT, MAX_LIMIT, MIN_LIMIT } from '../utils/constants';
import { database } from '../utils/database';
import { now } from '../utils/helpers';
import encryptionService from './encryption.service';
import errorService from './error.service';

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

  // public async initiatePostLinkSyncs({
  //   linkedAccount,
  //   activityId,
  //   action,
  // }: {
  //   linkedAccount: LinkedAccount;
  //   activityId: string | null;
  //   action: 'created' | 'updated';
  // }): Promise<void> {
  //   try {
  //     const syncModels = await integrationService.getIntegrationSyncModels(
  //       linkedAccount.integration_key,
  //       linkedAccount.environment_id
  //     );

  //     if (!syncModels) {
  //       await activityService.createActivityLog(activityId, {
  //         level: LogLevel.Error,
  //         timestamp: now(),
  //         message: `Failed to initiate sync for ${linkedAccount.id} due to an internal error`,
  //       });

  //       const err = new Error(`Failed to fetch sync models`);
  //       return await errorService.reportError(err);
  //     }

  //     const enabledSyncModels = syncModels.filter((syncModel) => syncModel.is_enabled);
  //     if (enabledSyncModels.length === 0) {
  //       return;
  //     }

  //     const worker = await WorkerClient.getInstance();
  //     if (!worker) {
  //       await activityService.createActivityLog(activityId, {
  //         level: LogLevel.Error,
  //         timestamp: now(),
  //         message: `Failed to initiate sync for ${linkedAccount.id} due to an internal error`,
  //       });

  //       const err = new Error('Failed to initialize Temporal client');
  //       return await errorService.reportError(err);
  //     }

  // for (const model of enabledSyncModels) {
  //   const sync = await syncService.createSync({
  //     id: generateId(Resource.Sync),
  //     linked_account_id: linkedAccount.id,
  //     model_id: model.id,
  //     frequency: model.frequency,
  //     last_synced_at: null,
  //     created_at: now(),
  //     updated_at: now(),
  //     deleted_at: null,
  //   });

  //   if (!sync) {
  //     await errorService.reportError(new Error(`Failed to create sync for ${model.name}`));

  //     await activityService.createActivityLog(activityId, {
  //       level: LogLevel.Error,
  //       timestamp: now(),
  //       message: `Failed to initiate sync for model ${model.name} due to an internal error`,
  //     });

  //     continue;
  //   }

  //   if (action === 'created') {
  //     await worker.startInitialSync(sync, model, linkedAccount);
  //   } else if (action === 'updated') {
  //     await worker.startResync(sync, model, linkedAccount);
  //   } else {
  //     await errorService.reportError(new Error(`Unsupported post-link action ${action}`));

  //     await activityService.createActivityLog(activityId, {
  //       level: LogLevel.Error,
  //       timestamp: now(),
  //       message: `Failed to initiate sync for ${model.name} due to an internal error`,
  //     });

  //     continue;
  //   }
  // }
  // } catch (err) {
  //   await errorService.reportError(err);

  //   await activityService.createActivityLog(activityId, {
  //     level: LogLevel.Error,
  //     timestamp: now(),
  //     message: `Failed to initiate sync for ${linkedAccount.id} due to an internal error`,
  //   });
  // }
  // }
}

export default new LinkedAccountService();
