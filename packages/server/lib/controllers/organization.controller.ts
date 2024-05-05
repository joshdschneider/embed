import { DEFAULT_ERROR_MESSAGE, ErrorCode, errorService } from '@embed/shared';
import { Request, Response } from 'express';
import organizationService from '../services/organization.service';
import { OrganizationObject, UserObject } from '../utils/types';

class OrganizationController {
  public async updateOrganization(req: Request, res: Response) {
    try {
      const organizationId = req.params['organization_id'];
      if (!organizationId) {
        return errorService.errorResponse(res, {
          code: ErrorCode.BadRequest,
          message: 'Invalid organization ID',
        });
      }

      const organizationName = req.body['name'];
      if (!organizationName || typeof organizationName !== 'string') {
        return errorService.errorResponse(res, {
          code: ErrorCode.BadRequest,
          message: 'Invalid organization name',
        });
      }

      const organization = await organizationService.updateOrganization(
        organizationId,
        organizationName
      );

      if (!organization) {
        return errorService.errorResponse(res, {
          code: ErrorCode.InternalServerError,
          message: DEFAULT_ERROR_MESSAGE,
        });
      }

      const organizationObject: OrganizationObject = {
        object: 'organization',
        id: organization.id,
        name: organization.name,
        created_at: organization.created_at,
        updated_at: organization.updated_at,
      };

      res.status(200).json(organizationObject);
    } catch (err) {
      await errorService.reportError(err);

      return errorService.errorResponse(res, {
        code: ErrorCode.InternalServerError,
        message: DEFAULT_ERROR_MESSAGE,
      });
    }
  }

  public async getOrganizationMembers(req: Request, res: Response) {
    try {
      const organizationId = req.params['organization_id'];
      if (!organizationId) {
        return errorService.errorResponse(res, {
          code: ErrorCode.BadRequest,
          message: 'Invalid organization ID',
        });
      }

      const orgMembers = await organizationService.getOrganizationMembers(organizationId);
      if (!orgMembers) {
        return errorService.errorResponse(res, {
          code: ErrorCode.InternalServerError,
          message: DEFAULT_ERROR_MESSAGE,
        });
      }

      const members: (UserObject & { role: string | null })[] = orgMembers.map((member) => {
        return {
          object: 'user',
          id: member.user.id,
          email: member.user.email,
          first_name: member.user.first_name,
          last_name: member.user.last_name,
          role: member.role,
        };
      });

      res.status(200).json({ object: 'list', data: members });
    } catch (err) {
      await errorService.reportError(err);

      return errorService.errorResponse(res, {
        code: ErrorCode.InternalServerError,
        message: DEFAULT_ERROR_MESSAGE,
      });
    }
  }

  public async getOrganizationInvitations(req: Request, res: Response) {
    try {
      const organizationId = req.params['organization_id'];
      if (!organizationId) {
        return errorService.errorResponse(res, {
          code: ErrorCode.BadRequest,
          message: 'Invalid organization ID',
        });
      }

      const orgInvitations = await organizationService.getOrganizationInvitations(organizationId);
      if (!orgInvitations) {
        return errorService.errorResponse(res, {
          code: ErrorCode.InternalServerError,
          message: DEFAULT_ERROR_MESSAGE,
        });
      }

      res.status(200).json({ object: 'list', data: orgInvitations });
    } catch (err) {
      await errorService.reportError(err);

      return errorService.errorResponse(res, {
        code: ErrorCode.InternalServerError,
        message: DEFAULT_ERROR_MESSAGE,
      });
    }
  }

  public async inviteUserToOrganization(req: Request, res: Response) {
    try {
      const organizationId = req.params['organization_id'];
      if (!organizationId) {
        return errorService.errorResponse(res, {
          code: ErrorCode.BadRequest,
          message: 'Invalid organization ID',
        });
      }

      const email = req.body['email'];
      if (!email || typeof email !== 'string') {
        return errorService.errorResponse(res, {
          code: ErrorCode.BadRequest,
          message: 'Invalid email',
        });
      }

      const role = req.body['role'];
      if (role && typeof role !== 'string') {
        return errorService.errorResponse(res, {
          code: ErrorCode.BadRequest,
          message: 'Invalid role',
        });
      }

      const invitation = await organizationService.inviteUserToOrganization({
        organizationId,
        email,
        role,
      });

      if (!invitation) {
        return errorService.errorResponse(res, {
          code: ErrorCode.InternalServerError,
          message: DEFAULT_ERROR_MESSAGE,
        });
      }

      res.status(200).json(invitation);
    } catch (err) {
      await errorService.reportError(err);

      return errorService.errorResponse(res, {
        code: ErrorCode.InternalServerError,
        message: DEFAULT_ERROR_MESSAGE,
      });
    }
  }

  public async revokeOrganizationInvitation(req: Request, res: Response) {
    try {
      const organizationId = req.params['organization_id'];
      if (!organizationId) {
        return errorService.errorResponse(res, {
          code: ErrorCode.BadRequest,
          message: 'Invalid organization ID',
        });
      }

      const invitationId = req.params['invitation_id'];
      if (!invitationId) {
        return errorService.errorResponse(res, {
          code: ErrorCode.BadRequest,
          message: 'Invalid invitation ID',
        });
      }

      const didRevoke = await organizationService.revokeOrganizationInvitation(invitationId);
      if (!didRevoke) {
        return errorService.errorResponse(res, {
          code: ErrorCode.InternalServerError,
          message: DEFAULT_ERROR_MESSAGE,
        });
      }

      res.status(200).json({ object: 'invitation.revoked', revoked: true });
    } catch (err) {
      await errorService.reportError(err);

      return errorService.errorResponse(res, {
        code: ErrorCode.InternalServerError,
        message: DEFAULT_ERROR_MESSAGE,
      });
    }
  }
}

export default new OrganizationController();
