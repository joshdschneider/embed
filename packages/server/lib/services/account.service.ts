import type { Account, Environment } from '@embed/shared';
import { database, errorService } from '@embed/shared';

class AccountService {
  public async createAccount(account: Account): Promise<Account | null> {
    try {
      return await database.account.create({
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
      const user = await database.user.findUnique({
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
