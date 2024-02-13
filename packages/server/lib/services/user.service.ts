import type { Account, User } from '@kit/shared';
import { database, errorService } from '@kit/shared';

class UserService {
  public async createUser(user: User): Promise<User | null> {
    try {
      return await database.user.create({ data: user });
    } catch (err) {
      await errorService.reportError(err);
      return null;
    }
  }

  public async getUserById(userId: string): Promise<(User & { account: Account }) | null> {
    try {
      return await database.user.findUnique({
        where: { id: userId, deleted_at: null },
        include: { account: true },
      });
    } catch (err) {
      await errorService.reportError(err);
      return null;
    }
  }
}

export default new UserService();
