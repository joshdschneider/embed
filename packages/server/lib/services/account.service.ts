import { Account, Environment } from '@prisma/client';
import { prisma } from '../utils/prisma';
import errorService from './error.service';

class AccountService {
  public async createAccount(account: Account): Promise<Account | null> {
    try {
      return await prisma.account.create({
        data: account,
      });
    } catch (err) {
      await errorService.reportError(err);
      return null;
    }
  }

  public async getAccountByUserId(
    userId: string
  ): Promise<(Account & { environments: Environment[] }) | null> {
    try {
      const user = await prisma.user.findUnique({
        where: { id: userId, deleted_at: null },
        include: { account: { include: { environments: true } } },
      });

      return user ? user.account : null;
    } catch (err) {
      await errorService.reportError(err);
      return null;
    }
  }
}

export default new AccountService();
