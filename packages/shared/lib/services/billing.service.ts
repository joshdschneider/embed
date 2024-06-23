import { PaymentMethod, Subscription } from '@prisma/client';
import StripeClient from '../clients/stripe.client';
import { getStripeDefaultPriceIds } from '../utils/constants';
import { database } from '../utils/database';
import { Resource, SubscriptionPlan, SubscriptionStatus } from '../utils/enums';
import { generateId, now } from '../utils/helpers';
import { StripePriceIds, UsageRecord } from '../utils/types';
import errorService from './error.service';

class BillingService {
  public async createCustomer({
    name,
    organizationId,
  }: {
    name: string;
    organizationId: string;
  }): Promise<string | null> {
    try {
      const stripe = StripeClient.getInstance();
      const stripeCustomer = await stripe.createCustomer({ name, organizationId });
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
        select: { stripe_id: true },
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

      return await database.paymentMethod.create({
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
          deleted_at: null,
        },
      });
    } catch (err) {
      await errorService.reportError(err);
      return null;
    }
  }

  public async getPaymentMethod(paymentMethodId: string): Promise<PaymentMethod | null> {
    try {
      return await database.paymentMethod.findUnique({
        where: { id: paymentMethodId, deleted_at: null },
      });
    } catch (err) {
      await errorService.reportError(err);
      return null;
    }
  }

  public async listPaymentMethods(organizationId: string): Promise<PaymentMethod[] | null> {
    try {
      return await database.paymentMethod.findMany({
        where: { organization_id: organizationId, deleted_at: null },
      });
    } catch (err) {
      await errorService.reportError(err);
      return null;
    }
  }

  public async deletePaymentMethod(paymentMethodId: string): Promise<boolean> {
    try {
      const paymentMethod = await database.paymentMethod.findUnique({
        where: { id: paymentMethodId, deleted_at: null },
      });

      if (!paymentMethod) {
        throw new Error('Payment method not found');
      }

      const stripe = StripeClient.getInstance();
      const deletedPaymentMethod = await stripe.deletePaymentMethod(paymentMethod.stripe_id);
      if (!deletedPaymentMethod) {
        return false;
      }

      await database.paymentMethod.update({
        where: { id: paymentMethodId, deleted_at: null },
        data: { deleted_at: now() },
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
          deleted_at: null,
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
        where: { id: subscriptionId, deleted_at: null },
      });
    } catch (err) {
      await errorService.reportError(err);
      return null;
    }
  }

  public async listSubscriptions(organizationId: string): Promise<Subscription[] | null> {
    try {
      return await database.subscription.findMany({
        where: { organization_id: organizationId, deleted_at: null },
      });
    } catch (err) {
      await errorService.reportError(err);
      return null;
    }
  }

  public async deleteSubscription(subscriptionId: string): Promise<boolean> {
    try {
      await database.subscription.update({
        where: { id: subscriptionId, deleted_at: null },
        data: { deleted_at: now() },
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
}

export default new BillingService();
