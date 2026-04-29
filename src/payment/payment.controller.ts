import {
  BadRequestException,
  Controller,
  Post,
  Get,
  Body,
  Headers,
  Param,
  UseGuards,
  Request,
  Query,
  HttpCode,
  HttpStatus,
} from '@nestjs/common';
import type { Request as ExpressRequest } from 'express';
import { PaymentService } from './payment.service';
import { CreatePaymentIntentDto, ConfirmPaymentDto } from './dto/payment.dto';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';

type AuthRequest = ExpressRequest & {
  user: {
    sub?: string;
    id?: string;
  };
  rawBody?: Buffer;
};

@Controller(['api/payments', 'payments'])
export class PaymentController {
  constructor(private readonly paymentService: PaymentService) {}

  /**
   * Create a payment intent
   * POST /api/payments/create-intent
   */
  @UseGuards(JwtAuthGuard)
  @Post('create-intent')
  async createPaymentIntent(
    @Request() req: AuthRequest,
    @Body() dto: CreatePaymentIntentDto,
  ) {
    const userId = req.user?.sub ?? req.user?.id;
    if (!userId) {
      throw new BadRequestException('Invalid authenticated user');
    }

    const result = await this.paymentService.createPaymentIntent(userId, dto);
    return {
      success: true,
      data: result,
    };
  }

  /**
   * Confirm payment after client-side processing
   * POST /api/payments/confirm
   */
  @UseGuards(JwtAuthGuard)
  @Post('confirm')
  @HttpCode(HttpStatus.OK)
  async confirmPayment(@Request() req: AuthRequest, @Body() dto: ConfirmPaymentDto) {
    const userId = req.user?.sub ?? req.user?.id;
    if (!userId) {
      throw new BadRequestException('Invalid authenticated user');
    }

    const result = await this.paymentService.confirmPayment(userId, dto);
    return {
      success: true,
      data: result,
    };
  }

  /**
   * Get payment details
   * GET /api/payments/:id
   */
  @UseGuards(JwtAuthGuard)
  @Get(':id')
  async getPayment(
    @Param('id') paymentId: string,
    @Request() req: AuthRequest,
  ) {
    const userId = req.user?.sub ?? req.user?.id;
    if (!userId) {
      throw new BadRequestException('Invalid authenticated user');
    }

    const payment = await this.paymentService.getPaymentById(paymentId, userId);
    return {
      success: !!payment,
      data: payment,
    };
  }

  /**
   * Get user payment history
   * GET /api/payments
   */
  @UseGuards(JwtAuthGuard)
  @Get()
  async getUserPayments(
    @Request() req: AuthRequest,
    @Query('limit') limit?: string,
    @Query('offset') offset?: string,
  ) {
    const userId = req.user?.sub ?? req.user?.id;
    if (!userId) {
      throw new BadRequestException('Invalid authenticated user');
    }

    const result = await this.paymentService.getUserPayments(
      userId,
      limit ? parseInt(limit) : 10,
      offset ? parseInt(offset) : 0,
    );
    return {
      success: true,
      data: result,
    };
  }

  /**
   * Create refund
   * POST /api/payments/:id/refund
   */
  @UseGuards(JwtAuthGuard)
  @Post(':id/refund')
  async createRefund(
    @Param('id') paymentId: string,
    @Request() req: AuthRequest,
    @Body('amount') amount?: number,
  ) {
    const userId = req.user?.sub ?? req.user?.id;
    if (!userId) {
      throw new BadRequestException('Invalid authenticated user');
    }

    const result = await this.paymentService.createRefund(paymentId, userId, amount);
    return {
      success: true,
      data: result,
    };
  }

  /**
   * Stripe webhook endpoint
   * POST /api/payments/webhook
   * This endpoint should be public (no auth guard)
   */
  @Post('webhook')
  @HttpCode(HttpStatus.OK)
  async handleWebhook(
    @Request() req: AuthRequest,
    @Headers('stripe-signature') stripeSignature?: string,
    @Body() event?: unknown,
  ) {
    const webhookSecret = process.env.STRIPE_WEBHOOK_SECRET;

    if (webhookSecret) {
      if (!stripeSignature) {
        throw new BadRequestException('Missing Stripe signature header');
      }

      if (!req.rawBody) {
        throw new BadRequestException(
          'Missing raw request body for webhook signature verification',
        );
      }

      const verifiedEvent = this.paymentService.verifyWebhookEvent(
        req.rawBody,
        stripeSignature,
      );
      await this.paymentService.handleWebhookEvent(verifiedEvent as any);
      return { received: true };
    }

    await this.paymentService.handleWebhookEvent(event as any);
    return { received: true };
  }
}
