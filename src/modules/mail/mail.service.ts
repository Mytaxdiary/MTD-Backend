import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import * as nodemailer from 'nodemailer';
import type { Transporter } from 'nodemailer';
import { passwordResetTemplate } from './templates/password-reset.template';
import { emailVerificationTemplate } from './templates/email-verification.template';
import { welcomeTemplate } from './templates/welcome.template';

@Injectable()
export class MailService {
  private readonly logger = new Logger(MailService.name);
  private transporter: Transporter | null = null;
  private readonly from: string;
  private readonly loginUrl: string;

  constructor(private readonly configService: ConfigService) {
    const host = configService.get<string>('mail.host');
    const fromEmail = configService.get<string>('mail.from') ?? 'noreply@mtditsa.co.uk';
    const fromName = configService.get<string>('mail.fromName') ?? 'NewEffect MTD ITSA';
    const frontendUrl = configService.get<string>('app.frontendUrl') ?? 'http://localhost:3000';

    this.from = `"${fromName}" <${fromEmail}>`;
    this.loginUrl = `${frontendUrl}/login`;

    if (host) {
      this.transporter = nodemailer.createTransport({
        host,
        port: configService.get<number>('mail.port') ?? 587,
        secure: configService.get<boolean>('mail.secure') ?? false,
        auth: {
          user: configService.get<string>('mail.user'),
          pass: configService.get<string>('mail.pass'),
        },
      });
      this.logger.log(`Mail transport configured via ${host}`);
    } else {
      this.logger.warn('MAIL_HOST not set — email will be logged to console only');
    }
  }

  async sendPasswordResetEmail(to: string, resetUrl: string): Promise<void> {
    await this.send(
      to,
      'Reset your MTD ITSA password',
      passwordResetTemplate(resetUrl),
      `Reset your password (valid 1 hour):\n\n${resetUrl}\n\nIf you did not request this, ignore this email.`,
    );
  }

  async sendEmailVerificationEmail(to: string, verifyUrl: string): Promise<void> {
    await this.send(
      to,
      'Verify your MTD ITSA email address',
      emailVerificationTemplate(verifyUrl),
      `Verify your email (valid 24 hours):\n\n${verifyUrl}\n\nIf you did not create an account, ignore this email.`,
    );
  }

  async sendWelcomeEmail(to: string, firstName: string): Promise<void> {
    await this.send(
      to,
      'Welcome to NewEffect MTD ITSA',
      welcomeTemplate(firstName, this.loginUrl),
      `Hi ${firstName},\n\nYour NewEffect MTD ITSA account is ready. Sign in at:\n${this.loginUrl}\n\nThe NewEffect team`,
    );
  }

  // ── Private helpers ──────────────────────────────────────────────────────

  private async send(to: string, subject: string, html: string, text: string): Promise<void> {
    if (!this.transporter) {
      this.logger.log(`[MAIL STUB] To: ${to} | Subject: ${subject}`);
      this.logger.log(`[MAIL STUB] ${text.split('\n')[0]}`);
      return;
    }

    try {
      await this.transporter.sendMail({ from: this.from, to, subject, html, text });
      this.logger.log(`Email sent → ${to} (${subject})`);
    } catch (error) {
      this.logger.error(`Failed to send email to ${to}`, error);
      throw error;
    }
  }
}
