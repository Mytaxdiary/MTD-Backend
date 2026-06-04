import {
  Injectable,
  Logger,
  BadRequestException,
  InternalServerErrorException,
  NotFoundException,
  UnauthorizedException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { HmrcConnection } from './entities/hmrc-connection.entity';
import { encrypt, decrypt, isEncrypted } from './crypto.util';
import { HmrcApiClient } from './hmrc-api.client';
import type {
  FraudPreventionValidationResult,
  HmrcFraudRequestContext,
} from './fraud-prevention.types';
import type {
  HmrcSandboxAgentUser,
  HmrcSandboxIndividualRaw,
  HmrcSandboxIndividualUser,
  SandboxTestUsersResult,
} from './hmrc-sandbox.types';

interface HmrcTokenResponse {
  access_token: string;
  token_type: string;
  expires_in: number;
  refresh_token: string;
  /** Some HMRC responses include refresh token expiry (seconds). */
  refresh_token_expires_in?: number;
  scope?: string;
}

/** Refresh access token if it expires within this many ms (buffer). */
const REFRESH_BUFFER_MS = 60_000;

@Injectable()
export class HmrcService {
  private readonly logger = new Logger(HmrcService.name);

  constructor(
    private readonly configService: ConfigService,
    @InjectRepository(HmrcConnection)
    private readonly connectionRepo: Repository<HmrcConnection>,
    private readonly hmrcApiClient: HmrcApiClient,
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
    const tokenData = await this.requestTokens({
      grant_type: 'authorization_code',
      code,
      redirect_uri: this.configService.get<string>('hmrc.redirectUri') ?? '',
    });

    const existing = await this.connectionRepo.findOne({ where: { tenantId } });
    const connection = existing ?? this.connectionRepo.create({ tenantId });

    this.applyTokenResponse(connection, tokenData, { setConnectedAt: true });
    await this.connectionRepo.save(connection);
    this.logger.log(`HMRC connection saved for tenant ${tenantId}`);

    return connection;
  }

  /**
   * Refreshes HMRC tokens using the stored refresh token.
   * Throws UnauthorizedException when the refresh token itself is invalid/expired —
   * caller should prompt the user to reconnect.
   */
  async refreshHmrcTokens(tenantId: string): Promise<HmrcConnection> {
    const connection = await this.connectionRepo.findOne({ where: { tenantId } });
    if (!connection) {
      throw new NotFoundException('No HMRC connection found. Connect to HMRC first.');
    }

    const refreshToken = this.decryptToken(connection.refreshToken);

    let tokenData: HmrcTokenResponse;
    try {
      tokenData = await this.requestTokens({
        grant_type: 'refresh_token',
        refresh_token: refreshToken,
      });
    } catch (err) {
      // Refresh token rejected (400/401) → connection is unusable, mark expired
      if (err instanceof BadRequestException || err instanceof UnauthorizedException) {
        connection.status = 'expired';
        await this.connectionRepo.save(connection);
        throw new UnauthorizedException(
          'HMRC refresh token is invalid or has expired. Please reconnect HMRC in Settings.',
        );
      }
      throw err;
    }

    this.applyTokenResponse(connection, tokenData, { setConnectedAt: false });
    await this.connectionRepo.save(connection);
    this.logger.log(`HMRC tokens refreshed for tenant ${tenantId}`);

    return connection;
  }

  /**
   * Returns a valid access token, refreshing on the fly if expired or expiring soon.
   * Use this for every outbound HMRC API call instead of reading tokens directly.
   */
  async getValidAccessToken(tenantId: string): Promise<string> {
    const connection = await this.connectionRepo.findOne({ where: { tenantId } });
    if (!connection) {
      throw new BadRequestException(
        'Your firm is not connected to HMRC. Go to Settings → HMRC Connection to connect first.',
      );
    }

    const expiresAt = connection.accessTokenExpiresAt?.getTime() ?? 0;
    const needsRefresh = expiresAt - Date.now() < REFRESH_BUFFER_MS || connection.status !== 'connected';

    if (!needsRefresh) {
      return this.decryptToken(connection.accessToken);
    }

    const refreshed = await this.refreshHmrcTokens(tenantId);
    return this.decryptToken(refreshed.accessToken);
  }

  /** Returns current HMRC connection status for a tenant (null if never connected). */
  async getStatus(tenantId: string): Promise<HmrcConnection | null> {
    const connection = await this.connectionRepo.findOne({ where: { tenantId } });
    if (!connection) return null;

    // Mark expired only when both tokens are unusable; access expiry alone is auto-refreshed
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

    return connection;
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

  /**
   * Calls HMRC test validator with Gov-* fraud prevention headers.
   * https://developer.service.hmrc.gov.uk/api-documentation/docs/api/service/txm-fph-validator-api/1.0
   */
  async validateFraudHeaders(
    tenantId: string,
    fraudContext: HmrcFraudRequestContext,
  ): Promise<FraudPreventionValidationResult> {
    const baseUrl = this.configService.get<string>('hmrc.baseUrl');
    if (!baseUrl) {
      throw new InternalServerErrorException('HMRC_BASE_URL is not configured.');
    }

    const accessToken = await this.getValidAccessToken(tenantId);

    let response: Response;
    try {
      response = await this.hmrcApiClient.fetch(
        `${baseUrl}/test/fraud-prevention-headers/validate`,
        {
          method: 'GET',
          accessToken,
          fraudContext,
          headers: { Accept: 'application/vnd.hmrc.1.0+json' },
        },
      );
    } catch (err) {
      this.logger.error('HMRC fraud header validation network error', err);
      throw new InternalServerErrorException('Failed to contact HMRC fraud header validator.');
    }

    const text = await response.text();
    let body: FraudPreventionValidationResult;
    try {
      body = text ? (JSON.parse(text) as FraudPreventionValidationResult) : {};
    } catch {
      throw new InternalServerErrorException(
        `HMRC fraud validator returned non-JSON (${response.status}).`,
      );
    }

    if (!response.ok) {
      this.logger.warn(`HMRC fraud validator HTTP ${response.status}: ${text}`);
      throw new BadRequestException(
        body.message ?? `HMRC fraud header validation failed (${response.status}).`,
      );
    }

    return body;
  }

  async createSandboxTestUsers(): Promise<SandboxTestUsersResult> {
    this.assertSandboxEnvironment();

    const tokenData = await this.requestTokens({ grant_type: 'client_credentials' });
    const accessToken = tokenData.access_token;

    const agent = await this.createSandboxTestUser<HmrcSandboxAgentUser>(
      '/create-test-user/agents',
      accessToken,
      { serviceNames: ['agent-services'] },
    );

    const individualRaw = await this.createSandboxTestUser<HmrcSandboxIndividualRaw>(
      '/create-test-user/individuals',
      accessToken,
      { serviceNames: ['national-insurance', 'mtd-income-tax'] },
    );
    const individual = this.normalizeSandboxIndividual(individualRaw);

    return {
      agent,
      individual,
      nextSteps: [
        `Connect HMRC below using the agent User ID (${agent.userId}) and password.`,
        `After connecting, save ARN ${agent.agentServicesAccountNumber} in the ARN field.`,
        `Add a client with NINO ${individual.nino} and postcode ${individual.postcode}.`,
        'Send an HMRC invitation from the client record, then accept it under Sandbox invitations.',
      ],
    };
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

  // ─── Token request helpers ────────────────────────────────────────────────

  /** HMRC nests postcode under individualDetails.address — lift it for the app. */
  private normalizeSandboxIndividual(
    raw: HmrcSandboxIndividualRaw,
  ): HmrcSandboxIndividualUser {
    const postcode =
      raw.postcode?.trim() ||
      raw.individualDetails?.address?.postcode?.trim() ||
      '';

    if (!raw.nino?.trim()) {
      throw new BadRequestException('HMRC individual test user response is missing NINO.');
    }
    if (!postcode) {
      throw new BadRequestException(
        'HMRC individual test user response is missing postcode (expected under individualDetails.address).',
      );
    }

    return { ...raw, postcode };
  }

  private assertSandboxEnvironment(): void {
    const baseUrl = this.configService.get<string>('hmrc.baseUrl') ?? '';
    if (!baseUrl.includes('test-api')) {
      throw new BadRequestException(
        'Sandbox test users can only be created when HMRC_BASE_URL points to the HMRC sandbox (test-api.service.hmrc.gov.uk).',
      );
    }
  }

  private async createSandboxTestUser<T>(
    path: string,
    bearerToken: string,
    body: { serviceNames: string[] },
  ): Promise<T> {
    const baseUrl = this.configService.get<string>('hmrc.baseUrl');
    if (!baseUrl) {
      throw new InternalServerErrorException('HMRC_BASE_URL is not configured.');
    }

    let response: Response;
    try {
      response = await fetch(`${baseUrl}${path}`, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${bearerToken}`,
          'Content-Type': 'application/json',
          Accept: 'application/json',
        },
        body: JSON.stringify(body),
      });
    } catch (err) {
      this.logger.error(`HMRC create-test-user network error (${path})`, err);
      throw new InternalServerErrorException('Failed to contact HMRC to create a sandbox test user.');
    }

    if (!response.ok) {
      const errorText = await response.text();
      this.logger.error(`HMRC create-test-user failed (${path}): ${response.status} ${errorText}`);
      throw new BadRequestException(
        `HMRC could not create sandbox test user (${response.status}): ${errorText}`,
      );
    }

    return (await response.json()) as T;
  }

  /**
   * Calls HMRC POST /oauth/token. Used for both `authorization_code` (initial exchange)
   * and `refresh_token` grants — same endpoint, different body.
   */
  private async requestTokens(
    extraParams: Record<string, string>,
  ): Promise<HmrcTokenResponse> {
    const baseUrl = this.configService.get<string>('hmrc.baseUrl');
    const clientId = this.configService.get<string>('hmrc.clientId');
    const clientSecret = this.configService.get<string>('hmrc.clientSecret');

    if (!baseUrl || !clientId || !clientSecret) {
      throw new InternalServerErrorException('HMRC OAuth is not fully configured.');
    }

    const body = new URLSearchParams({
      client_id: clientId,
      client_secret: clientSecret,
      ...extraParams,
    });

    let response: Response;
    try {
      response = await fetch(`${baseUrl}/oauth/token`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
        body: body.toString(),
      });
    } catch (err) {
      this.logger.error('HMRC token request network error', err);
      throw new InternalServerErrorException('Failed to contact HMRC for token request.');
    }

    if (!response.ok) {
      const errorText = await response.text();
      this.logger.error(
        `HMRC token request failed (${extraParams.grant_type}): ${response.status} ${errorText}`,
      );
      // 400/401 typically mean the supplied code/refresh token is invalid
      if (response.status === 400 || response.status === 401) {
        throw new BadRequestException(`HMRC rejected the token request: ${errorText}`);
      }
      throw new InternalServerErrorException(
        `HMRC token endpoint returned ${response.status}.`,
      );
    }

    return (await response.json()) as HmrcTokenResponse;
  }

  /** Mutates the connection entity in place with the latest token response. */
  private applyTokenResponse(
    connection: HmrcConnection,
    tokenData: HmrcTokenResponse,
    opts: { setConnectedAt: boolean },
  ): void {
    const now = new Date();

    connection.accessToken = this.encryptToken(tokenData.access_token);
    connection.refreshToken = this.encryptToken(tokenData.refresh_token);
    connection.accessTokenExpiresAt = new Date(now.getTime() + tokenData.expires_in * 1000);

    if (tokenData.refresh_token_expires_in) {
      connection.refreshTokenExpiresAt = new Date(
        now.getTime() + tokenData.refresh_token_expires_in * 1000,
      );
    }

    if (tokenData.scope) connection.scope = tokenData.scope;
    if (opts.setConnectedAt) connection.connectedAt = now;
    connection.status = 'connected';
  }
}
