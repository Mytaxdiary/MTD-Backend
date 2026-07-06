import {
  Injectable,
  Logger,
  BadRequestException,
  ConflictException,
  NotFoundException,
  InternalServerErrorException,
  UnprocessableEntityException,
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
  PaymentsAndAllocationsResponse,
} from './hmrc-accounts.types';
import type { GetBalanceAndTransactionsQueryDto } from './dto/get-balance-and-transactions-query.dto';
import { defaultAccountsDateRange } from './dto/get-balance-and-transactions-query.dto';
import type { GetPaymentsAndAllocationsQueryDto } from './dto/get-payments-and-allocations-query.dto';
import { defaultPaymentsDateRange } from './dto/get-payments-and-allocations-query.dto';
import { accountsErrorToUserMessage } from './hmrc-accounts-errors.util';
import { normalizeTaxYear } from './tax-year.util';
import { piiHash } from '../../common/utils/pii-hash.util';
import { AppNotificationsService } from '../app-notifications/app-notifications.service';
import { PortalService } from '../client-portal/portal.service';
import { NotificationPreferences } from '../tenants/entities/notification-preferences.entity';

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
    private readonly configService: ConfigService,
    private readonly hmrcService: HmrcService,
    private readonly hmrcApiClient: HmrcApiClient,
    private readonly mailService: MailService,
    private readonly appNotificationsService: AppNotificationsService,
    private readonly portalService: PortalService,
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

    // Create portal account + send invite email (fire-and-forget — never blocks client creation)
    void this.portalService.createAndInvite(tenantId, client.id, dto.email, dto.name).catch((err) =>
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
    });
  }

  /** Resend HMRC invitation for an existing client (e.g. after ARN fix or failed first attempt). */
  async resendInvitation(
    tenantId: string,
    clientId: string,
    agentEmail: string,
    personalMessage?: string,
    fraudContext?: HmrcFraudRequestContext | null,
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
    });
  }

  async findAll(
    tenantId: string,
    query: ListClientsQueryDto = {},
    fraudContext?: HmrcFraudRequestContext | null,
  ): Promise<{ clients: Client[]; total: number; page: number; limit: number; totalPages: number }> {
    const page  = Math.max(1, Number(query.page)  || 1);
    const limit = Math.min(100, Math.max(1, Number(query.limit) || 20));
    const status = query.status ?? 'all';
    const search = (query.search ?? '').trim().toLowerCase();

    // Build DB WHERE — status filter applied at query level
    const base: FindOptionsWhere<Client> = { tenantId };
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
        (c) =>
          c.name.toLowerCase().includes(search) ||
          c.nino.toLowerCase().includes(search),
      );
    }

    const total      = all.length;
    const totalPages = Math.max(1, Math.ceil(total / limit));
    const safePage   = Math.min(page, totalPages);
    const offset     = (safePage - 1) * limit;

    return {
      clients: all.slice(offset, offset + limit),
      total,
      page: safePage,
      limit,
      totalPages,
    };
  }

  /** Clients with an HMRC invitation awaiting acceptance (sandbox / live pending). */
  async findOutstandingInvitations(
    tenantId: string,
    fraudContext?: HmrcFraudRequestContext | null,
  ): Promise<Client[]> {
    const clients = await this.clientRepo.find({
      where: { tenantId, invitationStatus: 'pending' },
      order: { invitationSentAt: 'DESC' },
    });
    const withInvite = clients.filter((c) => !!c.invitationId);
    await this.syncInvitationStatusesFromHmrc(tenantId, withInvite, fraudContext);
    const refreshed = await this.clientRepo.find({
      where: { tenantId, invitationStatus: 'pending' },
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

  async findOne(tenantId: string, id: string): Promise<Client> {
    const client = await this.clientRepo.findOne({ where: { id, tenantId } });
    if (!client) throw new NotFoundException('Client not found');
    return client;
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

  // ─── Private helpers ──────────────────────────────────────────────────────

  private async fetchHmrcAccountsJson<T>(
    url: string,
    accessToken: string,
    fraudContext: HmrcFraudRequestContext | null | undefined,
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
      throw new BadRequestException(accountsErrorToUserMessage(res.status, text));
    }

    try {
      return text ? (JSON.parse(text) as T) : ({} as T);
    } catch {
      throw new InternalServerErrorException('HMRC returned invalid JSON for account transactions.');
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
        headers: { Accept: 'application/vnd.hmrc.2.0+json' },
      });
    } catch (err) {
      this.logger.error(`HMRC business details network error: ${url}`, err);
      throw new InternalServerErrorException('Failed to contact HMRC for business details.');
    }

    const text = await res.text();
    if (!res.ok) {
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
      (c) =>
        ['accepted', 'partial-auth'].includes(c.invitationStatus) && !c.authorisedAt,
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
      const result = await this.verifyHmrcRelationship(
        client,
        arn,
        accessToken,
        fraudContext,
      );
      if (result === 'active') {
        if (!client.authorisedAt) {
          client.authorisedAt = new Date();
          await this.clientRepo.save(client);
          this.logger.log(`HMRC relationship active for client ${client.id}`);
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
      headers: { 'Content-Type': 'application/json' },
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
  }): Promise<CreateClientResult> {
    const { client, arn, accessToken, agentName, firmName, personalMessage, fraudContext } =
      params;

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
    fraudContext?: HmrcFraudRequestContext | null;
  }): Promise<string> {
    const { arn, accessToken, nino, postcode, agentType, fraudContext } = params;

    const res = await this.hmrcApiClient.fetch(`${this.hmrcBaseUrl}/agents/${arn}/invitations`, {
      method: 'POST',
      accessToken,
      fraudContext,
      headers: { 'Content-Type': 'application/json' },
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
      throw new BadRequestException('A single import can contain at most 200 clients. Split the file and import in batches.');
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
        });
        await manager.save(Client, client);
        created++;
      }
    });

    return {
      valid: true,
      created,
      invitationsSent: 0,
      warnings: [],
    };
  }
}
