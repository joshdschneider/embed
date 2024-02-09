import { Sync } from '@prisma/client';
import { prisma } from '../utils/prisma';
import errorService from './error.service';

class SyncService {
  public async getSyncById(syncId: string): Promise<Sync | null> {
    try {
      return await prisma.sync.findUnique({
        where: { id: syncId, deleted_at: null },
      });
    } catch (err) {
      await errorService.reportError(err);
      return null;
    }
  }

  public async createSync(sync: Sync): Promise<Sync | null> {
    try {
      const existingSync = await prisma.sync.findFirst({
        where: {
          linked_account_id: sync.linked_account_id,
          model_id: sync.model_id,
        },
      });

      if (existingSync) {
        return existingSync;
      }

      return await prisma.sync.create({ data: sync });
    } catch (err) {
      await errorService.reportError(err);
      return null;
    }
  }
}

export default new SyncService();
