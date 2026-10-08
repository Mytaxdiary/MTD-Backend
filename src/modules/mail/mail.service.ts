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
  portalClientReplyTemplate,
  portalClientReplyPlainText,
  type PortalClientReplyEmailData,
} from './templates/portal-client-reply.template';
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
import { staffInviteTemplate, staffInvitePlainText } from './templates/staff-invite.template';
import {
  enquiryAlertTemplate,
  enquiryAlertPlainText,
  type EnquiryAlertEmailData,
} from './templates/enquiry-alert.template';
import {
  trialEndingTemplate,
  trialEndingPlainText,
  type TrialEndingEmailData,
} from './templates/trial-ending.template';
import {
  trialExpiredTemplate,
  trialExpiredPlainText,
  type TrialExpiredEmailData,
} from './templates/trial-expired.template';
import {
  paymentFailedTemplate,
  paymentFailedPlainText,
  type PaymentFailedEmailData,
} from './templates/payment-failed.template';
import {
  paymentSucceededTemplate,
  paymentSucceededPlainText,
  type PaymentSucceededEmailData,
} from './templates/payment-succeeded.template';
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
  private readonly pricingUrl: string;
  private readonly billingUrl: string;
  private readonly contactUrl: string;

  constructor(
    private readonly configService: ConfigService,
    @Optional() private readonly emailConnectionsService?: EmailConnectionsService,
  ) {
    const host = configService.get<string>('mail.host');
    const fromEmail = configService.get<string>('mail.from') ?? 'noreply@mtditsa.co.uk';
    const fromName = configService.get<string>('mail.fromName') ?? 'My Tax Diary';
    const frontendUrl = (
      configService.get<string>('app.frontendUrl') ?? 'http://localhost:3000'
    ).replace(/\/$/, '');

    this.fromEmail = fromEmail;
    this.from = `"${fromName}" <${fromEmail}>`;
    this.loginUrl = `${frontendUrl}/login`;
    this.pricingUrl = `${frontendUrl}/site/pricing`;
    this.billingUrl = `${frontendUrl}/settings?section=billing`;
    this.contactUrl = `${frontendUrl}/site/contact`;

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

  /**
   * Trial started + welcome (sent on register). Includes trial end date when provided.
   */
  async sendWelcomeEmail(
    to: string,
    firstName: string,
    options?: { trialEndsAt?: Date | string },
  ): Promise<void> {
    const trialPlain = options?.trialEndsAt
      ? `\n\nYour free trial runs until ${new Date(options.trialEndsAt).toLocaleDateString(
          'en-GB',
          {
            day: 'numeric',
            month: 'long',
            year: 'numeric',
          },
        )}. No card is required to get started.`
      : '';
    const subject = options?.trialEndsAt
      ? 'Welcome to My Tax Diary: your free trial has started'
      : 'Welcome to My Tax Diary';
    await this.send(
      to,
      subject,
      welcomeTemplate(firstName, this.loginUrl, options),
      `Hi ${firstName},\n\nYour My Tax Diary account is ready. Sign in at:\n${this.loginUrl}${trialPlain}\n\nThe My Tax Diary team`,
    );
  }

  /** Day −2 soft reminder — always sent to the firm owner (billing-critical). */
  async sendTrialEndingEmail(
    to: string,
    data: Omit<TrialEndingEmailData, 'pricingUrl' | 'billingUrl'> & {
      pricingUrl?: string;
      billingUrl?: string;
    },
  ): Promise<void> {
    const payload: TrialEndingEmailData = {
      ...data,
      pricingUrl: data.pricingUrl ?? this.pricingUrl,
      billingUrl: data.billingUrl ?? this.billingUrl,
    };
    await this.send(
      to,
      'Your My Tax Diary free trial ends in 2 days',
      trialEndingTemplate(payload),
      trialEndingPlainText(payload),
    );
  }

  /** Sent once when the trial window ends without a paid subscription. */
  async sendTrialExpiredEmail(
    to: string,
    data: Omit<TrialExpiredEmailData, 'pricingUrl' | 'contactUrl'> & {
      pricingUrl?: string;
      contactUrl?: string;
    },
  ): Promise<void> {
    const payload: TrialExpiredEmailData = {
      ...data,
      pricingUrl: data.pricingUrl ?? this.pricingUrl,
      contactUrl: data.contactUrl ?? this.contactUrl,
    };
    await this.send(
      to,
      'Your My Tax Diary free trial has ended',
      trialExpiredTemplate(payload),
      trialExpiredPlainText(payload),
    );
  }

  /** Stripe webhook: invoice.payment_failed — always to owner. */
  async sendPaymentFailedEmail(
    to: string,
    data: Omit<PaymentFailedEmailData, 'billingUrl'> & { billingUrl?: string },
  ): Promise<void> {
    const payload: PaymentFailedEmailData = {
      ...data,
      billingUrl: data.billingUrl ?? this.billingUrl,
    };
    await this.send(
      to,
      'Payment failed for your My Tax Diary subscription',
      paymentFailedTemplate(payload),
      paymentFailedPlainText(payload),
    );
  }

  /** Stripe webhook: invoice.paid — always to owner. */
  async sendPaymentSucceededEmail(
    to: string,
    data: Omit<PaymentSucceededEmailData, 'billingUrl'> & { billingUrl?: string },
  ): Promise<void> {
    const payload: PaymentSucceededEmailData = {
      ...data,
      billingUrl: data.billingUrl ?? this.billingUrl,
    };
    await this.send(
      to,
      'Payment received: My Tax Diary subscription active',
      paymentSucceededTemplate(payload),
      paymentSucceededPlainText(payload),
    );
  }

  async sendEnquiryAlertEmail(to: string, data: EnquiryAlertEmailData): Promise<void> {
    await this.send(
      to,
      `New enquiry from ${data.firm}`,
      enquiryAlertTemplate(data),
      enquiryAlertPlainText(data),
    );
  }

  async sendStaffInviteEmail(
    to: string,
    opts: { firstName: string; firmName: string; inviteUrl: string },
  ): Promise<void> {
    await this.send(
      to,
      `You are invited to join ${opts.firmName} on My Tax Diary`,
      staffInviteTemplate(opts),
      staffInvitePlainText(opts),
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

  async sendPortalClientReply(to: string, data: PortalClientReplyEmailData): Promise<void> {
    await this.send(
      to,
      `Portal message from ${data.clientName}: ${data.subject}`,
      portalClientReplyTemplate(data),
      portalClientReplyPlainText(data),
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
