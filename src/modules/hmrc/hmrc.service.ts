import {
  Injectable,
  Logger,
  BadRequestException,
  InternalServerErrorException,
  NotFoundException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { HmrcConnection } from './entities/hmrc-connection.entity';
import { encrypt, decrypt, isEncrypted } from './crypto.util';

interface HmrcTokenResponse {
  access_token: string;
  token_type: string;
  expires_in: number;
  refresh_token: string;
  scope?: string;
}

@Injectable()
export class HmrcService {
  private readonly logger = new Logger(HmrcService.name);

  constructor(
    private readonly configService: ConfigService,
    @InjectRepository(HmrcConnection)
    private readonly connectionRepo: Repository<HmrcConnection>,
  ) {}

  // ─── Private helpers ──────────────────────────────────────────────────────

  private get encryptionKey(): string | undefined {
    return this.configService.get<string>('hmrc.encryptionKey');
  }

  private encryptToken(token: string): string {
    const key = this.encryptionKey;
    if (!key) return token; // no key configured — store plain (sandbox/dev only)
    return encrypt(token, key);
  }

  private decryptToken(stored: string): string {
    const key = this.encryptionKey;
    if (!key || !isEncrypted(stored)) return stored;
    return decrypt(stored, key);
  }

  // ─── Public methods ───────────────────────────────────────────────────────

  /** Returns the HMRC OAuth authorize URL for the agent to sign in. */
  getAuthUrl(): string {
    const authBaseUrl = this.configService.get<string>('hmrc.authBaseUrl');
    const clientId = this.configService.get<string>('hmrc.clientId');
    const redirectUri = this.configService.get<string>('hmrc.redirectUri');
    const scope = this.configService.get<string>('hmrc.scope');

    if (!clientId || !redirectUri) {
      throw new InternalServerErrorException(
        'HMRC OAuth is not configured. Set HMRC_CLIENT_ID and HMRC_REDIRECT_URI.',
      );
    }

    const params = new URLSearchParams({
      response_type: 'code',
      client_id: clientId,
      redirect_uri: redirectUri,
      scope: scope ?? '',
    });

    return `${authBaseUrl}/oauth/authorize?${params.toString()}`;
  }

  /** Exchanges an authorization code for tokens, encrypts them, and persists the connection. */
  async exchangeCode(tenantId: string, code: string): Promise<HmrcConnection> {
    const baseUrl = this.configService.get<string>('hmrc.baseUrl');
    const clientId = this.configService.get<string>('hmrc.clientId');
    const clientSecret = this.configService.get<string>('hmrc.clientSecret');
    const redirectUri = this.configService.get<string>('hmrc.redirectUri');

    if (!clientId || !clientSecret || !redirectUri) {
      throw new InternalServerErrorException('HMRC OAuth is not fully configured.');
    }

    const body = new URLSearchParams({
      client_id: clientId,
      client_secret: clientSecret,
      grant_type: 'authorization_code',
      redirect_uri: redirectUri,
      code,
    });

    let tokenData: HmrcTokenResponse;
    try {
      const response = await fetch(`${baseUrl}/oauth/token`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
        body: body.toString(),
      });

      if (!response.ok) {
        const errorText = await response.text();
        this.logger.error(`HMRC token exchange failed: ${response.status} ${errorText}`);
        throw new BadRequestException(`HMRC token exchange failed: ${errorText}`);
      }

      tokenData = (await response.json()) as HmrcTokenResponse;
    } catch (err) {
      if (err instanceof BadRequestException) throw err;
      this.logger.error('HMRC token exchange request error', err);
      throw new InternalServerErrorException('Failed to contact HMRC for token exchange.');
    }

    const now = new Date();
    const accessTokenExpiresAt = new Date(now.getTime() + tokenData.expires_in * 1000);

    const existing = await this.connectionRepo.findOne({ where: { tenantId } });
    const connection = existing ?? this.connectionRepo.create({ tenantId });

    // Encrypt tokens before persisting
    connection.accessToken = this.encryptToken(tokenData.access_token);
    connection.refreshToken = this.encryptToken(tokenData.refresh_token);
    connection.accessTokenExpiresAt = accessTokenExpiresAt;
    connection.connectedAt = now;
    connection.status = 'connected';
    connection.scope = tokenData.scope ?? undefined;

    await this.connectionRepo.save(connection);
    this.logger.log(`HMRC connection saved for tenant ${tenantId}`);

    return connection;
  }

  /** Returns current HMRC connection status for a tenant (null if never connected). */
  async getStatus(tenantId: string): Promise<HmrcConnection | null> {
    const connection = await this.connectionRepo.findOne({ where: { tenantId } });
    if (!connection) return null;

    // Auto-mark expired if access token expiry has passed
    if (connection.status === 'connected' && connection.accessTokenExpiresAt < new Date()) {
      connection.status = 'expired';
      await this.connectionRepo.save(connection);
    }

    return connection;
  }

  /**
   * Returns decrypted tokens for internal use (e.g. making HMRC API calls).
   * Never expose this to the frontend.
   */
  async getDecryptedTokens(tenantId: string): Promise<{ accessToken: string; refreshToken: string } | null> {
    const connection = await this.connectionRepo.findOne({ where: { tenantId } });
    if (!connection || connection.status !== 'connected') return null;
    return {
      accessToken: this.decryptToken(connection.accessToken),
      refreshToken: this.decryptToken(connection.refreshToken),
    };
  }

  /** Updates only the ARN for an existing HMRC connection. */
  async updateArn(tenantId: string, arn: string): Promise<HmrcConnection> {
    const connection = await this.connectionRepo.findOne({ where: { tenantId } });
    if (!connection) {
      throw new NotFoundException('No active HMRC connection found. Connect to HMRC first.');
    }
    connection.arn = arn;
    await this.connectionRepo.save(connection);
    this.logger.log(`ARN updated for tenant ${tenantId}: ${arn}`);
    return connection;
  }

  /** Removes the HMRC connection for a tenant (hard delete). */
  async disconnect(tenantId: string): Promise<void> {
    const connection = await this.connectionRepo.findOne({ where: { tenantId } });
    if (!connection) {
      throw new NotFoundException('No active HMRC connection found for this firm.');
    }
    await this.connectionRepo.delete({ tenantId });
    this.logger.log(`HMRC connection removed for tenant ${tenantId}`);
  }
}
