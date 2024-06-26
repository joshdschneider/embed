import { PaymentMethod, Subscription } from '@prisma/client';
import StripeClient from '../clients/stripe.client';
import { getStripeDefaultPriceIds } from '../utils/constants';
import { database } from '../utils/database';
import { LockedReason, Resource, SubscriptionPlan, SubscriptionStatus } from '../utils/enums';
import { generateId, now } from '../utils/helpers';
import {
  BillingDetails,
  Invoice,
  StripePriceIds,
  UpcomingInvoice,
  UsageRecord,
} from '../utils/types';
import environmentService from './environment.service';
import errorService from './error.service';

class BillingService {
  public async createCustomer({
    name,
    organizationId,
    email,
  }: {
    name: string;
    organizationId: string;
    email?: string;
  }): Promise<string | null> {
    try {
      const stripe = StripeClient.getInstance();
      const stripeCustomer = await stripe.createCustomer({ name, organizationId, email });
      if (!stripeCustomer) {
        return null;
      }

      return stripeCustomer.id;
    } catch (error) {
      await errorService.reportError(error);
      return null;
    }
  }

  public async updateCustomer({
    organizationId,
    name,
  }: {
    organizationId: string;
    name: string;
  }): Promise<string | null> {
    try {
      const organization = await database.organization.findUnique({
        where: { id: organizationId, deleted_at: null },
        select: { stripe_id: true },
      });

      if (!organization) {
        throw new Error('Organization not found');
      }

      const stripe = StripeClient.getInstance();
      const stripeCustomer = await stripe.updateCustomer({
        stripeCustomerId: organization.stripe_id,
        name,
      });

      if (!stripeCustomer) {
        return null;
      }

      return stripeCustomer.id;
    } catch (error) {
      await errorService.reportError(error);
      return null;
    }
  }

  public async addPaymentMethod({
    organizationId,
    stripePaymentMethodId,
  }: {
    organizationId: string;
    stripePaymentMethodId: string;
  }): Promise<PaymentMethod | null> {
    try {
      const organization = await database.organization.findUnique({
        where: { id: organizationId, deleted_at: null },
        select: { stripe_id: true, environments: true, payment_methods: true },
      });

      if (!organization) {
        throw new Error('Organization not found');
      }

      const stripe = StripeClient.getInstance();
      const stripePaymentMethod = await stripe.attachPaymentMethod({
        stripeCustomerId: organization.stripe_id,
        stripePaymentMethodId,
      });

      if (!stripePaymentMethod) {
        return null;
      }

      const newPaymentMethod = await database.paymentMethod.create({
        data: {
          id: generateId(Resource.PaymentMethod),
          organization_id: organizationId,
          stripe_id: stripePaymentMethod.id,
          type: stripePaymentMethod.type,
          card_brand: stripePaymentMethod.card?.brand || null,
          card_last4: stripePaymentMethod.card?.last4,
          card_exp_month: stripePaymentMethod.card?.exp_month,
          card_exp_year: stripePaymentMethod.card?.exp_year,
          created_at: now(),
          updated_at: now(),
        },
      });

      const nonDefaultPaymentMethods = organization.payment_methods.filter(
        (pm) => pm.id !== newPaymentMethod.id
      );

      if (nonDefaultPaymentMethods.length > 0) {
        for (const paymentMethod of nonDefaultPaymentMethods) {
          const detached = await stripe.detachPaymentMethod(paymentMethod.stripe_id);
          if (detached) {
            await database.paymentMethod.delete({ where: { id: paymentMethod.id } });
          }
        }
      }

      const lockedEnvironments = organization.environments.filter(
        (environment) => environment.locked
      );

      if (lockedEnvironments.length > 0) {
        for (const environment of lockedEnvironments) {
          if (
            environment.locked_reason === LockedReason.PaymentMethodRequired ||
            environment.locked_reason === LockedReason.PaymentMethodInvalid
          ) {
            await environmentService.unlockEnvironment(environment.id);
          }
        }
      }

      return newPaymentMethod;
    } catch (err) {
      await errorService.reportError(err);
      return null;
    }
  }

