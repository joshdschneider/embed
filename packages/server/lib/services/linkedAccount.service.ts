import type { LinkedAccount } from '@prisma/client';
import { DuplicateAccountBehavior } from '../types';
import { now } from '../utils/helpers';
import { prisma } from '../utils/prisma';
import encryptionService from './encryption.service';
import environmentService from './environment.service';
import errorService from './error.service';

class LinkedAccountService {
  public async upsertLinkedAccount(
    linkedAccount: LinkedAccount
  ): Promise<
    | { success: true; linkedAccount: LinkedAccount; action: 'created' | 'updated' }
    | { success: false; reason: 'duplicate_account' | 'internal_server_error' }
  > {
    try {
      const encryptedLinkedAccount = encryptionService.encryptLinkedAccount(linkedAccount);

      const duplicateLinkedAccount = await prisma.linkedAccount.findFirst({
        where: {
          environment_id: linkedAccount.environment_id,
          integration_provider: linkedAccount.integration_provider,
          credentials: encryptedLinkedAccount.credentials,
          deleted_at: null,
        },
      });

      if (duplicateLinkedAccount) {
        const environment = await environmentService.getEnvironmentById(
          linkedAccount.environment_id
        );

        const duplicateAccountBehavior =
          environment?.duplicate_account_behavior as DuplicateAccountBehavior;

        if (duplicateAccountBehavior === DuplicateAccountBehavior.ThrowError) {
          return { success: false, reason: 'duplicate_account' };
        }

        if (duplicateAccountBehavior === DuplicateAccountBehavior.UseExisting) {
          const existingLinkedAccount = await prisma.linkedAccount.update({
            where: {
              id: encryptedLinkedAccount.id,
              environment_id: encryptedLinkedAccount.environment_id,
            },
            data: {
              ...encryptedLinkedAccount,
              credentials: encryptedLinkedAccount.credentials || undefined,
              configuration: encryptedLinkedAccount.configuration || undefined,
              metadata: encryptedLinkedAccount.metadata || undefined,
            },
          });

          return {
            success: true,
            linkedAccount: existingLinkedAccount,
            action: 'updated',
          };
        }
      }

      const newLinkedAccount = await prisma.linkedAccount.create({
        data: {
          ...encryptedLinkedAccount,
          configuration: encryptedLinkedAccount.configuration || {},
          metadata: encryptedLinkedAccount.metadata || undefined,
        },
      });

      return {
        success: true,
        linkedAccount: newLinkedAccount,
        action: 'created',
      };
    } catch (err) {
      await errorService.reportError(err);
      return { success: false, reason: 'internal_server_error' };
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

      let linkedAccounts = await prisma.linkedAccount.findMany({
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
      const linkedAccount = await prisma.linkedAccount.findUnique({
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
      const linkedAccount = await prisma.linkedAccount.findUnique({
        where: { id: linkedAccountId },
      });

      if (!linkedAccount) {
        return null;
      }

      return await prisma.linkedAccount.update({
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
