import {
  Injectable,
  Logger,
  BadRequestException,
  ConflictException,
  NotFoundException,
  InternalServerErrorException,
  UnprocessableEntityException,
  ForbiddenException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { InjectRepository } from '@nestjs/typeorm';
import { DataSource, In, IsNull, Not, QueryFailedError, Repository } from 'typeorm';
import type { FindOptionsWhere } from 'typeorm';
import type { ListClientsQueryDto } from './dto/list-clients-query.dto';
import { parseCsvBuffer, validateRows } from './bulk-import.util';
import type { BulkImportSuccess } from './dto/bulk-import-client.dto';
import { Client } from './entities/client.entity';
import { CreateClientDto } from './dto/create-client.dto';
import { HmrcService } from '../hmrc/hmrc.service';
import { HmrcApiClient } from '../hmrc/hmrc-api.client';
import type { HmrcFraudRequestContext } from '../hmrc/fraud-prevention.types';
import { MailService } from '../mail/mail.service';
import { Tenant } from '../tenants/entities/tenant.entity';
import {
  invitationErrorToUserMessage,
  relationshipErrorToUserMessage,
} from './hmrc-invitation-errors.util';
import type { CreateClientResult } from './dto/create-client-result.dto';
import type { ClientRelationshipStatusDto } from './dto/client-relationship-status.dto';
import type { GetItsaStatusQueryDto } from './dto/get-itsa-status-query.dto';
import type { ItsaStatusResponse } from './hmrc-itsa.types';
import type { BusinessDetailsResponse, BusinessListResponse } from './hmrc-business.types';
import type {
  CrystallisationObligationsResponse,
  IncomeExpenditureObligationsResponse,
} from './hmrc-obligations.types';
import type { GetCrystallisationObligationsQueryDto } from './dto/get-crystallisation-obligations-query.dto';
import { crystallisationTaxYearParam } from './dto/get-crystallisation-obligations-query.dto';
import type { GetIncomeExpenditureObligationsQueryDto } from './dto/get-income-expenditure-obligations-query.dto';
import { itsaErrorToUserMessage } from './hmrc-itsa-errors.util';
import { businessErrorToUserMessage } from './hmrc-business-errors.util';
import { obligationsErrorToUserMessage } from './hmrc-obligations-errors.util';
import type {
  BalanceAndTransactionsResponse,
  ChargeHistoryLookup,
  ChargeHistoryResponse,
  PaymentsAndAllocationsResponse,
} from './hmrc-accounts.types';
import type { GetBalanceAndTransactionsQueryDto } from './dto/get-balance-and-transactions-query.dto';
import { defaultAccountsDateRange } from './dto/get-balance-and-transactions-query.dto';
import type { GetPaymentsAndAllocationsQueryDto } from './dto/get-payments-and-allocations-query.dto';
import { defaultPaymentsDateRange } from './dto/get-payments-and-allocations-query.dto';
import {
  accountsErrorToUserMessage,
  chargeHistoryErrorToUserMessage,
} from './hmrc-accounts-errors.util';
import type { BissResponse, IncomeSummaryResponse } from './hmrc-biss.types';
import type {
  SeCumulativeSummaryResponse,
  SubmittedFiguresResponse,
  SubmittedPeriodFigure,
} from './hmrc-period-summaries.types';
import type {
  UkPropertyAnnualSubmission,
  UkPropertyCumulativeSummaryResponse,
  UkPropertyFiguresResponse,
} from './hmrc-property.types';
import {
  propertyCumulativeErrorToUserMessage,
  propertyErrorToUserMessage,
} from './hmrc-property-errors.util';
import { testSupportBusinessErrorToUserMessage } from './hmrc-test-support-errors.util';
import { seCumulativeErrorToUserMessage } from './hmrc-se-errors.util';
import type { CreateSeCumulativeDto } from './dto/create-se-cumulative.dto';
import type { CreateUkPropertyCumulativeDto } from './dto/create-uk-property-cumulative.dto';
import { ClientNote } from './entities/client-note.entity';
import { currentUkTaxYear } from './dto/get-income-summary-query.dto';
import { latestCompletedCumulativePeriod, normalizeTaxYear } from './tax-year.util';
import { piiHash } from '../../common/utils/pii-hash.util';
import { AppNotificationsService } from '../app-notifications/app-notifications.service';
import { PortalService } from '../client-portal/portal.service';
import { NotificationPreferences } from '../tenants/entities/notification-preferences.entity';
import { ClientPipelineService } from './client-pipeline.service';
import { User } from '../users/entities/user.entity';
import type { RequestUser } from '../auth/strategies/jwt.strategy';
import { staffClientWhere } from './staff-client-scope.util';

/** HMRC POST /relationships result. */
type HmrcRelationshipResult = 'active' | 'inactive';

/** Invitation statuses that won't change — no need to poll HMRC again. */
const TERMINAL_INVITATION_STATUSES = new Set([
  'accepted',
  'rejected',
  'expired',
  'cancelled',
  'deauthorised',
]);

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
    @InjectRepository(NotificationPreferences)
    private readonly notifPrefsRepo: Repository<NotificationPreferences>,
    @InjectRepository(ClientNote)
    private readonly clientNoteRepo: Repository<ClientNote>,
    @InjectRepository(User)
    private readonly userRepo: Repository<User>,
    private readonly configService: ConfigService,
    private readonly hmrcService: HmrcService,
    private readonly hmrcApiClient: HmrcApiClient,
    private readonly mailService: MailService,
    private readonly appNotificationsService: AppNotificationsService,
    private readonly portalService: PortalService,
    private readonly clientPipelineService: ClientPipelineService,
    private readonly dataSource: DataSource,
  ) {}

  /** HMRC API base URL — from HMRC_BASE_URL in .env (same as HmrcService). */
  private get hmrcBaseUrl(): string {
    return this.configService.get<string>('hmrc.baseUrl')!;
  }

  async create(
    tenantId: string,
    agentEmail: string,
    dto: CreateClientDto,
    fraudContext?: HmrcFraudRequestContext | null,
    actingUserId?: string,
  ): Promise<CreateClientResult> {
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

    const accessToken = await this.hmrcService.getValidAccessToken(tenantId);

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
      ninoHash: piiHash(ninoClean),
      postcode: dto.postcode.trim().toUpperCase(),
      email: dto.email,
      phone: dto.phone,
      agentType: dto.agentType ?? 'main',
      utr: dto.utr ?? undefined,
      invitationStatus: 'pending',
      pipelineStatus: 'pending-invite',
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

    await this.clientPipelineService.recordInitialStatus(tenantId, client.id).catch((err) => {
      this.logger.warn(`Initial pipeline history failed for ${client.id}: ${String(err)}`);
    });

    // Create portal account + send invite email (fire-and-forget — never blocks client creation)
    void this.portalService
      .createAndInvite(tenantId, client.id, dto.email, dto.name, actingUserId)
      .catch((err) =>
        this.logger.warn(`Portal invite failed for client ${client.id}: ${String(err)}`),
      );

    return this.sendHmrcInvitationForClient({
      client,
      arn: connection.arn,
      accessToken,
      agentName,
      firmName,
      personalMessage: dto.personalMessage,
      fraudContext,
      actingUserId,
    });
  }

  /** Resend HMRC invitation for an existing client (e.g. after ARN fix or failed first attempt). */
  async resendInvitation(
    tenantId: string,
    clientId: string,
    agentEmail: string,
    personalMessage?: string,
    fraudContext?: HmrcFraudRequestContext | null,
    actingUserId?: string,
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

    const accessToken = await this.hmrcService.getValidAccessToken(tenantId);

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
      accessToken,
      agentName,
      firmName,
      personalMessage,
      fraudContext,
      actingUserId,
    });
  }

  async findAll(
    tenantId: string,
    query: ListClientsQueryDto = {},
    fraudContext?: HmrcFraudRequestContext | null,
    actor?: RequestUser | null,
  ): Promise<{
    clients: Array<
      Client & {
        businesses: Array<{
          businessId: string;
          typeOfBusiness: string;
          tradingName?: string;
          chaseCount: number;
          lastChaseAt: string | null;
          lastChaseStatus: string | null;
        }>;
      }
    >;
    total: number;
    page: number;
    limit: number;
    totalPages: number;
  }> {
    const page = Math.max(1, Number(query.page) || 1);
    const limit = Math.min(100, Math.max(1, Number(query.limit) || 20));
    const status = query.status ?? 'all';
    const search = (query.search ?? '').trim().toLowerCase();
    const agentType = (query.agentType ?? 'all').trim().toLowerCase();

    // Build DB WHERE — status filter applied at query level
    const base: FindOptionsWhere<Client> = staffClientWhere(tenantId, actor);
    let where: FindOptionsWhere<Client> | FindOptionsWhere<Client>[];
    switch (status) {
      case 'pending':
        where = { ...base, invitationStatus: 'pending' };
        break;
      case 'filed':
        where = { ...base, authorisedAt: Not(IsNull()) };
        break;
      case 'invite-accepted':
        where = { ...base, invitationStatus: 'accepted' };
        break;
      case 'partial-auth':
        where = { ...base, invitationStatus: 'partial-auth' };
        break;
      case 'rejected':
        where = { ...base, invitationStatus: 'rejected' };
        break;
      case 'expired':
        where = { ...base, invitationStatus: In(['expired', 'cancelled', 'deauthorised']) };
        break;
      default:
        where = base;
    }

    // Fetch all status-filtered rows (HMRC sync then re-fetch)
    let all = await this.clientRepo.find({ where, order: { createdAt: 'DESC' } });
    await this.syncInvitationStatusesFromHmrc(tenantId, all, fraudContext);
    await this.syncRelationshipsFromHmrc(tenantId, all, fraudContext);
    all = await this.clientRepo.find({ where, order: { createdAt: 'DESC' } });

    // Search in-memory (names are encrypted — cannot use DB LIKE)
    if (search) {
      all = all.filter(
        (c) => c.name.toLowerCase().includes(search) || c.nino.toLowerCase().includes(search),
      );
    }

    if (agentType === 'main' || agentType === 'supporting') {
      all = all.filter((c) => (c.agentType ?? 'main').toLowerCase() === agentType);
    }

    const total = all.length;
    const totalPages = Math.max(1, Math.ceil(total / limit));
    const safePage = Math.min(page, totalPages);
    const offset = (safePage - 1) * limit;
    const pageClients = all.slice(offset, offset + limit);

    const clients = await Promise.all(
      pageClients.map(async (c) => {
        const sources = c.authorisedAt
          ? await this.listBusinessIncomeSources(tenantId, c.id, fraudContext)
          : [];
        return Object.assign(c, {
          businesses: sources.map((b) => ({
            businessId: b.businessId,
            typeOfBusiness: b.typeOfBusiness,
            tradingName: b.tradingName,
            chaseCount: 0,
            lastChaseAt: null as string | null,
            lastChaseStatus: null as string | null,
          })),
        });
      }),
    );

    // Attach per-business chase summaries when any businesses exist
    const targets = clients.flatMap((c) =>
      c.businesses.map((b) => ({ clientId: c.id, businessId: b.businessId })),
    );
    if (targets.length > 0) {
      // Lazy import avoided — use pipeline-free chase summary via dataSource query
      const summaryMap = await this.loadBusinessChaseSummaries(tenantId, targets);
      for (const c of clients) {
        c.businesses = c.businesses.map((b) => {
          const key = `${c.id}::${b.businessId}`;
          const s = summaryMap.get(key);
          return {
            ...b,
            chaseCount: s?.chaseCount ?? 0,
            lastChaseAt: s?.lastChaseAt ?? null,
            lastChaseStatus: s?.lastChaseStatus ?? null,
          };
        });
      }
    }

    return {
      clients,
      total,
      page: safePage,
      limit,
      totalPages,
    };
  }

  /** Per-business chase stats for clients list (avoids circular ChaseLogsModule import). */
  private async loadBusinessChaseSummaries(
    tenantId: string,
    targets: Array<{ clientId: string; businessId: string }>,
  ): Promise<
    Map<string, { chaseCount: number; lastChaseAt: string | null; lastChaseStatus: string | null }>
  > {
    const map = new Map<
      string,
      { chaseCount: number; lastChaseAt: string | null; lastChaseStatus: string | null }
    >();
    if (targets.length === 0) return map;

    const clientIds = [...new Set(targets.map((t) => t.clientId))];
    const rows: Array<{
      client_id: string;
      business_id: string | null;
      chase_count: string;
      last_chase_at: Date | null;
      last_status: string | null;
    }> = await this.dataSource.query(
      `
      SELECT
        client_id,
        business_id,
        COUNT(*) AS chase_count,
        MAX(sent_at) AS last_chase_at,
        SUBSTRING_INDEX(GROUP_CONCAT(status ORDER BY sent_at DESC), ',', 1) AS last_status
      FROM chase_logs
      WHERE tenant_id = ?
        AND deletedAt IS NULL
        AND client_id IN (${clientIds.map(() => '?').join(',')})
        AND business_id IS NOT NULL
      GROUP BY client_id, business_id
      `,
      [tenantId, ...clientIds],
    );

    for (const r of rows) {
      if (!r.business_id) continue;
      map.set(`${r.client_id}::${r.business_id}`, {
        chaseCount: Number(r.chase_count) || 0,
        lastChaseAt: r.last_chase_at ? new Date(r.last_chase_at).toISOString() : null,
        lastChaseStatus: r.last_status,
      });
    }
    return map;
  }

  /** Clients with an HMRC invitation awaiting acceptance (sandbox / live pending). */
  async findOutstandingInvitations(
    tenantId: string,
    fraudContext?: HmrcFraudRequestContext | null,
    actor?: RequestUser | null,
  ): Promise<Client[]> {
    const where = staffClientWhere(tenantId, actor, { invitationStatus: 'pending' });
    const clients = await this.clientRepo.find({
      where,
      order: { invitationSentAt: 'DESC' },
    });
    const withInvite = clients.filter((c) => !!c.invitationId);
    await this.syncInvitationStatusesFromHmrc(tenantId, withInvite, fraudContext);
    const refreshed = await this.clientRepo.find({
      where,
      order: { invitationSentAt: 'DESC' },
    });
    return refreshed.filter((c) => !!c.invitationId);
  }

  /**
   * Sandbox only — simulates the client accepting via Government Gateway.
   * PUT /agent-authorisation-test-support/invitations/{invitationId} (Postman step 9).
   */
  async acceptInvitationSandbox(
    tenantId: string,
    clientId: string,
    fraudContext?: HmrcFraudRequestContext | null,
  ): Promise<Client> {
    const client = await this.findOne(tenantId, clientId);

    if (!client.invitationId) {
      throw new BadRequestException(
        'No HMRC invitation ID on this client. Send an invitation first.',
      );
    }
    if (client.invitationStatus === 'accepted') {
      throw new BadRequestException('This invitation has already been accepted.');
    }

    const accessToken = await this.hmrcService.getValidAccessToken(tenantId);

    const url = `${this.hmrcBaseUrl}/agent-authorisation-test-support/invitations/${client.invitationId}`;

    try {
      const res = await this.hmrcApiClient.fetch(url, {
        method: 'PUT',
        accessToken,
        fraudContext,
        headers: { Accept: 'application/vnd.hmrc.1.0+json' },
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

    return this.checkInvitationStatus(tenantId, clientId, fraudContext);
  }

  /**
   * Sandbox only — add a UK property income source on an authorised test client.
   * POST /individuals/self-assessment-test-support/business/{nino}
   * HMRC purges test businesses after 7 days. Does not convert an existing SE business.
   */
  async createUkPropertyTestBusiness(
    tenantId: string,
    clientId: string,
    fraudContext?: HmrcFraudRequestContext | null,
  ): Promise<BusinessListResponse> {
    this.assertSandboxEnvironment();

    const client = await this.ensureClientAuthorisedForMtd(tenantId, clientId, fraudContext);
    const connection = await this.hmrcService.getStatus(tenantId);
    if (!connection?.scope?.includes('write:self-assessment')) {
      throw new BadRequestException(
        'Reconnect HMRC after adding write:self-assessment to HMRC_SCOPE and Developer Hub. ' +
          'That scope is required to create a sandbox UK property business.',
      );
    }

    const accessToken = await this.hmrcService.getValidAccessToken(tenantId);
    let listed = await this.listBusinessesLite(client.nino, accessToken, fraudContext);

    if (!listed.some((b) => this.isUkPropertyType(b.typeOfBusiness))) {
      const propertyId = await this.createSandboxTestBusiness(
        client.nino,
        accessToken,
        fraudContext,
        {
          typeOfBusiness: 'uk-property',
          commencementDate: '2024-04-06',
          accountingType: 'CASH',
          firstAccountingPeriodStartDate: '2024-04-06',
          firstAccountingPeriodEndDate: '2025-04-05',
        },
        clientId,
      );
      if (propertyId) {
        listed = [...listed, { typeOfBusiness: 'uk-property', businessId: propertyId }];
      }
    }

    if (!listed.some((b) => b.typeOfBusiness === 'self-employment')) {
      const seId = await this.createSandboxTestBusiness(
        client.nino,
        accessToken,
        fraudContext,
        {
          typeOfBusiness: 'self-employment',
          tradingType: 'Plastering',
          tradingName: 'Company X',
          commencementDate: '2024-04-06',
          accountingType: 'CASH',
          firstAccountingPeriodStartDate: '2024-04-06',
          firstAccountingPeriodEndDate: '2025-04-05',
          businessAddressLineOne: '1 High Street',
          businessAddressPostcode: 'SW1A 1AA',
          businessAddressCountryCode: 'GB',
        },
        clientId,
      );
      if (seId) {
        listed = [
          ...listed,
          { typeOfBusiness: 'self-employment', businessId: seId, tradingName: 'Company X' },
        ];
      }
    }

    const refreshed = await this.listBusinesses(tenantId, clientId, fraudContext);
    const merged = [...refreshed.listOfBusinesses];
    for (const extra of listed) {
      if (!merged.some((b) => b.businessId === extra.businessId)) {
        merged.push(extra);
      }
    }
    if (!merged.some((b) => this.isUkPropertyType(b.typeOfBusiness))) {
      throw new BadRequestException(
        'HMRC did not return a UK property income source after create. Check Self Assessment Test Support subscription and reconnect HMRC.',
      );
    }
    return { listOfBusinesses: merged };
  }

  private async createSandboxTestBusiness(
    nino: string,
    accessToken: string,
    fraudContext: HmrcFraudRequestContext | null | undefined,
    body: Record<string, unknown>,
    clientId: string,
  ): Promise<string | undefined> {
    const url =
      `${this.hmrcBaseUrl}/individuals/self-assessment-test-support/business/` +
      encodeURIComponent(nino);

    try {
      const res = await this.hmrcApiClient.fetch(url, {
        method: 'POST',
        accessToken,
        fraudContext,
        headers: {
          Accept: 'application/vnd.hmrc.1.0+json',
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(body),
      });
      const text = await res.text();
      this.logger.log(
        `Create ${String(body.typeOfBusiness)} test business HMRC ${res.status} for ${clientId}: ${text || '(empty)'}`,
      );

      if (!res.ok) {
        const alreadyAdded =
          text.includes('RULE_PROPERTY_BUSINESS_ADDED') ||
          testSupportBusinessErrorToUserMessage(res.status, text).includes('already has');
        if (alreadyAdded) return undefined;
        throw new BadRequestException(testSupportBusinessErrorToUserMessage(res.status, text));
      }

      const parsed = text ? (JSON.parse(text) as { businessId?: string }) : {};
      if (!parsed.businessId) {
        throw new BadRequestException(
          `HMRC accepted the ${String(body.typeOfBusiness)} create call but did not return a businessId.`,
        );
      }
      return parsed.businessId;
    } catch (err) {
      if (err instanceof BadRequestException) throw err;
      this.logger.error(
        `Create ${String(body.typeOfBusiness)} test business failed for ${clientId}`,
        err,
      );
      throw new InternalServerErrorException(
        `Failed to create sandbox ${String(body.typeOfBusiness)} business.`,
      );
    }
  }

  private isHmrcSandbox(): boolean {
    return (this.hmrcBaseUrl ?? '').includes('test-api');
  }

  /** Sandbox only — without this, Business Details list always returns the default Company X stub. */
  private sandboxStatefulHeaders(): Record<string, string> {
    return this.isHmrcSandbox() ? { 'Gov-Test-Scenario': 'STATEFUL' } : {};
  }

  private assertSandboxEnvironment(): void {
    if (!this.isHmrcSandbox()) {
      throw new BadRequestException(
        'UK property test businesses can only be created in the HMRC sandbox.',
      );
    }
  }

  async findOne(tenantId: string, id: string, actor?: RequestUser | null): Promise<Client> {
    const client = await this.clientRepo.findOne({
      where: staffClientWhere(tenantId, actor, { id }),
    });
    if (!client) throw new NotFoundException('Client not found');
    return client;
  }

  async assignClient(
    actor: RequestUser,
    clientId: string,
    assignedToUserId: string | null,
  ): Promise<Client> {
    if (actor.role === 'staff') {
      throw new ForbiddenException('Only the firm owner can assign clients.');
    }
    const client = await this.findOne(actor.tenantId, clientId);
    if (assignedToUserId) {
      const user = await this.userRepo.findOne({
        where: { id: assignedToUserId, tenantId: actor.tenantId, isActive: true },
      });
      if (!user) throw new NotFoundException('Team member not found.');
      client.assignedToUserId = user.id;
    } else {
      client.assignedToUserId = null;
    }
    return this.clientRepo.save(client);
  }

  async updateClient(
    tenantId: string,
    id: string,
    fields: { utr?: string; preferredName?: string },
    actor?: RequestUser | null,
  ): Promise<Client> {
    const client = await this.findOne(tenantId, id, actor);
    if (fields.utr !== undefined) client.utr = fields.utr || undefined;
    if (fields.preferredName !== undefined) {
      const trimmed = fields.preferredName.trim();
      client.preferredName = trimmed || undefined;
    }
    return this.clientRepo.save(client);
  }

  /** Polls HMRC for the latest invitation status and updates the DB record. */
  async checkInvitationStatus(
    tenantId: string,
    id: string,
    fraudContext?: HmrcFraudRequestContext | null,
  ): Promise<Client> {
    const client = await this.findOne(tenantId, id);

    if (!client.invitationId) {
      throw new BadRequestException('No invitation ID on this client record.');
    }

    const connection = await this.hmrcService.getStatus(tenantId);
    if (!connection?.arn) {
      throw new BadRequestException('ARN not set — cannot check invitation status.');
    }

    const accessToken = await this.hmrcService.getValidAccessToken(tenantId);

    try {
      await this.syncOneInvitationFromHmrc(client, connection.arn, accessToken, fraudContext);
    } catch (err) {
      this.logger.error(`Failed to check invitation status for client ${id}`, err);
      throw new InternalServerErrorException('Failed to check invitation status with HMRC.');
    }

    const refreshed = await this.findOne(tenantId, id);
    return this.verifyAndPersistRelationship(tenantId, refreshed, fraudContext);
  }

  /**
   * Verifies agent–client relationship with HMRC (Postman step 8).
   * POST /agents/{arn}/relationships — 204 = active, 404 = inactive.
   */
  async checkRelationshipStatus(
    tenantId: string,
    id: string,
    fraudContext?: HmrcFraudRequestContext | null,
  ): Promise<ClientRelationshipStatusDto> {
    const client = await this.findOne(tenantId, id);
    const updated = await this.verifyAndPersistRelationship(tenantId, client, fraudContext);
    return {
      client: updated,
      relationshipActive: !!updated.authorisedAt,
    };
  }

  /**
   * Gatekeeper for future MTD ITSA API calls — throws if relationship is not active.
   */
  async ensureClientAuthorisedForMtd(
    tenantId: string,
    clientId: string,
    fraudContext?: HmrcFraudRequestContext | null,
  ): Promise<Client> {
    const { client, relationshipActive } = await this.checkRelationshipStatus(
      tenantId,
      clientId,
      fraudContext,
    );
    if (!relationshipActive) {
      throw new BadRequestException(
        'This client has not authorised your firm for MTD yet. ' +
          'Wait for them to accept the HMRC invitation, then refresh relationship status.',
      );
    }
    return client;
  }

  /**
   * Retrieve ITSA status from HMRC (SA Individual Details v2.0).
   * GET /individuals/person/itsa-status/{nino}/{taxYear}
   */
  async getItsaStatus(
    tenantId: string,
    clientId: string,
    query: GetItsaStatusQueryDto,
    fraudContext?: HmrcFraudRequestContext | null,
  ): Promise<ItsaStatusResponse> {
    let client = await this.findOne(tenantId, clientId);
    if (!client.authorisedAt) {
      client = await this.ensureClientAuthorisedForMtd(tenantId, clientId, fraudContext);
    }

    const accessToken = await this.hmrcService.getValidAccessToken(tenantId);
    const taxYear = normalizeTaxYear(query.taxYear);

    const params = new URLSearchParams();
    if (query.history === true) params.set('history', 'true');
    if (query.futureYears === true) params.set('futureYears', 'true');
    const qs = params.toString() ? `?${params.toString()}` : '';

    const url =
      `${this.hmrcBaseUrl}/individuals/person/itsa-status/` +
      `${encodeURIComponent(client.nino)}/${encodeURIComponent(taxYear)}${qs}`;

    let res: Response;
    try {
      res = await this.hmrcApiClient.fetch(url, {
        accessToken,
        fraudContext,
        headers: { Accept: 'application/vnd.hmrc.2.0+json' },
      });
    } catch (err) {
      this.logger.error(`HMRC ITSA status network error for client ${clientId}`, err);
      throw new InternalServerErrorException('Failed to contact HMRC for ITSA status.');
    }

    const text = await res.text();
    if (!res.ok) {
      this.logger.warn(`HMRC ITSA status ${res.status} for client ${clientId}: ${text}`);
      throw new BadRequestException(itsaErrorToUserMessage(res.status, text));
    }

    try {
      return text ? (JSON.parse(text) as ItsaStatusResponse) : { itsaStatuses: [] };
    } catch {
      throw new InternalServerErrorException('HMRC returned invalid JSON for ITSA status.');
    }
  }

  /**
   * Lightweight business list for clients list / chase rows.
   * Returns [] when not authorised or HMRC fails (never throws).
   */
  async listBusinessIncomeSources(
    tenantId: string,
    clientId: string,
    fraudContext?: HmrcFraudRequestContext | null,
  ): Promise<Array<{ businessId: string; typeOfBusiness: string; tradingName?: string }>> {
    try {
      const client = await this.findOne(tenantId, clientId);
      if (!client.authorisedAt) return [];
      const accessToken = await this.hmrcService.getValidAccessToken(tenantId);
      return await this.listBusinessesLite(client.nino, accessToken, fraudContext);
    } catch (err) {
      this.logger.warn(`listBusinessIncomeSources failed for ${clientId}: ${String(err)}`);
      return [];
    }
  }

  /**
   * List all business income sources for a client.
   * GET /individuals/business/details/{nino}/list
   */
  async listBusinesses(
    tenantId: string,
    clientId: string,
    fraudContext?: HmrcFraudRequestContext | null,
  ): Promise<BusinessListResponse> {
    const client = await this.ensureClientAuthorisedForMtd(tenantId, clientId, fraudContext);
    const accessToken = await this.hmrcService.getValidAccessToken(tenantId);

    const url =
      `${this.hmrcBaseUrl}/individuals/business/details/` +
      `${encodeURIComponent(client.nino)}/list`;

    return this.fetchHmrcBusinessJson(url, accessToken, fraudContext, businessErrorToUserMessage);
  }

  /**
   * Retrieve details for one business income source.
   * GET /individuals/business/details/{nino}/{businessId}
   */
  async getBusinessDetails(
    tenantId: string,
    clientId: string,
    businessId: string,
    fraudContext?: HmrcFraudRequestContext | null,
  ): Promise<BusinessDetailsResponse> {
    const client = await this.ensureClientAuthorisedForMtd(tenantId, clientId, fraudContext);
    const accessToken = await this.hmrcService.getValidAccessToken(tenantId);

    const url =
      `${this.hmrcBaseUrl}/individuals/business/details/` +
      `${encodeURIComponent(client.nino)}/${encodeURIComponent(businessId)}`;

    return this.fetchHmrcBusinessJson(url, accessToken, fraudContext, businessErrorToUserMessage);
  }

  /**
   * Quarterly income & expenditure obligations (Obligations MTD v3.0).
   * GET /obligations/details/{nino}/income-and-expenditure
   */
  async getIncomeAndExpenditureObligations(
    tenantId: string,
    clientId: string,
    query: GetIncomeExpenditureObligationsQueryDto,
    fraudContext?: HmrcFraudRequestContext | null,
  ): Promise<IncomeExpenditureObligationsResponse> {
    const client = await this.ensureClientAuthorisedForMtd(tenantId, clientId, fraudContext);
    const accessToken = await this.hmrcService.getValidAccessToken(tenantId);

    if (query.businessId && !query.typeOfBusiness) {
      throw new BadRequestException(
        'typeOfBusiness is required when filtering obligations by businessId.',
      );
    }
    if ((query.fromDate && !query.toDate) || (!query.fromDate && query.toDate)) {
      throw new BadRequestException('Both fromDate and toDate must be provided together.');
    }

    const params = new URLSearchParams();
    if (query.typeOfBusiness) params.set('typeOfBusiness', query.typeOfBusiness);
    if (query.businessId) params.set('businessId', query.businessId);
    if (query.fromDate) params.set('fromDate', query.fromDate);
    if (query.toDate) params.set('toDate', query.toDate);
    if (query.status) params.set('status', query.status);
    const qs = params.toString() ? `?${params.toString()}` : '';

    const url =
      `${this.hmrcBaseUrl}/obligations/details/` +
      `${encodeURIComponent(client.nino)}/income-and-expenditure${qs}`;

    const data = await this.fetchHmrcObligationsJson<IncomeExpenditureObligationsResponse>(
      url,
      accessToken,
      fraudContext,
    );
    return { obligations: data.obligations ?? [] };
  }

  /**
   * Final declaration (crystallisation) obligations (Obligations MTD v3.0).
   * GET /obligations/details/{nino}/crystallisation
   */
  async getCrystallisationObligations(
    tenantId: string,
    clientId: string,
    query: GetCrystallisationObligationsQueryDto,
    fraudContext?: HmrcFraudRequestContext | null,
  ): Promise<CrystallisationObligationsResponse> {
    const client = await this.ensureClientAuthorisedForMtd(tenantId, clientId, fraudContext);
    const accessToken = await this.hmrcService.getValidAccessToken(tenantId);

    const params = new URLSearchParams();
    const taxYear = crystallisationTaxYearParam(query.taxYear);
    if (taxYear) params.set('taxYear', taxYear);
    if (query.status) params.set('status', query.status);
    const qs = params.toString() ? `?${params.toString()}` : '';

    const url =
      `${this.hmrcBaseUrl}/obligations/details/` +
      `${encodeURIComponent(client.nino)}/crystallisation${qs}`;

    const data = await this.fetchHmrcObligationsJson<CrystallisationObligationsResponse>(
      url,
      accessToken,
      fraudContext,
    );
    return { obligations: data.obligations ?? [] };
  }

  /**
   * Self Assessment balance and transactions (SA Accounts MTD v4.0).
   * GET /accounts/self-assessment/{nino}/balance-and-transactions
   */
  async getBalanceAndTransactions(
    tenantId: string,
    clientId: string,
    query: GetBalanceAndTransactionsQueryDto,
    fraudContext?: HmrcFraudRequestContext | null,
  ): Promise<BalanceAndTransactionsResponse> {
    const client = await this.ensureClientAuthorisedForMtd(tenantId, clientId, fraudContext);
    const accessToken = await this.hmrcService.getValidAccessToken(tenantId);

    const onlyOpenItems = query.onlyOpenItems === true;
    let fromDate = query.fromDate;
    let toDate = query.toDate;

    if (!onlyOpenItems && !query.docNumber?.trim() && (!fromDate || !toDate)) {
      const defaults = defaultAccountsDateRange();
      fromDate = defaults.fromDate;
      toDate = defaults.toDate;
    }

    if ((fromDate && !toDate) || (!fromDate && toDate)) {
      throw new BadRequestException('Both fromDate and toDate must be provided together.');
    }

    const params = new URLSearchParams();
    if (query.docNumber) params.set('docNumber', query.docNumber);
    if (fromDate) params.set('fromDate', fromDate);
    if (toDate) params.set('toDate', toDate);
    if (onlyOpenItems) params.set('onlyOpenItems', 'true');
    if (query.calculateAccruedInterest !== false) {
      params.set('calculateAccruedInterest', 'true');
    }
    if (query.includeLocks === true) params.set('includeLocks', 'true');
    if (query.customerPaymentInformation === true) {
      params.set('customerPaymentInformation', 'true');
    }
    const qs = params.toString() ? `?${params.toString()}` : '';

    const url =
      `${this.hmrcBaseUrl}/accounts/self-assessment/` +
      `${encodeURIComponent(client.nino)}/balance-and-transactions${qs}`;

    return this.fetchHmrcAccountsJson<BalanceAndTransactionsResponse>(
      url,
      accessToken,
      fraudContext,
    );
  }

  /**
   * List SA payment history and allocation details (SA Accounts MTD v4.0).
   * GET /accounts/self-assessment/{nino}/payments-and-allocations
   */
  async getPaymentsAndAllocations(
    tenantId: string,
    clientId: string,
    query: GetPaymentsAndAllocationsQueryDto,
    fraudContext?: HmrcFraudRequestContext | null,
  ): Promise<PaymentsAndAllocationsResponse> {
    const client = await this.ensureClientAuthorisedForMtd(tenantId, clientId, fraudContext);
    const accessToken = await this.hmrcService.getValidAccessToken(tenantId);

    const fromDate = query.fromDate ?? defaultPaymentsDateRange().fromDate;
    const toDate = query.toDate ?? defaultPaymentsDateRange().toDate;

    const params = new URLSearchParams({ fromDate, toDate });
    if (query.paymentLot) params.set('paymentLot', query.paymentLot);
    if (query.paymentLotItem) params.set('paymentLotItem', query.paymentLotItem);

    const url =
      `${this.hmrcBaseUrl}/accounts/self-assessment/` +
      `${encodeURIComponent(client.nino)}/payments-and-allocations?${params.toString()}`;

    const data = await this.fetchHmrcAccountsJson<PaymentsAndAllocationsResponse>(
      url,
      accessToken,
      fraudContext,
    );
    return { payments: data.payments ?? [] };
  }

  /**
   * SA Accounts charge history (v4.0 Payments and Liabilities).
   * document-id  -> GET .../charges/{transactionId}
   * transaction-id -> GET .../charges/transactionId/{transactionId}
   * charge-reference -> GET .../charges/chargeReference/{chargeReference}
   */
  async getChargeHistory(
    tenantId: string,
    clientId: string,
    lookup: ChargeHistoryLookup,
    value: string,
    fraudContext?: HmrcFraudRequestContext | null,
  ): Promise<ChargeHistoryResponse> {
    const id = value.trim();
    if (lookup === 'charge-reference') {
      if (!/^[A-Za-z]{2}[0-9]{12}$/.test(id)) {
        throw new BadRequestException('Charge reference must be 2 letters followed by 12 digits.');
      }
    } else if (!/^[0-9A-Za-z]{1,12}$/.test(id)) {
      throw new BadRequestException('Charge transaction ID must be 1 to 12 letters or digits.');
    }

    const client = await this.ensureClientAuthorisedForMtd(tenantId, clientId, fraudContext);
    const accessToken = await this.hmrcService.getValidAccessToken(tenantId);
    const nino = encodeURIComponent(client.nino);
    const encoded = encodeURIComponent(id);

    const path =
      lookup === 'charge-reference'
        ? `${nino}/charges/chargeReference/${encoded}`
        : lookup === 'transaction-id'
          ? `${nino}/charges/transactionId/${encoded}`
          : `${nino}/charges/${encoded}`;

    const url = `${this.hmrcBaseUrl}/accounts/self-assessment/${path}`;
    const data = await this.fetchHmrcAccountsJson<ChargeHistoryResponse>(
      url,
      accessToken,
      fraudContext,
      chargeHistoryErrorToUserMessage,
    );
    return { chargeHistoryDetails: data.chargeHistoryDetails ?? [] };
  }

  // ─── Private helpers ──────────────────────────────────────────────────────

  private async fetchHmrcAccountsJson<T>(
    url: string,
    accessToken: string,
    fraudContext: HmrcFraudRequestContext | null | undefined,
    mapError: (status: number, text: string) => string = accountsErrorToUserMessage,
  ): Promise<T> {
    let res: Response;
    try {
      res = await this.hmrcApiClient.fetch(url, {
        accessToken,
        fraudContext,
        headers: { Accept: 'application/vnd.hmrc.4.0+json' },
      });
    } catch (err) {
      this.logger.error(`HMRC SA accounts network error: ${url}`, err);
      throw new InternalServerErrorException('Failed to contact HMRC for account transactions.');
    }

    const text = await res.text();
    if (!res.ok) {
      this.logger.warn(`HMRC SA accounts ${res.status}: ${text}`);
      throw new BadRequestException(mapError(res.status, text));
    }

    try {
      return text ? (JSON.parse(text) as T) : ({} as T);
    } catch {
      throw new InternalServerErrorException(
        'HMRC returned invalid JSON for account transactions.',
      );
    }
  }

  private async fetchHmrcObligationsJson<T>(
    url: string,
    accessToken: string,
    fraudContext: HmrcFraudRequestContext | null | undefined,
  ): Promise<T> {
    let res: Response;
    try {
      res = await this.hmrcApiClient.fetch(url, {
        accessToken,
        fraudContext,
        headers: { Accept: 'application/vnd.hmrc.3.0+json' },
      });
    } catch (err) {
      this.logger.error(`HMRC obligations network error: ${url}`, err);
      throw new InternalServerErrorException('Failed to contact HMRC for obligations.');
    }

    const text = await res.text();
    if (!res.ok) {
      if (this.isHmrcSandbox() && res.status === 404) {
        return { obligations: [] } as T;
      }
      this.logger.warn(`HMRC obligations ${res.status}: ${text}`);
      throw new BadRequestException(obligationsErrorToUserMessage(res.status, text));
    }

    try {
      return text ? (JSON.parse(text) as T) : ({} as T);
    } catch {
      throw new InternalServerErrorException('HMRC returned invalid JSON for obligations.');
    }
  }

  private async fetchHmrcBusinessJson<T>(
    url: string,
    accessToken: string,
    fraudContext: HmrcFraudRequestContext | null | undefined,
    errorMapper: (status: number, text: string) => string,
  ): Promise<T> {
    let res: Response;
    try {
      res = await this.hmrcApiClient.fetch(url, {
        accessToken,
        fraudContext,
        headers: {
          Accept: 'application/vnd.hmrc.2.0+json',
          ...this.sandboxStatefulHeaders(),
        },
      });
    } catch (err) {
      this.logger.error(`HMRC business details network error: ${url}`, err);
      throw new InternalServerErrorException('Failed to contact HMRC for business details.');
    }

    const text = await res.text();
    if (!res.ok) {
      if (this.isHmrcSandbox() && res.status === 404 && url.includes('/list')) {
        return { listOfBusinesses: [] } as T;
      }
      this.logger.warn(`HMRC business details ${res.status}: ${text}`);
      throw new BadRequestException(errorMapper(res.status, text));
    }

    try {
      return JSON.parse(text) as T;
    } catch {
      throw new InternalServerErrorException('HMRC returned invalid JSON for business details.');
    }
  }

  /** True when HMRC should be polled for the latest invitation status. */
  private needsHmrcStatusSync(client: Client): boolean {
    if (!client.invitationId) return false;
    return !TERMINAL_INVITATION_STATUSES.has(client.invitationStatus);
  }

  /**
   * Best-effort batch sync — polls HMRC for non-terminal invitations.
   * Failures are logged; list still returns cached DB values.
   */
  private async syncInvitationStatusesFromHmrc(
    tenantId: string,
    clients: Client[],
    fraudContext?: HmrcFraudRequestContext | null,
  ): Promise<void> {
    const toSync = clients.filter((c) => this.needsHmrcStatusSync(c));
    if (toSync.length === 0) return;

    const connection = await this.hmrcService.getStatus(tenantId);
    if (!connection?.arn) return;

    let accessToken: string;
    try {
      accessToken = await this.hmrcService.getValidAccessToken(tenantId);
    } catch (err) {
      this.logger.warn(`Skipping HMRC invitation sync for tenant ${tenantId}`, err);
      return;
    }

    await Promise.allSettled(
      toSync.map((client) =>
        this.syncOneInvitationFromHmrc(client, connection.arn!, accessToken, fraudContext),
      ),
    );
  }

  /** Fetches invitation status from HMRC and persists it on the client row. */
  private async syncOneInvitationFromHmrc(
    client: Client,
    arn: string,
    accessToken: string,
    fraudContext?: HmrcFraudRequestContext | null,
  ): Promise<void> {
    const url = `${this.hmrcBaseUrl}/agents/${arn}/invitations/${client.invitationId}`;

    const res = await this.hmrcApiClient.fetch(url, {
      accessToken,
      fraudContext,
      headers: { Accept: 'application/vnd.hmrc.1.0+json' },
    });

    const text = await res.text();
    if (!res.ok) {
      if (res.status === 403 || res.status === 404) {
        this.logger.warn(
          `HMRC invitation sync skipped for client ${client.id} (${res.status}): ${text}`,
        );
        return;
      }
      throw new Error(`HMRC returned ${res.status}: ${text}`);
    }

    let data: { status?: string };
    try {
      data = JSON.parse(text) as { status?: string };
    } catch {
      this.logger.warn(`HMRC returned non-JSON invitation status for client ${client.id}`);
      return;
    }
    const hmrcStatus = this.normalizeHmrcInvitationStatus(data.status ?? '');

    if (!hmrcStatus) {
      this.logger.warn(`HMRC returned empty invitation status for client ${client.id}`);
      return;
    }

    const previousStatus = client.invitationStatus;
    client.invitationStatus = hmrcStatus;
    await this.clientRepo.save(client);

    if (hmrcStatus === 'accepted' || hmrcStatus === 'partial-auth') {
      await this.syncRelationshipFromHmrc(client, arn, accessToken, fraudContext);

      // Fire notifications only on the first transition to accepted.
      if (previousStatus !== 'accepted' && previousStatus !== 'partial-auth') {
        await this.fireInvitationAcceptedNotifications(client).catch((err) => {
          this.logger.error(`Failed to send invite-accepted notification for ${client.id}`, err);
        });
      }
    }
  }

  /**
   * Creates an in-app notification and sends an email to the agent
   * when a client accepts the HMRC invitation.
   */
  private async fireInvitationAcceptedNotifications(client: Client): Promise<void> {
    const tenantId = client.tenantId;
    const tenant = await this.tenantRepo.findOne({ where: { id: tenantId } });
    if (!tenant) return;

    const prefs = await this.notifPrefsRepo.findOne({ where: { tenantId } });
    const inviteAccepted = prefs?.inviteAccepted ?? true;

    const clientName = client.name ?? 'Your client';
    const frontendUrl =
      this.configService.get<string>('app.frontendUrl') ?? 'http://localhost:3000';
    const clientUrl = `${frontendUrl}/clients/detail?id=${client.id}`;

    // Always create an in-app notification.
    await this.appNotificationsService.create({
      tenantId,
      type: 'invite_accepted',
      title: 'Invitation accepted',
      body: `${clientName} has accepted the HMRC authorisation invitation. You can now manage their MTD submissions.`,
      clientId: client.id,
    });

    // Send email only when the preference is enabled and the tenant has a contact email.
    if (inviteAccepted && tenant.contactEmail) {
      const agentName = tenant.contactName ?? tenant.contactEmail;
      await this.mailService.sendInvitationAcceptedEmail({
        to: tenant.contactEmail,
        agentName,
        firmName: tenant.firmName,
        clientName,
        clientUrl,
      });
    }
  }

  /** Best-effort relationship sync for accepted clients missing authorisedAt. */
  private async syncRelationshipsFromHmrc(
    tenantId: string,
    clients: Client[],
    fraudContext?: HmrcFraudRequestContext | null,
  ): Promise<void> {
    const needsCheck = clients.filter(
      (c) => ['accepted', 'partial-auth'].includes(c.invitationStatus) && !c.authorisedAt,
    );
    if (needsCheck.length === 0) return;

    const connection = await this.hmrcService.getStatus(tenantId);
    if (!connection?.arn) return;

    let accessToken: string;
    try {
      accessToken = await this.hmrcService.getValidAccessToken(tenantId);
    } catch (err) {
      this.logger.warn(`Skipping HMRC relationship sync for tenant ${tenantId}`, err);
      return;
    }

    await Promise.allSettled(
      needsCheck.map((client) =>
        this.syncRelationshipFromHmrc(client, connection.arn!, accessToken, fraudContext),
      ),
    );
  }

  private async verifyAndPersistRelationship(
    tenantId: string,
    client: Client,
    fraudContext?: HmrcFraudRequestContext | null,
  ): Promise<Client> {
    if (!['accepted', 'partial-auth'].includes(client.invitationStatus)) {
      return client;
    }

    const connection = await this.hmrcService.getStatus(tenantId);
    if (!connection?.arn) return client;

    let accessToken: string;
    try {
      accessToken = await this.hmrcService.getValidAccessToken(tenantId);
    } catch (err) {
      this.logger.warn(`Cannot verify relationship for client ${client.id}`, err);
      return client;
    }

    await this.syncRelationshipFromHmrc(client, connection.arn, accessToken, fraudContext);
    return this.findOne(tenantId, client.id);
  }

  /**
   * POST /agents/{arn}/relationships — returns true and sets authorisedAt when HMRC returns 204.
   */
  private async syncRelationshipFromHmrc(
    client: Client,
    arn: string,
    accessToken: string,
    fraudContext?: HmrcFraudRequestContext | null,
  ): Promise<boolean> {
    try {
      const result = await this.verifyHmrcRelationship(client, arn, accessToken, fraudContext);
      if (result === 'active') {
        if (!client.authorisedAt) {
          client.authorisedAt = new Date();
          await this.clientRepo.save(client);
          this.logger.log(`HMRC relationship active for client ${client.id}`);
          await this.clientPipelineService
            .markNotStarted(client.tenantId, client.id)
            .catch((err) => {
              this.logger.warn(
                `Pipeline not-started transition failed for ${client.id}: ${String(err)}`,
              );
            });
        }
        return true;
      }
      return false;
    } catch (err) {
      this.logger.warn(`HMRC relationship sync failed for client ${client.id}`, err);
      return false;
    }
  }

  private async verifyHmrcRelationship(
    client: Client,
    arn: string,
    accessToken: string,
    fraudContext?: HmrcFraudRequestContext | null,
  ): Promise<HmrcRelationshipResult> {
    const url = `${this.hmrcBaseUrl}/agents/${arn}/relationships`;

    const res = await this.hmrcApiClient.fetch(url, {
      method: 'POST',
      accessToken,
      fraudContext,
      headers: {
        'Content-Type': 'application/json',
        Accept: 'application/vnd.hmrc.1.0+json',
      },
      body: JSON.stringify({
        service: ['MTD-IT'],
        clientIdType: 'ni',
        clientId: client.nino,
        knownFact: client.postcode,
        agentType: client.agentType,
      }),
    });

    if (res.status === 204) return 'active';

    const text = await res.text();

    if (res.status === 404) {
      this.logger.debug(`HMRC relationship inactive for client ${client.id}: ${text}`);
      return 'inactive';
    }

    this.logger.warn(
      `HMRC relationship check unexpected response for client ${client.id} (${res.status}): ${text}`,
    );
    throw new BadRequestException(relationshipErrorToUserMessage(res.status, text));
  }

  private async findByNino(tenantId: string, nino: string): Promise<Client | null> {
    return this.clientRepo.findOne({ where: { tenantId, ninoHash: piiHash(nino) } });
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
    fraudContext?: HmrcFraudRequestContext | null;
    actingUserId?: string;
  }): Promise<CreateClientResult> {
    const {
      client,
      arn,
      accessToken,
      agentName,
      firmName,
      personalMessage,
      fraudContext,
      actingUserId,
    } = params;

    try {
      const invitationId = await this.createHmrcInvitation({
        arn,
        accessToken,
        nino: client.nino,
        postcode: client.postcode,
        agentType: client.agentType,
        fraudContext,
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
        .sendClientInvitationEmail(
          {
            to: client.email,
            clientName: client.name,
            agentName,
            firmName,
            personalMessage: personalMsg,
          },
          actingUserId,
        )
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
    fraudContext?: HmrcFraudRequestContext | null;
  }): Promise<string> {
    const { arn, accessToken, nino, postcode, agentType, fraudContext } = params;

    const res = await this.hmrcApiClient.fetch(`${this.hmrcBaseUrl}/agents/${arn}/invitations`, {
      method: 'POST',
      accessToken,
      fraudContext,
      headers: {
        'Content-Type': 'application/json',
        Accept: 'application/vnd.hmrc.1.0+json',
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

  // ─── Bulk CSV import ───────────────────────────────────────────────────────

  /**
   * Parses a CSV buffer, validates ALL rows, and — only if every row is valid —
   * creates all clients in a single DB transaction then sends HMRC invitations.
   */
  async bulkImport(
    tenantId: string,
    agentEmail: string,
    fileBuffer: Buffer,
    fraudContext?: HmrcFraudRequestContext | null,
  ): Promise<BulkImportSuccess> {
    // 1. Parse CSV
    let rows;
    try {
      rows = parseCsvBuffer(fileBuffer);
    } catch (err) {
      throw new BadRequestException(
        `Could not parse the CSV file. Make sure it matches the template format. (${(err as Error).message})`,
      );
    }

    if (rows.length === 0) {
      throw new BadRequestException('The uploaded file contains no data rows.');
    }

    if (rows.length > 200) {
      throw new BadRequestException(
        'A single import can contain at most 200 clients. Split the file and import in batches.',
      );
    }

    // 2. Load existing NINO hashes for this tenant (one DB query, not N)
    const existingClients = await this.clientRepo
      .createQueryBuilder('c')
      .select('c.nino_hash', 'ninoHash')
      .where('c.tenant_id = :tenantId', { tenantId })
      .getRawMany<{ ninoHash: string }>();
    const existingHashes = new Set(existingClients.map((c) => c.ninoHash));

    // 3. Validate all rows — reject the entire import if any errors exist
    const errors = validateRows(rows, existingHashes, piiHash);
    if (errors.length > 0) {
      throw new UnprocessableEntityException({ message: { valid: false, errors } });
    }

    // 4. Create all clients in a single transaction (no HMRC calls — invitations sent separately)
    let created = 0;
    const createdIds: string[] = [];

    await this.dataSource.transaction(async (manager) => {
      for (const row of rows) {
        const ninoClean = row.nino!.replace(/\s/g, '').toUpperCase();
        const client = manager.create(Client, {
          tenantId,
          name: row.name!.trim(),
          nino: ninoClean,
          ninoHash: piiHash(ninoClean),
          postcode: row.postcode!.trim().toUpperCase(),
          email: row.email!.trim(),
          phone: row.phone?.trim() || undefined,
          agentType: row.agent_type?.trim().toLowerCase() === 'supporting' ? 'supporting' : 'main',
          invitationStatus: 'pending',
          pipelineStatus: 'pending-invite',
        });
        const saved = await manager.save(Client, client);
        createdIds.push(saved.id);
        created++;
      }
    });

    for (const clientId of createdIds) {
      await this.clientPipelineService.recordInitialStatus(tenantId, clientId).catch((err) => {
        this.logger.warn(`Initial pipeline history failed for ${clientId}: ${String(err)}`);
      });
    }

    return {
      valid: true,
      created,
      invitationsSent: 0,
      warnings: [],
    };
  }

  /**
   * Aggregate Business Income Source Summary (BISS v3.0) across all businesses.
   *
   * 1. Lists all business income sources (Business Details v2.0 — already cached in BusinessesCard).
   * 2. Calls BISS for each business in parallel (one call per income source).
   * 3. Aggregates totalIncome, totalExpenses, netProfit, netLoss and returns per-business breakdown.
   *
   * Endpoint per business:
   *   GET /income-tax/income-sources/business-source-summary/{nino}/{taxYear}/{incomeSourceId}/{typeOfBusiness}
   */
  async getIncomeSummary(
    tenantId: string,
    clientId: string,
    taxYear?: string,
    fraudContext?: HmrcFraudRequestContext | null,
  ): Promise<IncomeSummaryResponse> {
    const client = await this.ensureClientAuthorisedForMtd(tenantId, clientId, fraudContext);
    const accessToken = await this.hmrcService.getValidAccessToken(tenantId);

    const resolvedTaxYear = taxYear ?? currentUkTaxYear();

    // 1. Fetch business list
    const businessListUrl =
      `${this.hmrcBaseUrl}/individuals/business/details/` +
      `${encodeURIComponent(client.nino)}/list`;

    const listRes = await this.fetchHmrcBusinessJson<{
      listOfBusinesses?: Array<{
        businessId: string;
        typeOfBusiness: string;
        tradingName?: string;
      }>;
    }>(businessListUrl, accessToken, fraudContext, businessErrorToUserMessage);

    const businesses = listRes.listOfBusinesses ?? [];

    // 2. Fetch BISS for each business in parallel; silently skip any that return 404/no-data
    const bissResults = await Promise.allSettled(
      businesses.map(async (biz) => {
        const typeOfBusiness = this.toBissTypeOfBusiness(biz.typeOfBusiness);
        if (!typeOfBusiness) return null; // skip unsupported types

        const url =
          `${this.hmrcBaseUrl}/income-tax/income-sources/business-source-summary/` +
          `${encodeURIComponent(client.nino)}/${encodeURIComponent(resolvedTaxYear)}/` +
          `${encodeURIComponent(biz.businessId)}/${encodeURIComponent(typeOfBusiness)}`;

        let res: Response;
        try {
          res = await this.hmrcApiClient.fetch(url, {
            accessToken,
            fraudContext,
            headers: {
              Accept: 'application/vnd.hmrc.3.0+json',
              ...this.sandboxStatefulHeaders(),
            },
          });
        } catch (err) {
          this.logger.warn(`BISS network error for business ${biz.businessId}`, err);
          return null;
        }

        if (res.status === 404) return null; // no submissions yet — treat as zero
        const text = await res.text();
        if (!res.ok) {
          this.logger.warn(`BISS ${res.status} for business ${biz.businessId}: ${text}`);
          return null;
        }

        try {
          const data = text ? (JSON.parse(text) as BissResponse) : null;
          return { biz, data };
        } catch {
          return null;
        }
      }),
    );

    // 3. Aggregate
    let totalIncome = 0;
    let totalExpenses = 0;
    let netProfit = 0;
    let netLoss = 0;
    const businessBreakdown: IncomeSummaryResponse['businesses'] = [];

    for (const result of bissResults) {
      if (result.status !== 'fulfilled' || !result.value) continue;
      const { biz, data } = result.value;
      if (!data) continue;

      const bizIncome = data.total?.income?.totalIncome ?? 0;
      const bizExpenses = data.total?.expenses?.totalExpenses ?? 0;
      const bizProfit = data.profit?.net ?? 0;
      const bizLoss = data.loss?.net ?? 0;

      totalIncome += bizIncome;
      totalExpenses += bizExpenses;
      netProfit += bizProfit;
      netLoss += bizLoss;

      businessBreakdown.push({
        businessId: biz.businessId,
        typeOfBusiness: biz.typeOfBusiness,
        tradingName: biz.tradingName,
        totalIncome: bizIncome,
        totalExpenses: bizExpenses,
        netProfit: bizProfit,
        netLoss: bizLoss,
      });
    }

    return {
      taxYear: resolvedTaxYear,
      totalIncome,
      totalExpenses,
      netProfit,
      netLoss,
      businesses: businessBreakdown,
    };
  }

  /** Maps HMRC business typeOfBusiness to the BISS API path segment. */
  private toBissTypeOfBusiness(type: string): string | null {
    const map: Record<string, string> = {
      'self-employment': 'self-employment',
      'uk-property': 'uk-property-non-fhl',
      'uk-property-non-fhl': 'uk-property-non-fhl',
      'uk-property-fhl': 'uk-property-fhl',
      'foreign-property': 'foreign-property',
      'foreign-property-fhl': 'foreign-property-fhl',
    };
    return map[type] ?? null;
  }

  /**
   * YTD totals (BISS v3.0) + per-period / cumulative submissions
   * (Self-Employment Business + Property Business APIs).
   */
  async getSubmittedFigures(
    tenantId: string,
    clientId: string,
    taxYear?: string,
    fraudContext?: HmrcFraudRequestContext | null,
  ): Promise<SubmittedFiguresResponse> {
    const summary = await this.getIncomeSummary(tenantId, clientId, taxYear, fraudContext);
    const client = await this.ensureClientAuthorisedForMtd(tenantId, clientId, fraudContext);
    const accessToken = await this.hmrcService.getValidAccessToken(tenantId);
    const resolvedTaxYear = summary.taxYear;
    const useCumulative = this.taxYearStartYear(resolvedTaxYear) >= 2025;

    const businesses = await this.listBusinessesLite(client.nino, accessToken, fraudContext);
    const periods: SubmittedPeriodFigure[] = [];

    for (const biz of businesses) {
      const bizPeriods = useCumulative
        ? await this.fetchCumulativePeriod(
            client.nino,
            biz,
            resolvedTaxYear,
            accessToken,
            fraudContext,
          )
        : await this.fetchLegacyPeriods(
            client.nino,
            biz,
            resolvedTaxYear,
            accessToken,
            fraudContext,
          );
      periods.push(...bizPeriods);
    }

    periods.sort((a, b) => (a.periodEndDate ?? '').localeCompare(b.periodEndDate ?? ''));

    // Relabel chronologically as Q1–Q4 when multiple non-cumulative periods exist
    const nonCumulative = periods.filter((p) => !p.cumulative);
    if (nonCumulative.length > 0) {
      nonCumulative.forEach((p, i) => {
        p.label = `Q${i + 1}`;
      });
    }

    let totalIncome = summary.totalIncome;
    let totalExpenses = summary.totalExpenses;
    let netProfit = summary.netProfit;
    let netLoss = summary.netLoss;

    // When BISS has no usable rows, fall back to sanitised period totals for the YTD header
    const bissEmpty = summary.businesses.length === 0 && totalIncome === 0 && totalExpenses === 0;
    if (bissEmpty && periods.length > 0) {
      totalIncome = periods.reduce((s, p) => s + p.income, 0);
      totalExpenses = periods.reduce((s, p) => s + p.expenses, 0);
      const net = totalIncome - totalExpenses;
      netProfit = net > 0 ? net : 0;
      netLoss = net < 0 ? Math.abs(net) : 0;
    }

    return {
      taxYear: resolvedTaxYear,
      totalIncome,
      totalExpenses,
      netProfit,
      netLoss,
      periods,
      businesses: summary.businesses,
    };
  }

  /**
   * UK Property Business (MTD) retrieve for one income source:
   * cumulative / period summaries + annual allowances and adjustments.
   */
  async getUkPropertyFigures(
    tenantId: string,
    clientId: string,
    businessId: string,
    taxYear?: string,
    fraudContext?: HmrcFraudRequestContext | null,
  ): Promise<UkPropertyFiguresResponse> {
    const client = await this.ensureClientAuthorisedForMtd(tenantId, clientId, fraudContext);
    const accessToken = await this.hmrcService.getValidAccessToken(tenantId);
    const resolvedTaxYear = taxYear ?? currentUkTaxYear();
    const businesses = await this.listBusinessesLite(client.nino, accessToken, fraudContext);
    const biz = businesses.find((b) => b.businessId === businessId);
    if (!biz || !this.isUkPropertyType(biz.typeOfBusiness)) {
      throw new BadRequestException('This HMRC business is not a UK property income source.');
    }

    const useCumulative = this.taxYearStartYear(resolvedTaxYear) >= 2025;
    let periods: SubmittedPeriodFigure[] = [];
    let fromDate: string | undefined;
    let toDate: string | undefined;
    let submittedOn: string | undefined;

    if (useCumulative) {
      const path = this.cumulativePathForBusiness(
        client.nino,
        biz.businessId,
        biz.typeOfBusiness,
        resolvedTaxYear,
      );
      const data = path
        ? await this.fetchHmrcPropertyOptionalJson<Record<string, unknown>>(
            `${this.hmrcBaseUrl}${path}`,
            accessToken,
            fraudContext,
          )
        : null;
      if (data) {
        const { income, expenses } = this.extractIncomeExpenses(data, biz.typeOfBusiness);
        fromDate = typeof data.fromDate === 'string' ? data.fromDate : undefined;
        toDate = typeof data.toDate === 'string' ? data.toDate : undefined;
        submittedOn = typeof data.submittedOn === 'string' ? data.submittedOn : undefined;
        periods = [
          {
            label: 'YTD cumulative',
            periodId: `${resolvedTaxYear}-cumulative`,
            periodStartDate: fromDate,
            periodEndDate: toDate,
            businessId: biz.businessId,
            typeOfBusiness: biz.typeOfBusiness,
            tradingName: biz.tradingName,
            income,
            expenses,
            net: income - expenses,
            cumulative: true,
          },
        ];
      }
    } else {
      periods = await this.fetchLegacyPeriods(
        client.nino,
        biz,
        resolvedTaxYear,
        accessToken,
        fraudContext,
      );
    }

    const ytd = periods.reduce(
      (acc, p) => ({
        income: acc.income + p.income,
        expenses: acc.expenses + p.expenses,
      }),
      { income: 0, expenses: 0 },
    );
    const annual = await this.fetchUkPropertyAnnual(
      client.nino,
      biz.businessId,
      resolvedTaxYear,
      accessToken,
      fraudContext,
    );

    return {
      taxYear: resolvedTaxYear,
      businessId: biz.businessId,
      typeOfBusiness: biz.typeOfBusiness,
      tradingName: biz.tradingName,
      fromDate: fromDate ?? periods[0]?.periodStartDate,
      toDate: toDate ?? periods[0]?.periodEndDate,
      submittedOn: submittedOn ?? annual?.submittedOn,
      income: ytd.income,
      expenses: ytd.expenses,
      net: ytd.income - ytd.expenses,
      periods,
      annual,
    };
  }

  /**
   * Retrieve SE cumulative period summary (2025-26+).
   * Sandbox with no HMRC data returns suggested test figures (not yet submitted).
   */
  async getSeCumulativePeriodSummary(
    tenantId: string,
    clientId: string,
    businessId: string,
    taxYear?: string,
    fraudContext?: HmrcFraudRequestContext | null,
  ): Promise<SeCumulativeSummaryResponse> {
    const { client, biz, resolvedTaxYear, accessToken } = await this.assertSeCumulativeContext(
      tenantId,
      clientId,
      businessId,
      taxYear,
      fraudContext,
    );

    const path = this.cumulativePathForBusiness(
      client.nino,
      biz.businessId,
      biz.typeOfBusiness,
      resolvedTaxYear,
    );
    const data = path
      ? await this.fetchHmrcOptionalJson<Record<string, unknown>>(
          `${this.hmrcBaseUrl}${path}`,
          accessToken,
          fraudContext,
          'application/vnd.hmrc.5.0+json',
        )
      : null;

    if (data) {
      const periodDates = (data.periodDates ?? {}) as {
        periodStartDate?: string;
        periodEndDate?: string;
      };
      const periodIncome = (data.periodIncome ?? {}) as {
        turnover?: number;
        other?: number;
      };
      const { income, expenses } = this.extractIncomeExpenses(data, 'self-employment');
      return {
        taxYear: resolvedTaxYear,
        businessId: biz.businessId,
        typeOfBusiness: biz.typeOfBusiness,
        tradingName: biz.tradingName,
        source: 'hmrc',
        periodDates:
          periodDates.periodStartDate && periodDates.periodEndDate
            ? {
                periodStartDate: periodDates.periodStartDate,
                periodEndDate: periodDates.periodEndDate,
              }
            : latestCompletedCumulativePeriod(resolvedTaxYear),
        periodIncome: {
          turnover: this.sanitizeHmrcAmount(periodIncome.turnover) ?? income,
          other: this.sanitizeHmrcAmount(periodIncome.other) ?? 0,
        },
        periodExpenses: { consolidatedExpenses: expenses },
        submittedOn: typeof data.submittedOn === 'string' ? data.submittedOn : undefined,
      };
    }

    const periodDates = latestCompletedCumulativePeriod(resolvedTaxYear);
    if (this.isHmrcSandbox()) {
      return {
        taxYear: resolvedTaxYear,
        businessId: biz.businessId,
        typeOfBusiness: biz.typeOfBusiness,
        tradingName: biz.tradingName,
        source: 'sandbox-test',
        periodDates,
        periodIncome: { turnover: 100, other: 0 },
        periodExpenses: { consolidatedExpenses: 25 },
      };
    }

    return {
      taxYear: resolvedTaxYear,
      businessId: biz.businessId,
      typeOfBusiness: biz.typeOfBusiness,
      tradingName: biz.tradingName,
      source: 'empty',
      periodDates,
      periodIncome: { turnover: 0, other: 0 },
      periodExpenses: { consolidatedExpenses: 0 },
    };
  }

  /**
   * Create or amend SE cumulative period summary (2025-26+).
   * PUT /individuals/business/self-employment/{nino}/{businessId}/cumulative/{taxYear}
   */
  async createOrAmendSeCumulativePeriodSummary(
    tenantId: string,
    clientId: string,
    businessId: string,
    taxYear: string,
    dto: CreateSeCumulativeDto,
    fraudContext?: HmrcFraudRequestContext | null,
  ): Promise<SeCumulativeSummaryResponse> {
    const { client, biz, resolvedTaxYear, accessToken } = await this.assertSeCumulativeContext(
      tenantId,
      clientId,
      businessId,
      taxYear,
      fraudContext,
    );

    const connection = await this.hmrcService.getStatus(tenantId);
    if (!connection?.scope?.includes('write:self-assessment')) {
      throw new BadRequestException(
        'Reconnect HMRC after adding write:self-assessment. That scope is required to submit cumulative figures.',
      );
    }

    if (this.taxYearStartYear(resolvedTaxYear) < 2025) {
      throw new BadRequestException(
        'Self-employment cumulative submit is only available for tax year 2025-26 or later.',
      );
    }

    const path = this.cumulativePathForBusiness(
      client.nino,
      biz.businessId,
      biz.typeOfBusiness,
      resolvedTaxYear,
    );
    if (!path) {
      throw new BadRequestException('This HMRC business is not a self-employment income source.');
    }

    const body = {
      periodDates: {
        periodStartDate: dto.periodDates.periodStartDate,
        periodEndDate: dto.periodDates.periodEndDate,
      },
      periodIncome: {
        turnover: dto.periodIncome.turnover,
        other: dto.periodIncome.other,
      },
      periodExpenses: {
        consolidatedExpenses: dto.periodExpenses.consolidatedExpenses,
      },
    };

    let res: Response;
    try {
      res = await this.hmrcApiClient.fetch(`${this.hmrcBaseUrl}${path}`, {
        method: 'PUT',
        accessToken,
        fraudContext,
        headers: {
          Accept: 'application/vnd.hmrc.5.0+json',
          'Content-Type': 'application/json',
          ...this.sandboxStatefulHeaders(),
        },
        body: JSON.stringify(body),
      });
    } catch (err) {
      this.logger.error(`SE cumulative PUT network error for ${clientId}`, err);
      throw new InternalServerErrorException('Failed to contact HMRC for self-employment submit.');
    }

    const text = await res.text();
    if (!res.ok) {
      this.logger.warn(`SE cumulative PUT ${res.status} for ${clientId}: ${text}`);
      throw new BadRequestException(seCumulativeErrorToUserMessage(res.status, text));
    }

    return this.getSeCumulativePeriodSummary(
      tenantId,
      clientId,
      businessId,
      resolvedTaxYear,
      fraudContext,
    );
  }

  /**
   * Retrieve UK property cumulative period summary (2025-26+).
   * Sandbox with no HMRC data returns suggested test figures (not yet submitted).
   */
  async getUkPropertyCumulativePeriodSummary(
    tenantId: string,
    clientId: string,
    businessId: string,
    taxYear?: string,
    fraudContext?: HmrcFraudRequestContext | null,
  ): Promise<UkPropertyCumulativeSummaryResponse> {
    const { client, biz, resolvedTaxYear, accessToken } =
      await this.assertUkPropertyCumulativeContext(
        tenantId,
        clientId,
        businessId,
        taxYear,
        fraudContext,
      );

    if (this.taxYearStartYear(resolvedTaxYear) < 2025) {
      throw new BadRequestException(
        'UK property cumulative submit is only available for tax year 2025-26 or later.',
      );
    }

    const path = this.cumulativePathForBusiness(
      client.nino,
      biz.businessId,
      biz.typeOfBusiness,
      resolvedTaxYear,
    );
    const data = path
      ? await this.fetchHmrcPropertyOptionalJson<Record<string, unknown>>(
          `${this.hmrcBaseUrl}${path}`,
          accessToken,
          fraudContext,
        )
      : null;

    const fallbackDates = latestCompletedCumulativePeriod(resolvedTaxYear);

    if (data) {
      const { income, expenses } = this.extractIncomeExpenses(data, biz.typeOfBusiness);
      const uk = (data.ukProperty ?? {}) as {
        income?: { periodAmount?: number };
        expenses?: { consolidatedExpenses?: number };
      };
      const periodAmount = this.sanitizeHmrcAmount(uk.income?.periodAmount) ?? income;
      const consolidatedExpenses =
        this.sanitizeHmrcAmount(uk.expenses?.consolidatedExpenses) ?? expenses;
      const submittedOn = typeof data.submittedOn === 'string' ? data.submittedOn : undefined;
      const periodStartDate =
        typeof data.fromDate === 'string' ? data.fromDate : fallbackDates.periodStartDate;
      const periodEndDate =
        typeof data.toDate === 'string' ? data.toDate : fallbackDates.periodEndDate;

      if (
        !submittedOn &&
        periodAmount === 0 &&
        consolidatedExpenses === 0 &&
        this.isHmrcSandbox()
      ) {
        return {
          taxYear: resolvedTaxYear,
          businessId: biz.businessId,
          typeOfBusiness: biz.typeOfBusiness,
          tradingName: biz.tradingName,
          source: 'sandbox-test',
          periodDates: fallbackDates,
          periodAmount: 100,
          consolidatedExpenses: 25,
        };
      }

      return {
        taxYear: resolvedTaxYear,
        businessId: biz.businessId,
        typeOfBusiness: biz.typeOfBusiness,
        tradingName: biz.tradingName,
        source: 'hmrc',
        periodDates: { periodStartDate, periodEndDate },
        periodAmount,
        consolidatedExpenses,
        submittedOn,
      };
    }

    if (this.isHmrcSandbox()) {
      return {
        taxYear: resolvedTaxYear,
        businessId: biz.businessId,
        typeOfBusiness: biz.typeOfBusiness,
        tradingName: biz.tradingName,
        source: 'sandbox-test',
        periodDates: fallbackDates,
        periodAmount: 100,
        consolidatedExpenses: 25,
      };
    }

    return {
      taxYear: resolvedTaxYear,
      businessId: biz.businessId,
      typeOfBusiness: biz.typeOfBusiness,
      tradingName: biz.tradingName,
      source: 'empty',
      periodDates: fallbackDates,
      periodAmount: 0,
      consolidatedExpenses: 0,
    };
  }

  /**
   * Create or amend UK property cumulative period summary (2025-26+).
   * PUT /individuals/business/property/uk/{nino}/{businessId}/cumulative/{taxYear}
   */
  async createOrAmendUkPropertyCumulativePeriodSummary(
    tenantId: string,
    clientId: string,
    businessId: string,
    taxYear: string,
    dto: CreateUkPropertyCumulativeDto,
    fraudContext?: HmrcFraudRequestContext | null,
  ): Promise<UkPropertyCumulativeSummaryResponse> {
    const { client, biz, resolvedTaxYear, accessToken } =
      await this.assertUkPropertyCumulativeContext(
        tenantId,
        clientId,
        businessId,
        taxYear,
        fraudContext,
      );

    const connection = await this.hmrcService.getStatus(tenantId);
    if (!connection?.scope?.includes('write:self-assessment')) {
      throw new BadRequestException(
        'Reconnect HMRC after adding write:self-assessment. That scope is required to submit cumulative figures.',
      );
    }

    if (this.taxYearStartYear(resolvedTaxYear) < 2025) {
      throw new BadRequestException(
        'UK property cumulative submit is only available for tax year 2025-26 or later.',
      );
    }

    const path = this.cumulativePathForBusiness(
      client.nino,
      biz.businessId,
      biz.typeOfBusiness,
      resolvedTaxYear,
    );
    if (!path) {
      throw new BadRequestException('This HMRC business is not a UK property income source.');
    }

    const body = {
      fromDate: dto.fromDate,
      toDate: dto.toDate,
      ukProperty: {
        income: { periodAmount: dto.periodAmount },
        expenses: { consolidatedExpenses: dto.consolidatedExpenses },
      },
    };

    let res: Response;
    try {
      res = await this.hmrcApiClient.fetch(`${this.hmrcBaseUrl}${path}`, {
        method: 'PUT',
        accessToken,
        fraudContext,
        headers: {
          Accept: 'application/vnd.hmrc.6.0+json',
          'Content-Type': 'application/json',
          ...this.sandboxStatefulHeaders(),
        },
        body: JSON.stringify(body),
      });
    } catch (err) {
      this.logger.error(`UK property cumulative PUT network error for ${clientId}`, err);
      throw new InternalServerErrorException('Failed to contact HMRC for UK property submit.');
    }

    const text = await res.text();
    if (!res.ok) {
      this.logger.warn(`UK property cumulative PUT ${res.status} for ${clientId}: ${text}`);
      throw new BadRequestException(propertyCumulativeErrorToUserMessage(res.status, text));
    }

    return this.getUkPropertyCumulativePeriodSummary(
      tenantId,
      clientId,
      businessId,
      resolvedTaxYear,
      fraudContext,
    );
  }

  private async assertSeCumulativeContext(
    tenantId: string,
    clientId: string,
    businessId: string,
    taxYear: string | undefined,
    fraudContext?: HmrcFraudRequestContext | null,
  ) {
    const client = await this.ensureClientAuthorisedForMtd(tenantId, clientId, fraudContext);
    const accessToken = await this.hmrcService.getValidAccessToken(tenantId);
    const resolvedTaxYear = normalizeTaxYear(taxYear ?? currentUkTaxYear());
    const businesses = await this.listBusinessesLite(client.nino, accessToken, fraudContext);
    const biz = businesses.find((b) => b.businessId === businessId);
    if (!biz || biz.typeOfBusiness !== 'self-employment') {
      throw new BadRequestException('This HMRC business is not a self-employment income source.');
    }
    return { client, biz, resolvedTaxYear, accessToken };
  }

  private async assertUkPropertyCumulativeContext(
    tenantId: string,
    clientId: string,
    businessId: string,
    taxYear: string | undefined,
    fraudContext?: HmrcFraudRequestContext | null,
  ) {
    const client = await this.ensureClientAuthorisedForMtd(tenantId, clientId, fraudContext);
    const accessToken = await this.hmrcService.getValidAccessToken(tenantId);
    const resolvedTaxYear = normalizeTaxYear(taxYear ?? currentUkTaxYear());
    const businesses = await this.listBusinessesLite(client.nino, accessToken, fraudContext);
    const biz = businesses.find((b) => b.businessId === businessId);
    if (!biz || !this.isUkPropertyType(biz.typeOfBusiness)) {
      throw new BadRequestException('This HMRC business is not a UK property income source.');
    }
    return { client, biz, resolvedTaxYear, accessToken };
  }

  private isUkPropertyType(typeOfBusiness: string): boolean {
    return typeOfBusiness === 'uk-property' || typeOfBusiness.startsWith('uk-property');
  }

  private async fetchUkPropertyAnnual(
    nino: string,
    businessId: string,
    taxYear: string,
    accessToken: string,
    fraudContext?: HmrcFraudRequestContext | null,
  ): Promise<UkPropertyAnnualSubmission | null> {
    const url =
      `${this.hmrcBaseUrl}/individuals/business/property/uk/` +
      `${encodeURIComponent(nino)}/${encodeURIComponent(businessId)}/annual/` +
      `${encodeURIComponent(taxYear)}`;
    return this.fetchHmrcPropertyOptionalJson<UkPropertyAnnualSubmission>(
      url,
      accessToken,
      fraudContext,
    );
  }

  private taxYearStartYear(taxYear: string): number {
    return parseInt(taxYear.split('-')[0] ?? '0', 10);
  }

  private async listBusinessesLite(
    nino: string,
    accessToken: string,
    fraudContext?: HmrcFraudRequestContext | null,
  ): Promise<Array<{ businessId: string; typeOfBusiness: string; tradingName?: string }>> {
    const url =
      `${this.hmrcBaseUrl}/individuals/business/details/` + `${encodeURIComponent(nino)}/list`;
    const listRes = await this.fetchHmrcBusinessJson<{
      listOfBusinesses?: Array<{
        businessId: string;
        typeOfBusiness: string;
        tradingName?: string;
      }>;
    }>(url, accessToken, fraudContext, businessErrorToUserMessage);
    return listRes.listOfBusinesses ?? [];
  }

  private async fetchCumulativePeriod(
    nino: string,
    biz: { businessId: string; typeOfBusiness: string; tradingName?: string },
    taxYear: string,
    accessToken: string,
    fraudContext?: HmrcFraudRequestContext | null,
  ): Promise<SubmittedPeriodFigure[]> {
    const path = this.cumulativePathForBusiness(nino, biz.businessId, biz.typeOfBusiness, taxYear);
    if (!path) return [];

    const accepts =
      biz.typeOfBusiness === 'self-employment'
        ? ['application/vnd.hmrc.5.0+json', 'application/vnd.hmrc.4.0+json']
        : ['application/vnd.hmrc.6.0+json', 'application/vnd.hmrc.5.0+json'];

    const data = await this.fetchHmrcOptionalJsonWithFallback<Record<string, unknown>>(
      `${this.hmrcBaseUrl}${path}`,
      accessToken,
      fraudContext,
      accepts,
    );
    if (!data) return [];

    const { income, expenses } = this.extractIncomeExpenses(data, biz.typeOfBusiness);
    // Skip sandbox-only payloads that sanitise down to empty figures
    if (income === 0 && expenses === 0) return [];

    return [
      {
        label: 'YTD cumulative',
        periodId: `${taxYear}-cumulative`,
        businessId: biz.businessId,
        typeOfBusiness: biz.typeOfBusiness,
        tradingName: biz.tradingName,
        income,
        expenses,
        net: income - expenses,
        cumulative: true,
      },
    ];
  }

  private async fetchLegacyPeriods(
    nino: string,
    biz: { businessId: string; typeOfBusiness: string; tradingName?: string },
    taxYear: string,
    accessToken: string,
    fraudContext?: HmrcFraudRequestContext | null,
  ): Promise<SubmittedPeriodFigure[]> {
    if (biz.typeOfBusiness === 'self-employment') {
      const listUrl =
        `${this.hmrcBaseUrl}/individuals/business/self-employment/` +
        `${encodeURIComponent(nino)}/${encodeURIComponent(biz.businessId)}/period/` +
        `${encodeURIComponent(taxYear)}`;
      const seAccepts = ['application/vnd.hmrc.5.0+json', 'application/vnd.hmrc.4.0+json'];
      const list = await this.fetchHmrcOptionalJsonWithFallback<{
        periods?: Array<{ periodId: string; periodStartDate?: string; periodEndDate?: string }>;
      }>(listUrl, accessToken, fraudContext, seAccepts);

      const periods = list?.periods ?? [];
      const out: SubmittedPeriodFigure[] = [];
      for (const p of periods) {
        const detailUrl =
          `${this.hmrcBaseUrl}/individuals/business/self-employment/` +
          `${encodeURIComponent(nino)}/${encodeURIComponent(biz.businessId)}/period/` +
          `${encodeURIComponent(taxYear)}/${encodeURIComponent(p.periodId)}`;
        const detail = await this.fetchHmrcOptionalJsonWithFallback<Record<string, unknown>>(
          detailUrl,
          accessToken,
          fraudContext,
          seAccepts,
        );
        if (!detail) continue;
        const { income, expenses } = this.extractIncomeExpenses(detail, 'self-employment');
        if (income === 0 && expenses === 0) continue;
        out.push({
          label: p.periodId,
          periodId: p.periodId,
          periodStartDate: p.periodStartDate,
          periodEndDate: p.periodEndDate,
          businessId: biz.businessId,
          typeOfBusiness: biz.typeOfBusiness,
          tradingName: biz.tradingName,
          income,
          expenses,
          net: income - expenses,
        });
      }
      return out;
    }

    // Property (UK / foreign) — list then retrieve
    const listUrl =
      `${this.hmrcBaseUrl}/individuals/business/property/` +
      `${encodeURIComponent(nino)}/${encodeURIComponent(biz.businessId)}/period/` +
      `${encodeURIComponent(taxYear)}`;
    const propAccepts = ['application/vnd.hmrc.6.0+json', 'application/vnd.hmrc.5.0+json'];
    const list = await this.fetchHmrcOptionalJsonWithFallback<{
      submissions?: Array<{
        submissionId: string;
        fromDate?: string;
        toDate?: string;
      }>;
      periods?: Array<{
        submissionId?: string;
        periodId?: string;
        fromDate?: string;
        toDate?: string;
        periodStartDate?: string;
        periodEndDate?: string;
      }>;
    }>(listUrl, accessToken, fraudContext, propAccepts);

    const entries =
      list?.submissions ??
      list?.periods?.map((p) => ({
        submissionId: p.submissionId ?? p.periodId ?? '',
        fromDate: p.fromDate ?? p.periodStartDate,
        toDate: p.toDate ?? p.periodEndDate,
      })) ??
      [];

    const isForeign = biz.typeOfBusiness.startsWith('foreign-property');
    const propertySegment = isForeign ? 'foreign' : 'uk';
    const out: SubmittedPeriodFigure[] = [];

    for (const p of entries) {
      if (!p.submissionId) continue;
      const detailUrl =
        `${this.hmrcBaseUrl}/individuals/business/property/${propertySegment}/` +
        `${encodeURIComponent(nino)}/${encodeURIComponent(biz.businessId)}/period/` +
        `${encodeURIComponent(taxYear)}/${encodeURIComponent(p.submissionId)}`;
      const detail = await this.fetchHmrcOptionalJsonWithFallback<Record<string, unknown>>(
        detailUrl,
        accessToken,
        fraudContext,
        propAccepts,
      );
      if (!detail) continue;
      const { income, expenses } = this.extractIncomeExpenses(detail, biz.typeOfBusiness);
      if (income === 0 && expenses === 0) continue;
      out.push({
        label: p.submissionId,
        periodId: p.submissionId,
        periodStartDate: p.fromDate,
        periodEndDate: p.toDate,
        businessId: biz.businessId,
        typeOfBusiness: biz.typeOfBusiness,
        tradingName: biz.tradingName,
        income,
        expenses,
        net: income - expenses,
      });
    }
    return out;
  }

  private cumulativePathForBusiness(
    nino: string,
    businessId: string,
    typeOfBusiness: string,
    taxYear: string,
  ): string | null {
    const n = encodeURIComponent(nino);
    const b = encodeURIComponent(businessId);
    const t = encodeURIComponent(taxYear);
    if (typeOfBusiness === 'self-employment') {
      return `/individuals/business/self-employment/${n}/${b}/cumulative/${t}`;
    }
    if (typeOfBusiness.startsWith('uk-property') || typeOfBusiness === 'uk-property') {
      return `/individuals/business/property/uk/${n}/${b}/cumulative/${t}`;
    }
    if (typeOfBusiness.startsWith('foreign-property')) {
      return `/individuals/business/property/foreign/${n}/${b}/cumulative/${t}`;
    }
    return null;
  }

  private extractIncomeExpenses(
    data: Record<string, unknown>,
    typeOfBusiness: string,
  ): { income: number; expenses: number } {
    if (typeOfBusiness === 'self-employment') {
      const periodIncome = (data.periodIncome ?? {}) as Record<string, number | undefined>;
      const periodExpenses = (data.periodExpenses ?? {}) as Record<string, number | undefined>;
      const income =
        (this.sanitizeHmrcAmount(periodIncome.turnover) ?? 0) +
        (this.sanitizeHmrcAmount(periodIncome.other) ?? 0);
      return { income, expenses: this.sumExpenseFields(periodExpenses) };
    }

    const uk = (data.ukProperty ?? data.ukFhlProperty ?? data.ukNonFhlProperty ?? data) as Record<
      string,
      unknown
    >;
    const incomeObj = (uk.income ?? data.income ?? {}) as Record<string, unknown>;
    const expensesObj = (uk.expenses ?? data.expenses ?? {}) as Record<string, unknown>;
    return {
      income: this.sumPropertyIncome(incomeObj),
      expenses: this.sumPropertyExpenses(expensesObj),
    };
  }

  private sumPropertyIncome(income: Record<string, unknown>): number {
    const rentARoom = (income.rentARoom ?? {}) as Record<string, unknown>;
    return (
      (this.sanitizeHmrcAmount(this.asNumber(income.periodAmount)) ?? 0) +
      (this.sanitizeHmrcAmount(this.asNumber(income.premiumsOfLeaseGrant)) ?? 0) +
      (this.sanitizeHmrcAmount(this.asNumber(income.reversePremiums)) ?? 0) +
      (this.sanitizeHmrcAmount(this.asNumber(income.otherIncome)) ?? 0) +
      (this.sanitizeHmrcAmount(this.asNumber(rentARoom.rentsReceived)) ?? 0)
    );
  }

  private sumPropertyExpenses(expenses: Record<string, unknown>): number {
    const consolidated = this.sanitizeHmrcAmount(this.asNumber(expenses.consolidatedExpenses));
    if (consolidated != null) return consolidated;
    const rentARoom = (expenses.rentARoom ?? {}) as Record<string, unknown>;
    const rest = { ...expenses };
    delete rest.consolidatedExpenses;
    delete rest.rentARoom;
    return (
      this.sumNumericFields(rest as Record<string, number | undefined>) +
      (this.sanitizeHmrcAmount(this.asNumber(rentARoom.amountClaimed)) ?? 0)
    );
  }

  private asNumber(value: unknown): number | undefined {
    return typeof value === 'number' ? value : undefined;
  }

  /** HMRC sandbox often returns ±99999999999.99 as a placeholder — treat as missing. */
  private sanitizeHmrcAmount(value?: number | null): number | null {
    if (value == null || Number.isNaN(value)) return null;
    if (Math.abs(value) >= 99999999999) return null;
    return value;
  }

  private sumExpenseFields(expenses: Record<string, number | undefined>): number {
    const consolidated = this.sanitizeHmrcAmount(expenses.consolidatedExpenses);
    if (consolidated != null) return consolidated;
    return this.sumNumericFields(expenses);
  }

  private sumNumericFields(obj: Record<string, number | undefined>): number {
    return Object.values(obj).reduce<number>((sum, v) => {
      const n = this.sanitizeHmrcAmount(v);
      return sum + (n ?? 0);
    }, 0);
  }

  /** Try Accept versions in order; return null if all fail. */
  private async fetchHmrcOptionalJsonWithFallback<T>(
    url: string,
    accessToken: string,
    fraudContext: HmrcFraudRequestContext | null | undefined,
    accepts: string[],
  ): Promise<T | null> {
    for (const accept of accepts) {
      const data = await this.fetchHmrcOptionalJson<T>(url, accessToken, fraudContext, accept);
      if (data) return data;
    }
    return null;
  }

  /** GET that returns null on 404 / empty — used for optional HMRC period data. */
  private async fetchHmrcOptionalJson<T>(
    url: string,
    accessToken: string,
    fraudContext: HmrcFraudRequestContext | null | undefined,
    accept: string,
  ): Promise<T | null> {
    let res: Response;
    try {
      res = await this.hmrcApiClient.fetch(url, {
        accessToken,
        fraudContext,
        headers: {
          Accept: accept,
          ...this.sandboxStatefulHeaders(),
        },
      });
    } catch (err) {
      this.logger.warn(`HMRC optional fetch network error: ${url}`, err);
      return null;
    }

    if (res.status === 404) return null;
    const text = await res.text();
    if (!res.ok) {
      this.logger.warn(`HMRC optional fetch ${res.status}: ${url} — ${text}`);
      return null;
    }
    if (!text) return null;
    try {
      return JSON.parse(text) as T;
    } catch {
      return null;
    }
  }

  /**
   * Property Business GET: 404 = no data yet; 403/other errors are raised so the UI
   * can tell the agent to subscribe the API.
   */
  private async fetchHmrcPropertyOptionalJson<T>(
    url: string,
    accessToken: string,
    fraudContext: HmrcFraudRequestContext | null | undefined,
  ): Promise<T | null> {
    let res: Response;
    try {
      res = await this.hmrcApiClient.fetch(url, {
        accessToken,
        fraudContext,
        headers: {
          Accept: 'application/vnd.hmrc.6.0+json',
          ...this.sandboxStatefulHeaders(),
        },
      });
    } catch (err) {
      this.logger.error(`HMRC Property Business network error: ${url}`, err);
      throw new InternalServerErrorException('Failed to contact HMRC for UK property figures.');
    }

    if (res.status === 404) return null;
    const text = await res.text();
    if (!res.ok) {
      this.logger.warn(`HMRC Property Business ${res.status}: ${text}`);
      throw new BadRequestException(propertyErrorToUserMessage(res.status, text));
    }
    if (!text) return null;
    try {
      return JSON.parse(text) as T;
    } catch {
      throw new InternalServerErrorException('HMRC returned invalid JSON for UK property figures.');
    }
  }

  // ── Client Notes ────────────────────────────────────────────────────────────

  async getNotes(
    tenantId: string,
    clientId: string,
    actor?: RequestUser | null,
  ): Promise<ClientNote[]> {
    await this.assertClientBelongsToTenant(tenantId, clientId, actor);
    return this.clientNoteRepo.find({
      where: { tenantId, clientId },
      order: { isPinned: 'DESC', createdAt: 'DESC' },
    });
  }

  async createNote(
    tenantId: string,
    clientId: string,
    text: string,
    authorName: string,
    actor?: RequestUser | null,
  ): Promise<ClientNote> {
    await this.assertClientBelongsToTenant(tenantId, clientId, actor);
    const note = this.clientNoteRepo.create({
      tenantId,
      clientId,
      text,
      authorName,
      isPinned: false,
    });
    return this.clientNoteRepo.save(note);
  }

  async updateNote(
    tenantId: string,
    clientId: string,
    noteId: string,
    patch: { text?: string; isPinned?: boolean },
    actor?: RequestUser | null,
  ): Promise<ClientNote> {
    await this.assertClientBelongsToTenant(tenantId, clientId, actor);
    const note = await this.clientNoteRepo.findOne({ where: { id: noteId, tenantId, clientId } });
    if (!note) throw new NotFoundException('Note not found');
    if (patch.text !== undefined) note.text = patch.text;
    if (patch.isPinned !== undefined) note.isPinned = patch.isPinned;
    return this.clientNoteRepo.save(note);
  }

  async deleteNote(
    tenantId: string,
    clientId: string,
    noteId: string,
    actor?: RequestUser | null,
  ): Promise<void> {
    await this.assertClientBelongsToTenant(tenantId, clientId, actor);
    const note = await this.clientNoteRepo.findOne({ where: { id: noteId, tenantId, clientId } });
    if (!note) throw new NotFoundException('Note not found');
    await this.clientNoteRepo.softDelete(noteId);
  }

  private async assertClientBelongsToTenant(
    tenantId: string,
    clientId: string,
    actor?: RequestUser | null,
  ): Promise<void> {
    const exists = await this.clientRepo.existsBy(
      staffClientWhere(tenantId, actor, { id: clientId }),
    );
    if (!exists) throw new NotFoundException('Client not found');
  }
}
