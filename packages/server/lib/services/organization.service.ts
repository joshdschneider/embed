import type { Organization, OrganizationMembership, User, WorkOSInvitation } from '@embed/shared';
import { billingService, database, errorService, getWorkOS, now } from '@embed/shared';

class OrganizationService {
  public async createOrganization(organizationName: string): Promise<Organization | null> {
    try {
      const workos = getWorkOS();
      const workosOrg = await workos.organizations.createOrganization({
        name: organizationName,
      });

      const stripeCustomer = await billingService.createCustomer({
        name: organizationName,
        organizationId: workosOrg.id,
      });

      if (!stripeCustomer) {
        return null;
      }

      return await database.organization.create({
        data: {
          id: workosOrg.id,
          name: workosOrg.name,
          stripe_id: stripeCustomer,
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
      const workos = getWorkOS();
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

  public async inviteUserToOrganization({
    organizationId,
    email,
    role,
  }: {
    organizationId: string;
    email: string;
    role?: string;
  }): Promise<WorkOSInvitation | null> {
    try {
      const workos = getWorkOS();
      const invitation = await workos.userManagement.sendInvitation({
        organizationId,
        email,
        roleSlug: role,
      });

      return invitation;
    } catch (err) {
      await errorService.reportError(err);
      return null;
    }
  }

  public async revokeOrganizationInvitation(invitationId: string): Promise<boolean> {
    try {
      const workos = getWorkOS();
      await workos.userManagement.revokeInvitation(invitationId);
      return true;
    } catch (err) {
      await errorService.reportError(err);
      return false;
    }
  }

  public async getOrganizationMembers(
    organizationId: string
  ): Promise<(OrganizationMembership & { user: User })[] | null> {
    try {
      return await database.organizationMembership.findMany({
        where: { organization_id: organizationId },
        include: { user: true },
      });
    } catch (err) {
      await errorService.reportError(err);
      return null;
    }
  }

  public async getOrganizationInvitations(
    organizationId: string
  ): Promise<WorkOSInvitation[] | null> {
    try {
      const workos = getWorkOS();
      const invitations = await workos.userManagement.listInvitations({
        organizationId: organizationId,
      });
      return invitations.data;
    } catch (err) {
      await errorService.reportError(err);
      return null;
    }
  }

  public async updateOrganization(
    organizationId: string,
    organizationName: string
  ): Promise<Organization | null> {
    try {
      const workos = getWorkOS();
      await workos.organizations.updateOrganization({
        organization: organizationId,
        name: organizationName,
      });

      return await database.organization.update({
        where: { id: organizationId },
        data: { name: organizationName, updated_at: now() },
      });
    } catch (err) {
      await errorService.reportError(err);
      return null;
    }
  }
}

export default new OrganizationService();
