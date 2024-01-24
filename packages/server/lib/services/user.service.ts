import { User } from '@prisma/client';
import { prisma } from '../utils/prisma';
import errorService from './error.service';

class UserService {
  public async createUser(user: User): Promise<User | null> {
    try {
      return await prisma.user.create({ data: user });
    } catch (err) {
      await errorService.reportError(err);
      return null;
    }
  }

  public async getUserById(userId: string): Promise<User | null> {
    try {
      return await prisma.user.findUnique({
        where: { id: userId, deleted_at: null },
      });
    } catch (err) {
      await errorService.reportError(err);
      return null;
    }
  }
}

export default new UserService();
