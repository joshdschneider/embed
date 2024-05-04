import type { OrganizationMembership, User } from '@embed/shared';
import { database, errorService } from '@embed/shared';

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
}

export default new UserService();
