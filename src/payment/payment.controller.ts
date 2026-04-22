import {
  Controller,
  Post,
  Get,
  Body,
  Param,
  UseGuards,
  Request,
  Query,
  HttpCode,
  HttpStatus,
} from '@nestjs/common';
import { PaymentService } from './payment.service';
import { CreatePaymentIntentDto, ConfirmPaymentDto } from './dto/payment.dto';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';

@Controller(['api/payments', 'payments'])
export class PaymentController {
  constructor(private readonly paymentService: PaymentService) {}

  /**
   * Create a payment intent
   * POST /api/payments/create-intent
   */
  @UseGuards(JwtAuthGuard)
  @Post('create-intent')
  async createPaymentIntent(@Request() req, @Body() dto: CreatePaymentIntentDto) {
    const userId = req.user.id;
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
  async confirmPayment(@Request() req, @Body() dto: ConfirmPaymentDto) {
    const userId = req.user.id;
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
  async getPayment(@Param('id') paymentId: string) {
    const payment = await this.paymentService.getPaymentById(paymentId);
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
    @Request() req,
    @Query('limit') limit?: string,
    @Query('offset') offset?: string,
  ) {
    const userId = req.user.id;
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
    @Body('amount') amount?: number,
  ) {
    const result = await this.paymentService.createRefund(paymentId, amount);
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
  async handleWebhook(@Body() event: any) {
    // TODO: Verify webhook signature from Stripe
    await this.paymentService.handleWebhookEvent(event);
    return { received: true };
  }
}