  public async getPaymentMethod(paymentMethodId: string): Promise<PaymentMethod | null> {
    try {
      return await database.paymentMethod.findUnique({
        where: { id: paymentMethodId },
      });
    } catch (err) {
      await errorService.reportError(err);
      return null;
    }
  }

  public async listPaymentMethods(organizationId: string): Promise<PaymentMethod[] | null> {
    try {
      return await database.paymentMethod.findMany({
        where: { organization_id: organizationId },
      });
    } catch (err) {
      await errorService.reportError(err);
      return null;
    }
  }

  public async deletePaymentMethod(paymentMethodId: string): Promise<boolean> {
    try {
      const paymentMethod = await database.paymentMethod.findUnique({
        where: { id: paymentMethodId },
      });

      if (!paymentMethod) {
        throw new Error('Payment method not found');
      }

      const stripe = StripeClient.getInstance();
      const deletedPaymentMethod = await stripe.detachPaymentMethod(paymentMethod.stripe_id);
      if (!deletedPaymentMethod) {
        return false;
      }

      await database.paymentMethod.delete({
        where: { id: paymentMethodId },
      });
      return true;
    } catch (err) {
      await errorService.reportError(err);
      return false;
    }
  }

  public async createDefaultSubscription(organizationId: string): Promise<Subscription | null> {
    try {
      const organization = await database.organization.findUnique({
        where: { id: organizationId, deleted_at: null },
        select: { stripe_id: true },
      });

      if (!organization) {
        throw new Error('Organization not found');
      }

      const priceIds = getStripeDefaultPriceIds();
      const stripeSubscriptionItems = Object.entries(priceIds).map(([item, priceId]) => {
        if (item === 'connections') {
          return { price: priceId, quantity: 0 };
        } else {
          return { price: priceId };
        }
      });

      const stripe = StripeClient.getInstance();
      const subscription = await stripe.createDefaultSubscription(
        organization.stripe_id,
        stripeSubscriptionItems
      );

      if (!subscription) {
        return null;
      }

      return await database.subscription.create({
        data: {
          id: generateId(Resource.Subscription),
          organization_id: organizationId,
          stripe_id: subscription.id,
          name: 'Pay-as-you-go',
          plan: SubscriptionPlan.PayAsYouGo,
          status: SubscriptionStatus.Active,
          price_ids: priceIds,
          created_at: now(),
          updated_at: now(),
        },
      });
    } catch (err) {
      await errorService.reportError(err);
      return null;
    }
  }

  public async getSubscription(subscriptionId: string): Promise<Subscription | null> {
    try {
      return await database.subscription.findUnique({
        where: { id: subscriptionId },
      });
    } catch (err) {
      await errorService.reportError(err);
      return null;
    }
  }

  public async listSubscriptions(organizationId: string): Promise<Subscription[] | null> {
    try {
      return await database.subscription.findMany({
        where: { organization_id: organizationId },
      });
    } catch (err) {
      await errorService.reportError(err);
      return null;
    }
  }

  public async deleteSubscription(subscriptionId: string): Promise<boolean> {
    try {
      await database.subscription.delete({
        where: { id: subscriptionId },
      });
      return true;
    } catch (err) {
      await errorService.reportError(err);
      return false;
    }
  }

  public async updateSubscriptionConnectionsQuantity({
    organizationId,
    connectionCount,
  }: {
    organizationId: string;
    connectionCount: number;
  }): Promise<boolean> {
    try {
      const organization = await database.organization.findUnique({
        where: { id: organizationId, deleted_at: null },
        select: { subscriptions: true },
      });

      if (!organization) {
        throw new Error('Organization not found');
      }

      const { subscriptions } = organization;
      const activeSubscription = subscriptions.find((s) => s.status === SubscriptionStatus.Active);
      if (!activeSubscription) {
        throw new Error('Active subscription not found');
      }

      const stripePriceIds = activeSubscription.price_ids as StripePriceIds;
      const connectionsPriceId = stripePriceIds.connections;
      if (!connectionsPriceId) {
        throw new Error('Connections price ID not found on subscription');
      }

      const stripe = StripeClient.getInstance();
      const updatedSubscription = await stripe.updateSubscriptionConnectionsQuantity({
        stripeSubscriptionId: activeSubscription.stripe_id,
        stripeConnectionsPriceId: connectionsPriceId,
        connectionCount: connectionCount,
      });

      return !!updatedSubscription;
    } catch (err) {
      await errorService.reportError(err);
      return false;
    }
  }

