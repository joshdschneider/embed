import { DEFAULT_ERROR_MESSAGE, ErrorCode, billingService, errorService } from '@embed/shared';
import { Request, Response } from 'express';
import organizationService from '../services/organization.service';
import { zodError } from '../utils/helpers';
import {
  AddPaymentMethodRequestSchema,
  BillingDetailsObject,
  InvoiceObject,
  OrganizationObject,
  PaymentMethodObject,
  UpcomingInvoiceObject,
  UserObject,
} from '../utils/types';

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

  public async addPaymentMethod(req: Request, res: Response) {
    try {
      const organizationId = req.params['organization_id'];
      if (!organizationId) {
        return errorService.errorResponse(res, {
          code: ErrorCode.BadRequest,
          message: 'Invalid organization ID',
        });
      }

      const parsedBody = AddPaymentMethodRequestSchema.safeParse(req.body);
      if (!parsedBody.success) {
        return errorService.errorResponse(res, {
          code: ErrorCode.BadRequest,
          message: zodError(parsedBody.error),
        });
      }

      const paymentMethod = await billingService.addPaymentMethod({
        organizationId,
        stripePaymentMethodId: parsedBody.data.stripe_payment_method_id,
      });

      if (!paymentMethod) {
        return errorService.errorResponse(res, {
          code: ErrorCode.InternalServerError,
          message: DEFAULT_ERROR_MESSAGE,
        });
      }

      const paymentMethodObject: PaymentMethodObject = {
        object: 'payment_method',
        ...paymentMethod,
      };

      res.status(200).json(paymentMethodObject);
    } catch (err) {
      await errorService.reportError(err);

      return errorService.errorResponse(res, {
        code: ErrorCode.InternalServerError,
        message: DEFAULT_ERROR_MESSAGE,
      });
    }
  }

  public async getBillingDetails(req: Request, res: Response) {
    try {
      const organizationId = req.params['organization_id'];
      if (!organizationId) {
        return errorService.errorResponse(res, {
          code: ErrorCode.BadRequest,
          message: 'Invalid organization ID',
        });
      }

      const billingDetails = await billingService.getBillingDetails(organizationId);
      if (!billingDetails) {
        return errorService.errorResponse(res, {
          code: ErrorCode.InternalServerError,
          message: DEFAULT_ERROR_MESSAGE,
        });
      }

      const paymentMethod: PaymentMethodObject | null = billingDetails.payment_method
        ? { object: 'payment_method', ...billingDetails.payment_method }
        : null;

      const upcomingInvoice: UpcomingInvoiceObject | null = billingDetails.upcoming_invoice
        ? { object: 'upcoming_invoice', ...billingDetails.upcoming_invoice }
        : null;

      const billingDetailsObject: BillingDetailsObject = {
        object: 'billing_details',
        plan: billingDetails.plan,
        payment_method: paymentMethod,
        upcoming_invoice: upcomingInvoice,
      };

      res.status(200).json(billingDetailsObject);
    } catch (err) {
      await errorService.reportError(err);

      return errorService.errorResponse(res, {
        code: ErrorCode.InternalServerError,
        message: DEFAULT_ERROR_MESSAGE,
      });
    }
  }

  public async listInvoices(req: Request, res: Response) {
    try {
      const organizationId = req.params['organization_id'];
      if (!organizationId) {
        return errorService.errorResponse(res, {
          code: ErrorCode.BadRequest,
          message: 'Invalid organization ID',
        });
      }

      const invoices = await billingService.listInvoices(organizationId);
      if (!invoices) {
        return errorService.errorResponse(res, {
          code: ErrorCode.InternalServerError,
          message: DEFAULT_ERROR_MESSAGE,
        });
      }

      const invoicesObject: InvoiceObject[] = invoices.map((invoice) => {
        return { object: 'invoice', ...invoice };
      });

      res.status(200).json({ object: 'list', data: invoicesObject });
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
