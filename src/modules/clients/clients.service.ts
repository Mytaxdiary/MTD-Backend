import {
  Injectable,
  Logger,
  BadRequestException,
  ConflictException,
  NotFoundException,
  InternalServerErrorException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { InjectRepository } from '@nestjs/typeorm';
import { QueryFailedError, Repository } from 'typeorm';
import { Client } from './entities/client.entity';
import { CreateClientDto } from './dto/create-client.dto';
import { HmrcService } from '../hmrc/hmrc.service';
import { MailService } from '../mail/mail.service';
import { Tenant } from '../tenants/entities/tenant.entity';
import { invitationErrorToUserMessage } from './hmrc-invitation-errors.util';
import type { CreateClientResult } from './dto/create-client-result.dto';

/** Thrown when HMRC invitation API fails — carries status + body for user-message mapping. */
class HmrcInvitationFailedError extends Error {
  constructor(
    readonly httpStatus: number,
    readonly responseText: string,
  ) {
    super(`HMRC invitation API returned ${httpStatus}`);
    this.name = 'HmrcInvitationFailedError';
  }
}

@Injectable()
export class ClientsService {
  private readonly logger = new Logger(ClientsService.name);

  constructor(
    @InjectRepository(Client)
    private readonly clientRepo: Repository<Client>,
    @InjectRepository(Tenant)
    private readonly tenantRepo: Repository<Tenant>,
    private readonly configService: ConfigService,
    private readonly hmrcService: HmrcService,
    private readonly mailService: MailService,
  ) {}

  /** HMRC API base URL — from HMRC_BASE_URL in .env (same as HmrcService). */
  private get hmrcBaseUrl(): string {
    return this.configService.get<string>('hmrc.baseUrl')!;
  }

  async create(tenantId: string, agentEmail: string, dto: CreateClientDto): Promise<CreateClientResult> {
    // 1. Check HMRC connection and ARN
    const connection = await this.hmrcService.getStatus(tenantId);
    if (!connection || connection.status !== 'connected') {
      throw new BadRequestException(
        'Your firm is not connected to HMRC. Go to Settings > HMRC Connection to connect first.',
      );
    }
    if (!connection.arn) {
      throw new BadRequestException(
        'Agent Reference Number (ARN) is not set. Go to Settings > HMRC Connection and enter your ARN.',
      );
    }

    const tokens = await this.hmrcService.getDecryptedTokens(tenantId);
    if (!tokens) {
      throw new InternalServerErrorException('Unable to retrieve HMRC tokens.');
    }

    // 2. Get tenant info for email
    const tenant = await this.tenantRepo.findOne({ where: { id: tenantId } });
    const firmName = tenant?.firmName ?? 'Your accountancy firm';
    const agentName = tenant?.contactName ?? agentEmail;

    const ninoClean = dto.nino.replace(/\s/g, '').toUpperCase();

    // 3. Reject duplicate — one client per NINO per firm
    const existing = await this.findByNino(tenantId, ninoClean);
    if (existing) {
      const hint = existing.invitationId
        ? 'An HMRC invitation is already outstanding for this client.'
        : 'The HMRC invitation was never sent. Use Resend invitation to try again.';
      throw new ConflictException(
        `A client with National Insurance number ${ninoClean} already exists. ${hint}`,
      );
    }

    const client = this.clientRepo.create({
      tenantId,
      name: dto.name,
      nino: ninoClean,
      postcode: dto.postcode.trim().toUpperCase(),
      email: dto.email,
      phone: dto.phone,
      agentType: dto.agentType ?? 'main',
      invitationStatus: 'pending',
    });

    try {
      await this.clientRepo.save(client);
    } catch (err) {
      if (this.isDuplicateNinoError(err)) {
        throw new ConflictException(
          `A client with National Insurance number ${ninoClean} already exists. Use Resend invitation from the client list or Add Client panel.`,
        );
      }
      throw err;
    }

    return this.sendHmrcInvitationForClient({
      client,
      arn: connection.arn,
      accessToken: tokens.accessToken,
      agentName,
      firmName,
      personalMessage: dto.personalMessage,
    });
  }

  /** Resend HMRC invitation for an existing client (e.g. after ARN fix or failed first attempt). */
  async resendInvitation(
    tenantId: string,
    clientId: string,
    agentEmail: string,
    personalMessage?: string,
  ): Promise<CreateClientResult> {
    const client = await this.findOne(tenantId, clientId);

    if (client.invitationStatus === 'accepted') {
      throw new BadRequestException('This client has already accepted the HMRC invitation.');
    }

    const connection = await this.hmrcService.getStatus(tenantId);
    if (!connection || connection.status !== 'connected') {
      throw new BadRequestException(
        'Your firm is not connected to HMRC. Go to Settings > HMRC Connection to connect first.',
      );
    }
    if (!connection.arn) {
      throw new BadRequestException(
        'Agent Reference Number (ARN) is not set. Go to Settings > HMRC Connection and enter your ARN.',
      );
    }

    const tokens = await this.hmrcService.getDecryptedTokens(tenantId);
    if (!tokens) {
      throw new InternalServerErrorException('Unable to retrieve HMRC tokens.');
    }

    const tenant = await this.tenantRepo.findOne({ where: { id: tenantId } });
    const firmName = tenant?.firmName ?? 'Your accountancy firm';
    const agentName = tenant?.contactName ?? agentEmail;

    // Allow resend when no invitation was created, or previous invite expired/rejected/cancelled
    const canResend =
      !client.invitationId ||
      ['expired', 'rejected', 'cancelled', 'deauthorised'].includes(client.invitationStatus);

    if (!canResend && client.invitationId) {
      throw new BadRequestException(
        'An invitation is already pending with HMRC for this client. Wait for the client to respond or check status first.',
      );
    }

    return this.sendHmrcInvitationForClient({
      client,
      arn: connection.arn,
      accessToken: tokens.accessToken,
      agentName,
      firmName,
      personalMessage,
    });
  }

  async findAll(tenantId: string): Promise<Client[]> {
    return this.clientRepo.find({
      where: { tenantId },
      order: { createdAt: 'DESC' },
    });
  }

  /** Clients with an HMRC invitation awaiting acceptance (sandbox / live pending). */
  async findOutstandingInvitations(tenantId: string): Promise<Client[]> {
    const clients = await this.clientRepo.find({
      where: { tenantId, invitationStatus: 'pending' },
      order: { invitationSentAt: 'DESC' },
    });
    return clients.filter((c) => !!c.invitationId);
  }

  /**
   * Sandbox only — simulates the client accepting via Government Gateway.
   * PUT /agent-authorisation-test-support/invitations/{invitationId} (Postman step 9).
   */
  async acceptInvitationSandbox(tenantId: string, clientId: string): Promise<Client> {
    const client = await this.findOne(tenantId, clientId);

    if (!client.invitationId) {
      throw new BadRequestException(
        'No HMRC invitation ID on this client. Send an invitation first.',
      );
    }
    if (client.invitationStatus === 'accepted') {
      throw new BadRequestException('This invitation has already been accepted.');
    }

    const tokens = await this.hmrcService.getDecryptedTokens(tenantId);
    if (!tokens) {
      throw new InternalServerErrorException('Unable to retrieve HMRC tokens.');
    }

    const url = `${this.hmrcBaseUrl}/agent-authorisation-test-support/invitations/${client.invitationId}`;

    try {
      const res = await fetch(url, {
        method: 'PUT',
        headers: { Authorization: `Bearer ${tokens.accessToken}` },
      });
      if (!res.ok) {
        const text = await res.text();
        this.logger.error(`Sandbox accept failed for ${client.invitationId}: ${text}`);
        throw new BadRequestException(
          invitationErrorToUserMessage(res.status, text) ||
            'HMRC sandbox could not accept this invitation. Check your connection and try again.',
        );
      }
    } catch (err) {
      if (err instanceof BadRequestException) throw err;
      this.logger.error(`Sandbox accept request failed for client ${clientId}`, err);
      throw new InternalServerErrorException('Failed to call HMRC sandbox accept API.');
    }

    return this.checkInvitationStatus(tenantId, clientId);
  }

  async findOne(tenantId: string, id: string): Promise<Client> {
    const client = await this.clientRepo.findOne({ where: { id, tenantId } });
    if (!client) throw new NotFoundException('Client not found');
    return client;
  }

  /** Polls HMRC for the latest invitation status and updates the DB record. */
  async checkInvitationStatus(tenantId: string, id: string): Promise<Client> {
    const client = await this.findOne(tenantId, id);

    if (!client.invitationId) {
      throw new BadRequestException('No invitation ID on this client record.');
    }

    const connection = await this.hmrcService.getStatus(tenantId);
    if (!connection?.arn) {
      throw new BadRequestException('ARN not set — cannot check invitation status.');
    }

    const tokens = await this.hmrcService.getDecryptedTokens(tenantId);
    if (!tokens) throw new InternalServerErrorException('Unable to retrieve HMRC tokens.');

    const url = `${this.hmrcBaseUrl}/agents/${connection.arn}/invitations/${client.invitationId}`;

    let hmrcStatus: string;
    try {
      const res = await fetch(url, {
        headers: { Authorization: `Bearer ${tokens.accessToken}` },
      });
      if (!res.ok) {
        const text = await res.text();
        throw new Error(`HMRC returned ${res.status}: ${text}`);
      }
      const data = (await res.json()) as { status?: string };
      hmrcStatus = this.normalizeHmrcInvitationStatus(data.status ?? '');
    } catch (err) {
      this.logger.error(`Failed to check invitation status for client ${id}`, err);
      throw new InternalServerErrorException('Failed to check invitation status with HMRC.');
    }

    if (hmrcStatus) {
      client.invitationStatus = hmrcStatus;
      if (hmrcStatus === 'accepted' && !client.authorisedAt) {
        client.authorisedAt = new Date();
      }
      await this.clientRepo.save(client);
    } else {
      this.logger.warn(`HMRC returned empty invitation status for client ${id}`);
    }

    return client;
  }

  // ─── Private helpers ──────────────────────────────────────────────────────

  private async findByNino(tenantId: string, nino: string): Promise<Client | null> {
    return this.clientRepo.findOne({ where: { tenantId, nino } });
  }

  /** HMRC may return Pending, Accepted, PartialAuth, etc. — store lowercase hyphenated values. */
  private normalizeHmrcInvitationStatus(raw: string): string {
    const s = raw.trim().toLowerCase().replace(/\s+/g, '-');
    if (s === 'partialauth' || s === 'partial-authorisation' || s === 'partialauthorisation') {
      return 'partial-auth';
    }
    return s;
  }

  private isDuplicateNinoError(err: unknown): boolean {
    if (!(err instanceof QueryFailedError)) return false;
    const driverErr = err.driverError as { code?: string; errno?: number };
    return driverErr?.code === 'ER_DUP_ENTRY' || driverErr?.errno === 1062;
  }

  private async sendHmrcInvitationForClient(params: {
    client: Client;
    arn: string;
    accessToken: string;
    agentName: string;
    firmName: string;
    personalMessage?: string;
  }): Promise<CreateClientResult> {
    const { client, arn, accessToken, agentName, firmName, personalMessage } = params;

    try {
      const invitationId = await this.createHmrcInvitation({
        arn,
        accessToken,
        nino: client.nino,
        postcode: client.postcode,
        agentType: client.agentType,
      });

      const now = new Date();
      const expiresAt = new Date(now.getTime() + 21 * 24 * 60 * 60 * 1000);

      client.invitationId = invitationId;
      client.invitationSentAt = now;
      client.invitationExpiresAt = expiresAt;
      client.invitationStatus = 'pending';
      await this.clientRepo.save(client);

      this.logger.log(`HMRC invitation ${invitationId} created for client ${client.id}`);

      const personalMsg = personalMessage?.replace(/\{name\}/g, client.name) ?? '';
      this.mailService
        .sendClientInvitationEmail({
          to: client.email,
          clientName: client.name,
          agentName,
          firmName,
          personalMessage: personalMsg,
        })
        .catch((err) => this.logger.error(`Notification email failed for ${client.email}`, err));

      return { client, invitationSent: true };
    } catch (err) {
      const technical =
        err instanceof HmrcInvitationFailedError
          ? `status=${err.httpStatus} body=${err.responseText}`
          : (err as Error).message;
      this.logger.error(`HMRC invitation failed for client ${client.id}: ${technical}`);

      const warning =
        err instanceof HmrcInvitationFailedError
          ? invitationErrorToUserMessage(err.httpStatus, err.responseText)
          : 'HMRC could not send the invitation. Please try again.';

      return { client, invitationSent: false, warning };
    }
  }

  private async createHmrcInvitation(params: {
    arn: string;
    accessToken: string;
    nino: string;
    postcode: string;
    agentType: string;
  }): Promise<string> {
    const { arn, accessToken, nino, postcode, agentType } = params;

    const res = await fetch(`${this.hmrcBaseUrl}/agents/${arn}/invitations`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${accessToken}`,
        'Content-Type': 'application/json',
        Accept: 'application/json',
      },
      body: JSON.stringify({
        service: ['MTD-IT'],
        clientType: 'personal',
        clientIdType: 'ni',
        clientId: nino,
        knownFact: postcode,
        agentType,
      }),
    });

    if (!res.ok) {
      const text = await res.text();
      throw new HmrcInvitationFailedError(res.status, text);
    }

    // Extract invitationId from Location header
    // Location: /agents/EARN0713416/invitations/AKOWJ1KT6N5ZX
    const location = res.headers.get('location') ?? '';
    const parts = location.split('/');
    const invitationId = parts[parts.length - 1];

    if (!invitationId) {
      throw new HmrcInvitationFailedError(
        502,
        '{"message":"HMRC did not return an invitation ID in the Location header"}',
      );
    }

    return invitationId;
  }
}
