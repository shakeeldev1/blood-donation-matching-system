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

  async sendBloodRequestCreatedEmail(
    to: string,
    data: {
      requesterName: string;
      patientName: string;
      bloodGroup: string;
      units: number;
      urgency: string;
      hospital: string;
      city: string;
      contact: string;
      requestId: string;
    },
  ) {
    const appName = 'Blood Donation System';
    const supportEmail = this.configService.get('MAIL_USER');
    const urgencyColor =
      data.urgency === 'Critical'
        ? '#c62828'
        : data.urgency === 'High'
          ? '#e65100'
          : '#2e7d32';

    try {
      await this.transporter.sendMail({
        from: `"${appName}" <${supportEmail}>`,
        to,
        subject: `Blood Request Submitted – ${data.bloodGroup} · ${data.urgency} Urgency`,
        html: `
<div style="margin:0;padding:0;background-color:#f4f6f8;font-family:Arial,Helvetica,sans-serif;">
  <table align="center" width="100%" cellpadding="0" cellspacing="0"
    style="max-width:600px;margin:40px auto;background:#ffffff;border-radius:8px;overflow:hidden;box-shadow:0 4px 12px rgba(0,0,0,0.08);">
    <tr><td style="background-color:#d32f2f;padding:20px;text-align:center;">
      <h2 style="color:#ffffff;margin:0;">${appName}</h2>
    </td></tr>
    <tr><td style="padding:30px;">
      <h3 style="margin-top:0;color:#333;">Blood Request Submitted</h3>
      <p style="color:#555;font-size:15px;">Hi <strong>${data.requesterName}</strong>,</p>
      <p style="color:#555;font-size:15px;line-height:1.6;">
        Your blood request has been successfully submitted and is now <strong>visible to matching donors</strong>.
        Here are the details:
      </p>
      <table width="100%" cellpadding="8" cellspacing="0"
        style="border-collapse:collapse;border:1px solid #e0e0e0;border-radius:6px;margin:16px 0;">
        <tr style="background:#f9f9f9;"><td style="color:#777;width:40%;">Patient Name</td><td style="color:#333;font-weight:bold;">${data.patientName}</td></tr>
        <tr><td style="color:#777;">Blood Group</td><td style="color:#d32f2f;font-weight:bold;font-size:18px;">${data.bloodGroup}</td></tr>
        <tr style="background:#f9f9f9;"><td style="color:#777;">Units Required</td><td style="color:#333;">${data.units}</td></tr>
        <tr><td style="color:#777;">Urgency</td><td><span style="color:${urgencyColor};font-weight:bold;">${data.urgency}</span></td></tr>
        <tr style="background:#f9f9f9;"><td style="color:#777;">Hospital</td><td style="color:#333;">${data.hospital}</td></tr>
        <tr><td style="color:#777;">City</td><td style="color:#333;">${data.city}</td></tr>
        <tr style="background:#f9f9f9;"><td style="color:#777;">Contact</td><td style="color:#333;">${data.contact}</td></tr>
        <tr><td style="color:#777;">Status</td><td><span style="color:#1565c0;font-weight:bold;">Pending</span></td></tr>
      </table>
      <p style="color:#777;font-size:13px;">Request ID: <code>${data.requestId}</code></p>
      <p style="color:#555;font-size:14px;">
        You will receive another email when a donor accepts or fulfils this request.
      </p>
    </td></tr>
    <tr><td style="background-color:#f4f6f8;padding:20px;text-align:center;font-size:12px;color:#999;">
      © ${new Date().getFullYear()} ${appName}. All rights reserved.
    </td></tr>
  </table>
</div>`,
      });
    } catch {
      // non-critical – swallow silently so the request still saves
    }
  }

  async sendBloodRequestStatusUpdatedEmail(
    to: string,
    data: {
      requesterName: string;
      patientName: string;
      bloodGroup: string;
      hospital: string;
      status: string;
      updatedByName: string;
      requestId: string;
    },
  ) {
    const appName = 'Blood Donation System';
    const supportEmail = this.configService.get('MAIL_USER');

    const statusColor: Record<string, string> = {
      Pending: '#1565c0',
      Accepted: '#2e7d32',
      Fulfilled: '#6a1b9a',
      Closed: '#616161',
    };
    const statusMessage: Record<string, string> = {
      Accepted:
        'A donor has <strong>accepted</strong> your request and will be in touch soon.',
      Fulfilled:
        'Your blood request has been <strong>fulfilled</strong>. Thank you for using our platform!',
      Closed: 'Your blood request has been <strong>closed</strong>.',
      Pending:
        'Your blood request status has been reset to <strong>Pending</strong>.',
    };
    const color = statusColor[data.status] ?? '#333';
    const message =
      statusMessage[data.status] ??
      `Status changed to <strong>${data.status}</strong>.`;

    try {
      await this.transporter.sendMail({
        from: `"${appName}" <${supportEmail}>`,
        to,
        subject: `Blood Request Update – Status changed to ${data.status}`,
        html: `
<div style="margin:0;padding:0;background-color:#f4f6f8;font-family:Arial,Helvetica,sans-serif;">
  <table align="center" width="100%" cellpadding="0" cellspacing="0"
    style="max-width:600px;margin:40px auto;background:#ffffff;border-radius:8px;overflow:hidden;box-shadow:0 4px 12px rgba(0,0,0,0.08);">
    <tr><td style="background-color:#d32f2f;padding:20px;text-align:center;">
      <h2 style="color:#ffffff;margin:0;">${appName}</h2>
    </td></tr>
    <tr><td style="padding:30px;">
      <h3 style="margin-top:0;color:#333;">Blood Request Status Update</h3>
      <p style="color:#555;font-size:15px;">Hi <strong>${data.requesterName}</strong>,</p>
      <p style="color:#555;font-size:15px;line-height:1.6;">${message}</p>
      <div style="margin:24px 0;text-align:center;">
        <span style="display:inline-block;padding:10px 24px;font-size:20px;font-weight:bold;color:${color};border:2px solid ${color};border-radius:6px;">
          ${data.status}
        </span>
      </div>
      <table width="100%" cellpadding="8" cellspacing="0"
        style="border-collapse:collapse;border:1px solid #e0e0e0;border-radius:6px;margin:16px 0;">
        <tr style="background:#f9f9f9;"><td style="color:#777;width:40%;">Patient Name</td><td style="color:#333;font-weight:bold;">${data.patientName}</td></tr>
        <tr><td style="color:#777;">Blood Group</td><td style="color:#d32f2f;font-weight:bold;font-size:18px;">${data.bloodGroup}</td></tr>
        <tr style="background:#f9f9f9;"><td style="color:#777;">Hospital</td><td style="color:#333;">${data.hospital}</td></tr>
        <tr><td style="color:#777;">Updated By</td><td style="color:#333;">${data.updatedByName}</td></tr>
      </table>
      <p style="color:#777;font-size:13px;">Request ID: <code>${data.requestId}</code></p>
    </td></tr>
    <tr><td style="background-color:#f4f6f8;padding:20px;text-align:center;font-size:12px;color:#999;">
      © ${new Date().getFullYear()} ${appName}. All rights reserved.
    </td></tr>
  </table>
</div>`,
      });
    } catch {
      // non-critical
    }
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
