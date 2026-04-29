import { ForbiddenException, Injectable } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model, Types } from 'mongoose';
import Stripe from 'stripe';
import { Payment, PaymentDocument } from './schemas/payment.schema';
import { CreatePaymentIntentDto, ConfirmPaymentDto } from './dto/payment.dto';

@Injectable()
export class PaymentService {
  private stripe: InstanceType<typeof Stripe>;

  constructor(
    @InjectModel(Payment.name) private paymentModel: Model<PaymentDocument>,
  ) {
    const stripeKey = process.env.STRIPE_SECRET_KEY;
    if (!stripeKey) {
      throw new Error('STRIPE_SECRET_KEY environment variable is not defined');
    }
    this.stripe = new Stripe(stripeKey);
  }

  verifyWebhookEvent(payload: Buffer, signature: string): unknown {
    const webhookSecret = process.env.STRIPE_WEBHOOK_SECRET;
    if (!webhookSecret) {
      throw new Error('STRIPE_WEBHOOK_SECRET is not configured');
    }

    return this.stripe.webhooks.constructEvent(payload, signature, webhookSecret);
  }

  /**
   * Create a payment intent for blood purchase or donation
   */
  async createPaymentIntent(userId: string, dto: CreatePaymentIntentDto) {
    try {
      // Create Stripe payment intent
      const paymentIntent = await this.stripe.paymentIntents.create({
        amount: Math.round(dto.amount * 100), // Convert to cents
        currency: dto.currency.toLowerCase(),
        metadata: {
          userId,
          paymentType: dto.paymentType,
          bloodType: dto.bloodType || '',
          units: dto.units || '',
          ...dto.metadata,
        },
      });

      // Save payment record in database
      const payment = await this.paymentModel.create({
        amount: dto.amount,
        currency: dto.currency,
        stripePaymentIntentId: paymentIntent.id,
        status: 'pending',
        userId: new Types.ObjectId(userId),
        paymentType: dto.paymentType,
        bloodType: dto.bloodType,
        units: dto.units,
        recipientId: dto.recipientId
          ? new Types.ObjectId(dto.recipientId)
          : undefined,
        metadata: dto.metadata,
      });

      return {
        clientSecret: paymentIntent.client_secret,
        paymentIntentId: paymentIntent.id,
        amount: dto.amount,
        currency: dto.currency,
      };
    } catch (error) {
      throw new Error(`Failed to create payment intent: ${error.message}`);
    }
  }

  /**
   * Confirm payment after client-side processing
   */
  async confirmPayment(userId: string, dto: ConfirmPaymentDto) {
    try {
      const paymentIntent = await this.stripe.paymentIntents.retrieve(
        dto.paymentIntentId,
        {
          expand: ['charges.data'],
        },
      );

      // Update payment record
      const payment = await this.paymentModel.findOneAndUpdate(
        {
          stripePaymentIntentId: dto.paymentIntentId,
          userId: new Types.ObjectId(userId),
        },
        {
          status: paymentIntent.status === 'succeeded' ? 'succeeded' : 'failed',
          transactionId: paymentIntent.id,
        },
        { new: true },
      );

      if (paymentIntent.status === 'succeeded' && payment) {
        // Get receipt URL if available
        const expandedIntent = paymentIntent as any;
        if (
          expandedIntent.charges &&
          expandedIntent.charges.data &&
          expandedIntent.charges.data.length > 0
        ) {
          const charge = expandedIntent.charges.data[0];
          payment.receiptUrl = charge.receipt_url || null;
          await payment.save();
        }
      }

      return payment;
    } catch (error) {
      throw new Error(`Failed to confirm payment: ${error.message}`);
    }
  }

  /**
   * Get payment by ID
   */
  async getPaymentById(paymentId: string, userId: string) {
    return this.paymentModel.findOne({
      _id: paymentId,
      userId: new Types.ObjectId(userId),
    });
  }

  /**
   * Get user's payment history
   */
  async getUserPayments(userId: string, limit = 10, offset = 0) {
    const payments = await this.paymentModel
      .find({ userId: new Types.ObjectId(userId) })
      .sort({ createdAt: -1 })
      .skip(offset)
      .limit(limit);

    const total = await this.paymentModel.countDocuments({
      userId: new Types.ObjectId(userId),
    });

    return {
      payments,
      total,
      limit,
      offset,
    };
  }

  /**
   * Handle Stripe webhook events
   */
  async handleWebhookEvent(event: any) {
    switch (event.type) {
      case 'payment_intent.succeeded':
        return await this.handlePaymentIntentSucceeded(event.data.object);

      case 'payment_intent.payment_failed':
        return await this.handlePaymentIntentFailed(event.data.object);

      case 'charge.refunded':
        return await this.handleChargeRefunded(event.data.object);

      default:
        console.log(`Unhandled event type: ${event.type}`);
    }
  }

  /**
   * Handle successful payment intent
   */
  private async handlePaymentIntentSucceeded(paymentIntent: any) {
    const payment = await this.paymentModel.findOneAndUpdate(
      { stripePaymentIntentId: paymentIntent.id },
      {
        status: 'succeeded',
        transactionId: paymentIntent.id,
      },
      { new: true },
    );

    // TODO: Update blood inventory if it's a blood_purchase
    // TODO: Send confirmation email to user
    // TODO: Log transaction

    return payment;
  }

  /**
   * Handle failed payment intent
   */
  private async handlePaymentIntentFailed(paymentIntent: any) {
    const payment = await this.paymentModel.findOneAndUpdate(
      { stripePaymentIntentId: paymentIntent.id },
      {
        status: 'failed',
      },
      { new: true },
    );

    // TODO: Notify user of payment failure
    return payment;
  }

  /**
   * Handle refund
   */
  private async handleChargeRefunded(charge: any) {
    const payment = await this.paymentModel.findOneAndUpdate(
      { transactionId: charge.payment_intent },
      {
        status: 'canceled',
      },
      { new: true },
    );

    // TODO: Reverse blood inventory if applicable
    return payment;
  }

  /**
   * Create refund
   */
  async createRefund(paymentId: string, userId: string, amount?: number) {
    try {
      const payment = await this.paymentModel.findById(paymentId);

      if (!payment || payment.status !== 'succeeded') {
        throw new Error('Payment not found or not succeeded');
      }

      if (payment.userId.toString() !== userId) {
        throw new ForbiddenException('You cannot refund another user payment');
      }

      const refund = await this.stripe.refunds.create({
        payment_intent: payment.stripePaymentIntentId,
        amount: amount ? Math.round(amount * 100) : undefined,
      });

      payment.status = 'canceled';
      await payment.save();

      return refund;
    } catch (error) {
      throw new Error(`Failed to create refund: ${error.message}`);
    }
  }
}
