import {
  BadRequestException,
  Injectable,
  InternalServerErrorException,
  Logger,
  NotFoundException,
  UnauthorizedException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { InjectRepository } from '@nestjs/typeorm';
import { IsNull, Repository } from 'typeorm';
import { encrypt, decrypt, isEncrypted } from '../hmrc/crypto.util';
import { User } from '../users/entities/user.entity';
import {
  EmailConnection,
  type EmailConnectionStatus,
  type EmailProvider,
} from './entities/email-connection.entity';

interface OAuthTokenResponse {
  access_token: string;
  refresh_token?: string;
  expires_in: number;
  scope?: string;
  token_type?: string;
  ext_expires_in?: number;
}

export type EmailStatusDto = {
  connected: boolean;
  provider?: EmailProvider;
  emailAddress?: string;
  status?: EmailConnectionStatus;
  connectedAt?: string;
  accessTokenExpiresAt?: string;
};

export type AgentSendResult = {
  sent: boolean;
  fromEmail: string;
  via: 'agent' | 'system';
};

const REFRESH_BUFFER_MS = 5 * 60_000;

@Injectable()
export class EmailConnectionsService {
  private readonly logger = new Logger(EmailConnectionsService.name);

  constructor(
    private readonly configService: ConfigService,
    @InjectRepository(EmailConnection)
    private readonly connectionRepo: Repository<EmailConnection>,
    @InjectRepository(User)
    private readonly userRepo: Repository<User>,
  ) {}

  private get encryptionKey(): string | undefined {
    return this.configService.get<string>('emailOAuth.encryptionKey');
  }

  private encryptToken(token: string): string {
    const key = this.encryptionKey;
    if (!key) return token;
    return encrypt(token, key);
  }

  private decryptToken(stored: string): string {
    const key = this.encryptionKey;
    if (!key || !isEncrypted(stored)) return stored;
    return decrypt(stored, key);
  }

  /** Build provider authorize URL for the logged-in agent. */
  getAuthUrl(provider: EmailProvider): string {
    if (provider === 'gmail') {
      const clientId = this.configService.get<string>('emailOAuth.google.clientId');
      const redirectUri = this.configService.get<string>('emailOAuth.google.redirectUri');
      const scope = this.configService.get<string>('emailOAuth.google.scope') ?? '';
      if (!clientId || !redirectUri) {
        throw new InternalServerErrorException(
          'Gmail OAuth is not configured. Set GOOGLE_CLIENT_ID and GOOGLE_REDIRECT_URI.',
        );
      }
      const params = new URLSearchParams({
        response_type: 'code',
        client_id: clientId,
        redirect_uri: redirectUri,
        scope,
        access_type: 'offline',
        prompt: 'consent',
        include_granted_scopes: 'true',
      });
      return `https://accounts.google.com/o/oauth2/v2/auth?${params.toString()}`;
    }

    const clientId = this.configService.get<string>('emailOAuth.microsoft.clientId');
    const redirectUri = this.configService.get<string>('emailOAuth.microsoft.redirectUri');
    const scope = this.configService.get<string>('emailOAuth.microsoft.scope') ?? '';
    const tenant = this.configService.get<string>('emailOAuth.microsoft.tenant') ?? 'common';
    if (!clientId || !redirectUri) {
      throw new InternalServerErrorException(
        'Outlook OAuth is not configured. Set MICROSOFT_CLIENT_ID and MICROSOFT_REDIRECT_URI.',
      );
    }
    const params = new URLSearchParams({
      response_type: 'code',
      client_id: clientId,
      redirect_uri: redirectUri,
      scope,
      response_mode: 'query',
    });
    return `https://login.microsoftonline.com/${tenant}/oauth2/v2.0/authorize?${params.toString()}`;
  }

  async exchangeCode(
    userId: string,
    tenantId: string,
    provider: EmailProvider,
    code: string,
  ): Promise<EmailConnection> {
    const tokenData = await this.requestTokens(provider, {
      grant_type: 'authorization_code',
      code,
      redirect_uri: this.redirectUri(provider),
    });

    if (!tokenData.refresh_token) {
      throw new BadRequestException(
        'Provider did not return a refresh token. Disconnect any prior consent and try again with full consent.',
      );
    }

    const accessToken = tokenData.access_token;
    const emailAddress = await this.fetchMailboxEmail(provider, accessToken);

    const existing = await this.connectionRepo.findOne({
      where: { userId, deletedAt: IsNull() },
    });
    const connection = existing ?? this.connectionRepo.create({ userId, tenantId });
    connection.tenantId = tenantId;
    connection.provider = provider;
    connection.emailAddress = emailAddress;
    this.applyTokenResponse(connection, tokenData, { setConnectedAt: true });
    await this.connectionRepo.save(connection);
    this.logger.log(`Email connection (${provider}) saved for user ${userId}`);
    return connection;
  }

  async refreshTokens(userId: string): Promise<EmailConnection> {
    const connection = await this.connectionRepo.findOne({
      where: { userId, deletedAt: IsNull() },
    });
    if (!connection) {
      throw new NotFoundException('No email connection found. Connect Gmail or Outlook first.');
    }

    const refreshToken = this.decryptToken(connection.refreshToken);
    let tokenData: OAuthTokenResponse;
    try {
      tokenData = await this.requestTokens(connection.provider, {
        grant_type: 'refresh_token',
        refresh_token: refreshToken,
      });
    } catch (err) {
      if (err instanceof BadRequestException || err instanceof UnauthorizedException) {
        connection.status = 'expired';
        await this.connectionRepo.save(connection);
        throw new UnauthorizedException(
          'Email refresh token is invalid or expired. Please reconnect your email in Settings.',
        );
      }
      throw err;
    }

    this.applyTokenResponse(connection, tokenData, { setConnectedAt: false });
    await this.connectionRepo.save(connection);
    this.logger.log(`Email tokens refreshed for user ${userId}`);
    return connection;
  }

  async getValidAccessToken(userId: string): Promise<{
    accessToken: string;
    connection: EmailConnection;
  } | null> {
    const connection = await this.connectionRepo.findOne({
      where: { userId, deletedAt: IsNull() },
    });
    if (!connection || connection.status === 'disconnected') return null;

    const expiresAt = connection.accessTokenExpiresAt?.getTime() ?? 0;
    const needsRefresh =
      expiresAt - Date.now() < REFRESH_BUFFER_MS || connection.status !== 'connected';

    if (!needsRefresh) {
      return { accessToken: this.decryptToken(connection.accessToken), connection };
    }

    try {
      const refreshed = await this.refreshTokens(userId);
      return { accessToken: this.decryptToken(refreshed.accessToken), connection: refreshed };
    } catch (err) {
      this.logger.warn(`Email token refresh failed for ${userId}: ${String(err)}`);
      return null;
    }
  }

  async getStatus(userId: string): Promise<EmailStatusDto> {
    const connection = await this.connectionRepo.findOne({
      where: { userId, deletedAt: IsNull() },
    });
    if (!connection || connection.status === 'disconnected') {
      return { connected: false };
    }

    const accessExpired = connection.accessTokenExpiresAt
      ? connection.accessTokenExpiresAt < new Date()
      : true;
    const refreshExpired = connection.refreshTokenExpiresAt
      ? connection.refreshTokenExpiresAt < new Date()
      : false;

    if (connection.status === 'connected' && accessExpired && refreshExpired) {
      connection.status = 'expired';
      await this.connectionRepo.save(connection);
    }

    return {
      connected: connection.status === 'connected',
      provider: connection.provider,
      emailAddress: connection.emailAddress,
      status: connection.status,
      connectedAt: connection.connectedAt?.toISOString(),
      accessTokenExpiresAt: connection.accessTokenExpiresAt?.toISOString(),
    };
  }

  async disconnect(userId: string): Promise<void> {
    const connection = await this.connectionRepo.findOne({
      where: { userId, deletedAt: IsNull() },
    });
    if (!connection) return;
    await this.connectionRepo.softRemove(connection);
    this.logger.log(`Email connection disconnected for user ${userId}`);
  }

  /**
   * Send via the agent's connected mailbox.
   * Returns null when no usable connection (caller should fall back to SMTP).
   */
  async sendAsAgent(opts: {
    userId: string;
    to: string;
    subject: string;
    html: string;
    text: string;
  }): Promise<{ fromEmail: string; fromName: string } | null> {
    const tokenBundle = await this.getValidAccessToken(opts.userId);
    if (!tokenBundle) return null;

    const { accessToken, connection } = tokenBundle;
    const user = await this.userRepo.findOne({ where: { id: opts.userId } });
    const fromName = user
      ? `${user.firstName} ${user.lastName}`.trim() || connection.emailAddress
      : connection.emailAddress;

    try {
      if (connection.provider === 'gmail') {
        await this.sendViaGmail(accessToken, {
          fromEmail: connection.emailAddress,
          fromName,
          to: opts.to,
          subject: opts.subject,
          html: opts.html,
          text: opts.text,
        });
      } else {
        await this.sendViaOutlook(accessToken, {
          to: opts.to,
          subject: opts.subject,
          html: opts.html,
          text: opts.text,
        });
      }
      return { fromEmail: connection.emailAddress, fromName };
    } catch (err) {
      this.logger.error(
        `Agent mailbox send failed (${connection.provider}) for user ${opts.userId}`,
        err,
      );
      return null;
    }
  }

  // ── Private OAuth / send helpers ───────────────────────────────────────────

  private redirectUri(provider: EmailProvider): string {
    return provider === 'gmail'
      ? (this.configService.get<string>('emailOAuth.google.redirectUri') ?? '')
      : (this.configService.get<string>('emailOAuth.microsoft.redirectUri') ?? '');
  }

  private applyTokenResponse(
    connection: EmailConnection,
    tokenData: OAuthTokenResponse,
    opts: { setConnectedAt: boolean },
  ): void {
    connection.accessToken = this.encryptToken(tokenData.access_token);
    if (tokenData.refresh_token) {
      connection.refreshToken = this.encryptToken(tokenData.refresh_token);
    }
    connection.accessTokenExpiresAt = new Date(Date.now() + tokenData.expires_in * 1000);
    if (tokenData.ext_expires_in) {
      connection.refreshTokenExpiresAt = new Date(Date.now() + tokenData.ext_expires_in * 1000);
    }
    connection.scope = tokenData.scope ?? connection.scope ?? null;
    connection.status = 'connected';
    if (opts.setConnectedAt) connection.connectedAt = new Date();
  }

  private async requestTokens(
    provider: EmailProvider,
    body: Record<string, string>,
  ): Promise<OAuthTokenResponse> {
    if (provider === 'gmail') {
      const clientId = this.configService.get<string>('emailOAuth.google.clientId') ?? '';
      const clientSecret = this.configService.get<string>('emailOAuth.google.clientSecret') ?? '';
      const params = new URLSearchParams({
        ...body,
        client_id: clientId,
        client_secret: clientSecret,
      });
      const res = await fetch('https://oauth2.googleapis.com/token', {
        method: 'POST',
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
        body: params.toString(),
      });
      const text = await res.text();
      if (!res.ok) {
        this.logger.warn(`Google token error ${res.status}: ${text}`);
        if (res.status === 400 || res.status === 401) {
          throw new BadRequestException('Failed to exchange Google authorization code.');
        }
        throw new InternalServerErrorException('Google token endpoint error.');
      }
      return JSON.parse(text) as OAuthTokenResponse;
    }

    const clientId = this.configService.get<string>('emailOAuth.microsoft.clientId') ?? '';
    const clientSecret = this.configService.get<string>('emailOAuth.microsoft.clientSecret') ?? '';
    const tenant = this.configService.get<string>('emailOAuth.microsoft.tenant') ?? 'common';
    const scope = this.configService.get<string>('emailOAuth.microsoft.scope') ?? '';
    const params = new URLSearchParams({
      ...body,
      client_id: clientId,
      client_secret: clientSecret,
      scope,
    });
    const res = await fetch(`https://login.microsoftonline.com/${tenant}/oauth2/v2.0/token`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: params.toString(),
    });
    const text = await res.text();
    if (!res.ok) {
      this.logger.warn(`Microsoft token error ${res.status}: ${text}`);
      if (res.status === 400 || res.status === 401) {
        throw new BadRequestException('Failed to exchange Microsoft authorization code.');
      }
      throw new InternalServerErrorException('Microsoft token endpoint error.');
    }
    return JSON.parse(text) as OAuthTokenResponse;
  }

  private async fetchMailboxEmail(provider: EmailProvider, accessToken: string): Promise<string> {
    if (provider === 'gmail') {
      const res = await fetch('https://www.googleapis.com/oauth2/v2/userinfo', {
        headers: { Authorization: `Bearer ${accessToken}` },
      });
      const data = (await res.json()) as { email?: string };
      if (!res.ok || !data.email) {
        throw new BadRequestException('Could not read Gmail address from Google profile.');
      }
      return data.email;
    }

    const res = await fetch('https://graph.microsoft.com/v1.0/me', {
      headers: { Authorization: `Bearer ${accessToken}` },
    });
    const data = (await res.json()) as { mail?: string; userPrincipalName?: string };
    const email = data.mail || data.userPrincipalName;
    if (!res.ok || !email) {
      throw new BadRequestException('Could not read Outlook address from Microsoft Graph.');
    }
    return email;
  }

  private async sendViaGmail(
    accessToken: string,
    msg: {
      fromEmail: string;
      fromName: string;
      to: string;
      subject: string;
      html: string;
      text: string;
    },
  ): Promise<void> {
    const boundary = `mtd_${Date.now()}`;
    const raw = [
      `From: "${msg.fromName.replace(/"/g, '')}" <${msg.fromEmail}>`,
      `To: ${msg.to}`,
      `Subject: ${msg.subject}`,
      'MIME-Version: 1.0',
      `Content-Type: multipart/alternative; boundary="${boundary}"`,
      '',
      `--${boundary}`,
      'Content-Type: text/plain; charset="UTF-8"',
      '',
      msg.text,
      `--${boundary}`,
      'Content-Type: text/html; charset="UTF-8"',
      '',
      msg.html,
      `--${boundary}--`,
    ].join('\r\n');

    const encoded = Buffer.from(raw)
      .toString('base64')
      .replace(/\+/g, '-')
      .replace(/\//g, '_')
      .replace(/=+$/, '');

    const res = await fetch('https://gmail.googleapis.com/gmail/v1/users/me/messages/send', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${accessToken}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ raw: encoded }),
    });
    if (!res.ok) {
      const text = await res.text();
      throw new Error(`Gmail send failed ${res.status}: ${text}`);
    }
  }

  private async sendViaOutlook(
    accessToken: string,
    msg: { to: string; subject: string; html: string; text: string },
  ): Promise<void> {
    const res = await fetch('https://graph.microsoft.com/v1.0/me/sendMail', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${accessToken}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        message: {
          subject: msg.subject,
          body: { contentType: 'HTML', content: msg.html },
          toRecipients: [{ emailAddress: { address: msg.to } }],
        },
        saveToSentItems: true,
      }),
    });
    if (!res.ok) {
      const text = await res.text();
      throw new Error(`Outlook sendMail failed ${res.status}: ${text}`);
    }
  }
}
