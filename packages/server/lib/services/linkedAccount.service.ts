import type { LinkedAccount } from '@kit/shared';
import { database, errorService, now } from '@kit/shared';
import encryptionService from './encryption.service';

class LinkedAccountService {
  public async upsertLinkedAccount(linkedAccount: LinkedAccount): Promise<{
    linkedAccount: LinkedAccount;
    action: 'created' | 'updated';
  } | null> {
    try {
      const encryptedLinkedAccount = encryptionService.encryptLinkedAccount(linkedAccount);

      const duplicateLinkedAccount = await database.linkedAccount.findUnique({
        where: {
          id: encryptedLinkedAccount.id,
          deleted_at: null,
        },
      });

      if (duplicateLinkedAccount) {
        const existingLinkedAccount = await database.linkedAccount.update({
          where: { id: duplicateLinkedAccount.id },
          data: {
            integration_provider: encryptedLinkedAccount.integration_provider,
            configuration: encryptedLinkedAccount.configuration || undefined,
            credentials: encryptedLinkedAccount.credentials,
            credentials_iv: encryptedLinkedAccount.credentials_iv,
            credentials_tag: encryptedLinkedAccount.credentials_tag,
            consent_given: encryptedLinkedAccount.consent_given,
            consent_ip: encryptedLinkedAccount.consent_ip,
            consent_date: encryptedLinkedAccount.consent_date,
            updated_at: encryptedLinkedAccount.updated_at,
          },
        });

        return { linkedAccount: existingLinkedAccount, action: 'updated' };
      }

      const newLinkedAccount = await database.linkedAccount.create({
        data: {
          ...encryptedLinkedAccount,
          configuration: encryptedLinkedAccount.configuration || {},
          metadata: encryptedLinkedAccount.metadata || undefined,
        },
      });

      return { linkedAccount: newLinkedAccount, action: 'created' };
    } catch (err) {
      await errorService.reportError(err);
      return null;
    }
  }

  public async listLinkedAccounts(
    environmentId: string,
    pagination: {
      limit: number;
      endingBefore?: string;
      startingAfter?: string;
    },
    searchQuery?: string
  ): Promise<{
    linkedAccounts: LinkedAccount[];
    hasMore: boolean;
    firstId: string | null;
    lastId: string | null;
  } | null> {
    try {
      if (pagination.limit < 1 || pagination.limit > 100) {
        throw new Error('Invalid pagination limit');
      }

      let cursorOptions = {};
      let reverseOrder = false;

      if (pagination.startingAfter) {
        cursorOptions = {
          cursor: { id: pagination.startingAfter },
          skip: 1,
        };
      } else if (pagination.endingBefore) {
        cursorOptions = {
          cursor: { id: pagination.endingBefore },
          skip: 1,
        };

        reverseOrder = true;
      }

      const query = searchQuery
        ? [{ id: { contains: searchQuery } }, { integration_provider: { contains: searchQuery } }]
        : undefined;

      let linkedAccounts = await database.linkedAccount.findMany({
        orderBy: { created_at: 'desc' },
        where: {
          environment_id: environmentId,
          deleted_at: null,
          OR: query,
        },
        take: (reverseOrder ? -1 : 1) * (pagination.limit + 1),
        ...cursorOptions,
      });

      const hasMore = linkedAccounts.length > pagination.limit;
      if (hasMore) {
        linkedAccounts = linkedAccounts.slice(0, pagination.limit);
      }

      if (reverseOrder) {
        linkedAccounts.reverse();
      }

      const firstId = linkedAccounts.length > 0 ? linkedAccounts[0]?.id : null;
      const lastId =
        linkedAccounts.length > 0 ? linkedAccounts[linkedAccounts.length - 1]?.id : null;

      const decryptedLinkedAccounts = linkedAccounts.map((linkedAccount) => {
        return encryptionService.decryptLinkedAccount(linkedAccount);
      });

      return {
        linkedAccounts: decryptedLinkedAccounts,
        hasMore,
        firstId: firstId || null,
        lastId: lastId || null,
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

  public async deleteLinkedAccount(linkedAccountId: string): Promise<LinkedAccount | null> {
    try {
      const linkedAccount = await database.linkedAccount.findUnique({
        where: { id: linkedAccountId },
      });

      if (!linkedAccount) {
        return null;
      }

      return await database.linkedAccount.update({
        where: {
          id: linkedAccountId,
          deleted_at: null,
        },
        data: { deleted_at: now() },
      });
    } catch (err) {
      await errorService.reportError(err);
      return null;
    }
  }
}

export default new LinkedAccountService();
