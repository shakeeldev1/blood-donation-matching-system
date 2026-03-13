// mail.service.ts
import { Injectable, InternalServerErrorException } from '@nestjs/common';
import * as nodemailer from 'nodemailer';
import { ConfigService } from '@nestjs/config';

@Injectable()
export class MailModuleService {
    private transporter: nodemailer.Transporter;

    constructor(private configService: ConfigService) {
    const host = this.configService.get<string>('MAIL_HOST');
    const port = Number(this.configService.get<string>('MAIL_PORT'));
    const user = this.configService.get<string>('MAIL_USER');
    const pass = this.configService.get<string>('MAIL_PASS');

    if (!host || !port || !user || !pass) {
      throw new Error(
        'Mail config missing. Set MAIL_HOST, MAIL_PORT, MAIL_USER, MAIL_PASS in server/.env',
      );
    }

        this.transporter = nodemailer.createTransport({
      host,
      port,
            secure: false,
            auth: {
        user,
        pass,
            },
        });
    }

    async sendOtpEmail(to: string, otp: string) {
        const appName = 'Blood Donation System';
        const supportEmail = this.configService.get('MAIL_USER');

        try {
          await this.transporter.sendMail({
            from: `"${appName}" <${supportEmail}>`,
            to,
            subject: 'Verify Your Email Address',
            html: `
    <div style="margin:0;padding:0;background-color:#f4f6f8;font-family:Arial,Helvetica,sans-serif;">
      <table align="center" width="100%" cellpadding="0" cellspacing="0" style="max-width:600px;margin:40px auto;background:#ffffff;border-radius:8px;overflow:hidden;box-shadow:0 4px 12px rgba(0,0,0,0.08);">
        
        <!-- Header -->
        <tr>
          <td style="background-color:#d32f2f;padding:20px;text-align:center;">
            <h2 style="color:#ffffff;margin:0;">${appName}</h2>
          </td>
        </tr>

        <!-- Body -->
        <tr>
          <td style="padding:30px;">
            <h3 style="margin-top:0;color:#333333;">Email Verification</h3>
            <p style="color:#555555;font-size:15px;line-height:1.6;">
              Thank you for registering. Please use the verification code below to complete your sign-in process.
            </p>

            <!-- OTP Box -->
            <div style="margin:30px 0;text-align:center;">
              <span style="display:inline-block;padding:14px 28px;font-size:28px;letter-spacing:6px;font-weight:bold;color:#d32f2f;border:2px dashed #d32f2f;border-radius:6px;">
                ${otp}
              </span>
            </div>

            <p style="color:#777777;font-size:14px;">
              This code will expire in <strong>5 minutes</strong>.  
              If you did not request this email, you can safely ignore it.
            </p>
          </td>
        </tr>

        <!-- Footer -->
        <tr>
          <td style="background-color:#f4f6f8;padding:20px;text-align:center;font-size:12px;color:#999999;">
            © ${new Date().getFullYear()} ${appName}. All rights reserved.
          </td>
        </tr>

      </table>
    </div>
    `,
        });
      } catch {
        throw new InternalServerErrorException(
          'Failed to send OTP email. Check SMTP settings in server/.env',
        );
      }
    }
}