  public async reportUsage(usageRecord: UsageRecord): Promise<boolean> {
    try {
      const organization = await database.organization.findUnique({
        where: { id: usageRecord.organizationId, deleted_at: null },
        select: { stripe_id: true },
      });

      if (!organization) {
        throw new Error('Organization not found');
      }

      const stripe = StripeClient.getInstance();
      const meterEvent = await stripe.reportUsage({
        stripeCustomerId: organization.stripe_id,
        usageRecord: usageRecord,
      });

      return !!meterEvent;
    } catch (err) {
      await errorService.reportError(err);
      return false;
    }
  }

  public async getBillingDetails(organizationId: string): Promise<BillingDetails | null> {
    try {
      const organization = await database.organization.findUnique({
        where: { id: organizationId, deleted_at: null },
        select: { stripe_id: true, subscriptions: true, payment_methods: true },
      });

      if (!organization) {
        throw new Error('Organization not found');
      }

      const paymentMethod = organization.payment_methods[0];
      const activeSubscription = organization.subscriptions.find(
        (s) => s.status === SubscriptionStatus.Active
      );

      let upcomingInvoice: UpcomingInvoice | null = null;
      if (activeSubscription) {
        const stripe = StripeClient.getInstance();
        const stripeInvoice = await stripe.getUpcomingInvoice(
          organization.stripe_id,
          activeSubscription.stripe_id
        );

        if (stripeInvoice) {
          upcomingInvoice = {
            collection_method: stripeInvoice.collection_method,
            total: stripeInvoice.total,
            total_excluding_tax: stripeInvoice.total_excluding_tax,
            currency: stripeInvoice.currency,
            period_start: stripeInvoice.period_start,
            period_end: stripeInvoice.period_end,
            next_payment_attempt: stripeInvoice.next_payment_attempt,
            lines: stripeInvoice.lines.data.map((line) => ({
              description: line.description,
              amount: line.amount,
              amount_excluding_tax: line.amount_excluding_tax,
            })),
          };
        }
      }

      const billingDetails: BillingDetails = {
        plan: activeSubscription?.name || null,
        payment_method: paymentMethod || null,
        upcoming_invoice: upcomingInvoice,
      };

      return billingDetails;
    } catch (err) {
      await errorService.reportError(err);
      return null;
    }
  }

  public async listInvoices(organizationId: string): Promise<Invoice[] | null> {
    try {
      const organization = await database.organization.findUnique({
        where: { id: organizationId, deleted_at: null },
        select: { stripe_id: true, subscriptions: true },
      });

      if (!organization) {
        throw new Error('Organization not found');
      }

      const activeSubscription = organization.subscriptions.find(
        (s) => s.status === SubscriptionStatus.Active
      );

      if (!activeSubscription) {
        return [];
      }

      const stripe = StripeClient.getInstance();
      const stripeInvoices = await stripe.listInvoices(
        organization.stripe_id,
        activeSubscription.stripe_id
      );

      if (!stripeInvoices) {
        throw new Error('Failed to get invoices from Stripe');
      }

      const invoices: Invoice[] = stripeInvoices.map((invoice) => {
        return {
          total: invoice.total,
          period_start: invoice.period_start,
          period_end: invoice.period_end,
          currency: invoice.currency,
          status: invoice.status,
          invoice_pdf: invoice.invoice_pdf,
          hosted_invoice_url: invoice.hosted_invoice_url,
        };
      });

      return invoices;
    } catch (err) {
      await errorService.reportError(err);
      return null;
    }
  }
}

export default new BillingService();
