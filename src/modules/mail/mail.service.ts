import { Injectable, Logger } from '@nestjs/common';

/**
 * Mail service stub — logs email actions to console in development.
 *
 * In the mail integration phase, replace the stub body with a real provider
 * (e.g. Nodemailer, Resend, SendGrid) and load HTML templates from
 * src/modules/mail/templates/.
 */
@Injectable()
export class MailService {
  private readonly logger = new Logger(MailService.name);

  /**
   * Sends a password reset email containing the reset link.
   * TODO (mail phase): replace stub with real provider send.
   */
  async sendPasswordResetEmail(to: string, resetUrl: string): Promise<void> {
    this.logger.log(`[MAIL STUB] Password reset email → ${to}`);
    this.logger.log(`[MAIL STUB] Reset URL: ${resetUrl}`);
    // TODO (mail phase):
    // await this.mailer.sendMail({
    //   to,
    //   subject: 'Reset your MTD ITSA password',
    //   html: renderTemplate('password-reset', { resetUrl }),
    // });
  }

  /**
   * Sends a welcome email after successful registration.
   * TODO (mail phase): replace stub with real provider send.
   */
  async sendWelcomeEmail(to: string, firstName: string): Promise<void> {
    this.logger.log(`[MAIL STUB] Welcome email → ${to} (${firstName})`);
    // TODO (mail phase): implement welcome email template and send
  }
}
