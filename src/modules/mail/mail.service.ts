import { Injectable, Logger, Optional } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import * as nodemailer from 'nodemailer';
import type { Transporter } from 'nodemailer';
import { passwordResetTemplate } from './templates/password-reset.template';
import { emailVerificationTemplate } from './templates/email-verification.template';
import { welcomeTemplate } from './templates/welcome.template';
import {
  clientInvitationTemplate,
  clientInvitationPlainText,
  type ClientInvitationEmailData,
} from './templates/client-invitation.template';
import {
  invitationAcceptedTemplate,
  invitationAcceptedPlainText,
  type InvitationAcceptedEmailData,
} from './templates/invitation-accepted.template';
import {
  portalInviteTemplate,
  portalInvitePlainText,
  type PortalInviteEmailData,
} from './templates/portal-invite.template';
import {
  portalMessageTemplate,
  portalMessagePlainText,
  type PortalMessageEmailData,
} from './templates/portal-message.template';
import {
  portalFileUploadedTemplate,
  portalFileUploadedPlainText,
  type PortalFileUploadedEmailData,
} from './templates/portal-file-uploaded.template';
import {
  deletionRequestTemplate,
  deletionRequestPlainText,
  type DeletionRequestEmailData,
} from './templates/deletion-request.template';
import {
  deletionCancelledTemplate,
  deletionCancelledPlainText,
  type DeletionCancelledEmailData,
} from './templates/deletion-cancelled.template';
import { EmailConnectionsService } from '../email-connections/email-connections.service';

export type ClientMailSendMeta = {
  /** agent = connected mailbox; system = MAIL_FROM SMTP */
  via: 'agent' | 'system';
  fromEmail: string;
};

@Injectable()
export class MailService {
  private readonly logger = new Logger(MailService.name);
  private transporter: Transporter | null = null;
  private readonly from: string;
  private readonly fromEmail: string;
  private readonly loginUrl: string;

  constructor(
    private readonly configService: ConfigService,
    @Optional() private readonly emailConnectionsService?: EmailConnectionsService,
  ) {
    const host = configService.get<string>('mail.host');
    const fromEmail = configService.get<string>('mail.from') ?? 'noreply@mtditsa.co.uk';
    const fromName = configService.get<string>('mail.fromName') ?? 'My Tax Diary';
    const frontendUrl = configService.get<string>('app.frontendUrl') ?? 'http://localhost:3000';

    this.fromEmail = fromEmail;
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
      'Welcome to My Tax Diary',
      welcomeTemplate(firstName, this.loginUrl),
      `Hi ${firstName},\n\nYour My Tax Diary account is ready. Sign in at:\n${this.loginUrl}\n\nThe My Tax Diary team`,
    );
  }

  async sendChaseEmail(
    to: string,
    subject: string,
    body: string,
    actingUserId?: string,
  ): Promise<ClientMailSendMeta> {
    const html = `<div style="font-family:sans-serif;font-size:14px;line-height:1.6;color:#1E293B">
${body
  .split('\n')
  .map((l) => (l.trim() === '' ? '<br>' : `<p style="margin:0 0 8px">${l}</p>`))
  .join('\n')}
</div>`;
    return this.sendClientFacing(to, subject, html, body, actingUserId);
  }

  async sendInvitationAcceptedEmail(data: InvitationAcceptedEmailData): Promise<void> {
    await this.send(
      data.to,
      `${data.clientName} has accepted the HMRC invitation`,
      invitationAcceptedTemplate(data),
      invitationAcceptedPlainText(data),
    );
  }

  async sendClientInvitationEmail(
    data: ClientInvitationEmailData,
    actingUserId?: string,
  ): Promise<ClientMailSendMeta> {
    return this.sendClientFacing(
      data.to,
      `${data.firmName}: Making Tax Digital setup`,
      clientInvitationTemplate(data),
      clientInvitationPlainText(data),
      actingUserId,
    );
  }

  async sendPortalInvite(
    to: string,
    data: PortalInviteEmailData,
    actingUserId?: string,
  ): Promise<ClientMailSendMeta> {
    return this.sendClientFacing(
      to,
      `${data.firmName}: set up your client portal`,
      portalInviteTemplate(data),
      portalInvitePlainText(data),
      actingUserId,
    );
  }

  async sendPortalMessage(
    to: string,
    data: PortalMessageEmailData,
    actingUserId?: string,
  ): Promise<ClientMailSendMeta> {
    return this.sendClientFacing(
      to,
      `[${data.firmName}] ${data.subject}`,
      portalMessageTemplate(data),
      portalMessagePlainText(data),
      actingUserId,
    );
  }

  async sendPortalFileUploaded(to: string, data: PortalFileUploadedEmailData): Promise<void> {
    await this.send(
      to,
      `New file from ${data.clientName}: ${data.fileName}`,
      portalFileUploadedTemplate(data),
      portalFileUploadedPlainText(data),
    );
  }

  async sendDeletionRequestEmail(data: DeletionRequestEmailData): Promise<void> {
    await this.send(
      data.to,
      'Your My Tax Diary account deletion has been scheduled',
      deletionRequestTemplate(data),
      deletionRequestPlainText(data),
    );
  }

  async sendDeletionCancelledEmail(data: DeletionCancelledEmailData): Promise<void> {
    await this.send(
      data.to,
      'Your My Tax Diary account deletion has been cancelled',
      deletionCancelledTemplate(data),
      deletionCancelledPlainText(data),
    );
  }

  // ── Private helpers ──────────────────────────────────────────────────────

  /**
   * Client-facing path: try agent mailbox first, then system SMTP.
   */
  private async sendClientFacing(
    to: string,
    subject: string,
    html: string,
    text: string,
    actingUserId?: string,
  ): Promise<ClientMailSendMeta> {
    if (actingUserId && this.emailConnectionsService) {
      const agent = await this.emailConnectionsService.sendAsAgent({
        userId: actingUserId,
        to,
        subject,
        html,
        text,
      });
      if (agent) {
        this.logger.log(
          `Email sent via agent mailbox → ${to} (${subject}) from ${agent.fromEmail}`,
        );
        return { via: 'agent', fromEmail: agent.fromEmail };
      }
    }

    await this.send(to, subject, html, text);
    return { via: 'system', fromEmail: this.fromEmail };
  }

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
