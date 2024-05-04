import type { Organization, OrganizationMembership } from '@embed/shared';
import { database, errorService, now } from '@embed/shared';
import { workos } from '../utils/constants';

class OrganizationService {
  public async createOrganization(organizationName: string): Promise<Organization | null> {
    try {
      const workosOrg = await workos.organizations.createOrganization({ name: organizationName });
      return await database.organization.create({
        data: {
          id: workosOrg.id,
          name: workosOrg.name,
          created_at: now(),
          updated_at: now(),
          deleted_at: null,
        },
      });
    } catch (err) {
      await errorService.reportError(err);
      return null;
    }
  }

  public async createOrganizationMembership({
    userId,
    organizationId,
    role,
  }: {
    userId: string;
    organizationId: string;
    role?: string;
  }): Promise<OrganizationMembership | null> {
    try {
      const workosOrgMembership = await workos.userManagement.createOrganizationMembership({
        organizationId,
        userId,
        roleSlug: role,
      });

      return await database.organizationMembership.create({
        data: {
          id: workosOrgMembership.id,
          user_id: userId,
          organization_id: organizationId,
          role: workosOrgMembership.role.slug || null,
          created_at: now(),
          updated_at: now(),
        },
      });
    } catch (err) {
      await errorService.reportError(err);
      return null;
    }
  }

  public async getOrganizationById(organizationId: string): Promise<Organization | null> {
    try {
      return await database.organization.findUnique({ where: { id: organizationId } });
    } catch (err) {
      await errorService.reportError(err);
      return null;
    }
  }
}

export default new OrganizationService();
