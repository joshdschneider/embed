import type { OrganizationMembership, User } from '@embed/shared';
import { database, errorService, now } from '@embed/shared';

class UserService {
  public async persistUser(user: User): Promise<User | null> {
    try {
      return await database.user.create({ data: user });
    } catch (err) {
      await errorService.reportError(err);
      return null;
    }
  }

  public async getUserById(
    userId: string
  ): Promise<(User & { organization_memberships: OrganizationMembership[] }) | null> {
    try {
      return await database.user.findUnique({
        where: { id: userId, deleted_at: null },
        include: { organization_memberships: true },
      });
    } catch (err) {
      await errorService.reportError(err);
      return null;
    }
  }

  public async updateUser(userId: string, payload: Partial<User>): Promise<User | null> {
    try {
      return await database.user.update({
        where: { id: userId, deleted_at: null },
        data: {
          first_name: payload.first_name,
          last_name: payload.last_name,
          email_subscriptions: payload.email_subscriptions,
          updated_at: now(),
        },
      });
    } catch (err) {
      await errorService.reportError(err);
      return null;
    }
  }
}

export default new UserService();
