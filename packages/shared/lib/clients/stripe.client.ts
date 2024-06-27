import Stripe from 'stripe';
import errorService from '../services/error.service';
import { getStripeApiKey } from '../utils/constants';
import { MeterEvent } from '../utils/enums';
import { UsageRecord } from '../utils/types';

class StripeClient {
  private static instance: StripeClient;
  private stripe: Stripe;

  private constructor(stripe: Stripe) {
    this.stripe = stripe;
  }

  static getInstance(): StripeClient {
    if (!this.instance) {
      this.instance = this.create();
    }

    return this.instance;
  }

  private static create(): StripeClient {
    const apiKey = getStripeApiKey();
    if (!apiKey) {
      throw new Error('Stripe API key not set');
    }

    const stripe = new Stripe(apiKey);
    return new StripeClient(stripe);
  }

  public async createCustomer({
    organizationId,
    name,
    email,
  }: {
    organizationId: string;
    name: string;
    email?: string;
  }): Promise<Stripe.Customer | null> {
    try {
      return await this.stripe.customers.create({
        name,
        email,
        metadata: { organization_id: organizationId },
      });
    } catch (err) {
      await errorService.reportError(err);
      return null;
    }
  }

  public async updateCustomer({
    stripeCustomerId,
    name,
  }: {
    stripeCustomerId: string;
    name: string;
  }): Promise<Stripe.Customer | null> {
    try {
      return await this.stripe.customers.update(stripeCustomerId, { name });
    } catch (err) {
      await errorService.reportError(err);
      return null;
    }
  }

  public async getCustomer(
    stripeCustomerId: string
  ): Promise<(Stripe.Customer | Stripe.DeletedCustomer) | null> {
    try {
      return await this.stripe.customers.retrieve(stripeCustomerId);
    } catch (err) {
      await errorService.reportError(err);
      return null;
    }
  }

  public async attachPaymentMethod({
    stripeCustomerId,
    stripePaymentMethodId,
  }: {
    stripeCustomerId: string;
    stripePaymentMethodId: string;
  }): Promise<Stripe.PaymentMethod | null> {
    try {
      const paymentMethod = await this.stripe.paymentMethods.attach(stripePaymentMethodId, {
        customer: stripeCustomerId,
      });

      await this.stripe.customers.update(stripeCustomerId, {
        invoice_settings: { default_payment_method: stripePaymentMethodId },
      });

      return paymentMethod;
    } catch (err) {
      await errorService.reportError(err);
      return null;
    }
  }

  public async detachPaymentMethod(
    stripePaymentMethodId: string
  ): Promise<Stripe.PaymentMethod | null> {
    try {
      return await this.stripe.paymentMethods.detach(stripePaymentMethodId);
    } catch (err) {
      await errorService.reportError(err);
      return null;
    }
  }

  public async getPaymentMethod(
    stripePaymentMethodId: string
  ): Promise<Stripe.PaymentMethod | null> {
    try {
      return await this.stripe.paymentMethods.retrieve(stripePaymentMethodId);
    } catch (err) {
      await errorService.reportError(err);
      return null;
    }
  }

  public async createDefaultSubscription(
    stripeCustomerId: string,
    items: Stripe.SubscriptionCreateParams.Item[]
  ): Promise<Stripe.Subscription | null> {
    try {
      return await this.stripe.subscriptions.create({
        customer: stripeCustomerId,
        items: items,
        proration_behavior: 'none',
        billing_thresholds: { amount_gte: 25000 },
        billing_cycle_anchor_config: { day_of_month: 1 },
        description: 'Embed API usage',
        collection_method: 'charge_automatically',
      });
    } catch (err) {
      await errorService.reportError(err);
      return null;
    }
  }

  public async cancelSubscription(
    stripeSubscriptionId: string
  ): Promise<Stripe.Subscription | null> {
    try {
      return await this.stripe.subscriptions.cancel(stripeSubscriptionId);
    } catch (err) {
      await errorService.reportError(err);
      return null;
    }
  }

  public async updateSubscriptionConnectionsQuantity({
    stripeSubscriptionId,
    stripeConnectionsPriceId,
    connectionCount,
  }: {
    stripeSubscriptionId: string;
    stripeConnectionsPriceId: string;
    connectionCount: number;
  }): Promise<Stripe.Subscription | null> {
    try {
      const subscription = await this.stripe.subscriptions.retrieve(stripeSubscriptionId);
      const subscriptionItem = subscription.items.data.find(
        (item) => item.price.id === stripeConnectionsPriceId
      );

      if (!subscriptionItem) {
        throw new Error('Failed to lookup subscription item by price ID');
      }

      return await this.stripe.subscriptions.update(stripeSubscriptionId, {
        proration_behavior: 'none',
        items: [{ id: subscriptionItem.id, quantity: connectionCount }],
      });
    } catch (err) {
      await errorService.reportError(err);
      return null;
    }
  }

  public async reportUsage({
    stripeCustomerId,
    usageRecord,
  }: {
    stripeCustomerId: string;
    usageRecord: UsageRecord;
  }): Promise<Stripe.Billing.MeterEvent | null> {
    try {
      const meterEvent: Stripe.Billing.MeterEventCreateParams = {
        event_name: usageRecord.meterEvent,
        payload: { stripe_customer_id: stripeCustomerId },
      };

      if (
        usageRecord.meterEvent === MeterEvent.SyncedWords ||
        usageRecord.meterEvent === MeterEvent.SyncedImages ||
        usageRecord.meterEvent === MeterEvent.SyncedVideo ||
        usageRecord.meterEvent === MeterEvent.SyncedAudio
      ) {
        meterEvent.payload['value'] = usageRecord.value.toString();
      }

      return await this.stripe.billing.meterEvents.create(meterEvent);
    } catch (err) {
      await errorService.reportError(err);
      return null;
    }
  }

  public async getUpcomingInvoice(
    stripeCustomerId: string,
    stripeSubscriptionId: string
  ): Promise<Stripe.UpcomingInvoice | null> {
    try {
      return await this.stripe.invoices.retrieveUpcoming({
        customer: stripeCustomerId,
        subscription: stripeSubscriptionId,
      });
    } catch (err) {
      await errorService.reportError(err);
      return null;
    }
  }

  public async listInvoices(
    stripeCustomerId: string,
    stripeSubscriptionId: string
  ): Promise<Stripe.Invoice[] | null> {
    try {
      const invoices = await this.stripe.invoices.list({
        customer: stripeCustomerId,
        subscription: stripeSubscriptionId,
        limit: 20,
      });
      return invoices.data;
    } catch (err) {
      await errorService.reportError(err);
      return null;
    }
  }
}

export default StripeClient;
