import {
  BadRequestException,
  Injectable,
  Logger,
  NotFoundException,
  UnauthorizedException,
} from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { ConfigService } from '@nestjs/config';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, IsNull, In } from 'typeorm';
import * as crypto from 'crypto';
import * as fs from 'fs';
import * as path from 'path';
import { ClientUser } from './entities/client-user.entity';
import { PortalMessage } from './entities/portal-message.entity';
import { PortalFile } from './entities/portal-file.entity';
import { Client } from '../clients/entities/client.entity';
import { Tenant } from '../tenants/entities/tenant.entity';
import { HmrcService } from '../hmrc/hmrc.service';
import { HmrcApiClient } from '../hmrc/hmrc-api.client';
import { MailService } from '../mail/mail.service';
import { hashPassword, comparePassword } from '../../common/helpers/crypto.helper';
import type { PortalJwtPayload } from './strategies/portal-jwt.strategy';
import type { PortalSetupDto } from './dto/portal-setup.dto';
import type { PortalLoginDto } from './dto/portal-login.dto';
import type { SendPortalMessageDto } from './dto/send-portal-message.dto';
import type { ClientPortalReplyDto } from './dto/client-portal-reply.dto';
import { AppNotificationsService } from '../app-notifications/app-notifications.service';
import type {
  BalanceAndTransactionsResponse,
  HmrcAccountDocumentDetail,
} from '../clients/hmrc-accounts.types';

const UPLOAD_BASE_DIR = path.join(process.cwd(), 'uploads', 'portal-files');
const MAX_FILE_SIZE_BYTES = 10 * 1024 * 1024; // 10 MB
const ALLOWED_MIME_TYPES = new Set([
  'application/pdf',
  'image/jpeg',
  'image/png',
  'image/gif',
  'image/webp',
  'text/csv',
  'application/vnd.ms-excel',
  'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  'application/msword',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  'application/zip',
  'text/plain',
]);

const PORTAL_COOKIE = 'mtd_cp_at';
const SETUP_TOKEN_EXPIRY_DAYS = 7;
const ACCESS_TOKEN_EXPIRY = '24h';

export type PortalCustomerRow = {
  id: string;
  name: string;
  email: string;
  portalOnly: boolean;
  portalActive: boolean;
  invitedAt: string;
  lastLoginAt: string | null;
  setupPending: boolean;
};

/**
 * Produces a deterministic HMAC-SHA256 hex digest of a normalised email.
 * Used as a fast, indexed lookup column so we avoid loading every client_user
 * row just to find one by email (which is encrypted with a random IV).
 *
 * The secret defaults to the JWT secret if EMAIL_HASH_SECRET is not set.
 */
function hashEmail(email: string, secret: string): string {
  return crypto.createHmac('sha256', secret).update(email.toLowerCase().trim()).digest('hex');
}

@Injectable()
export class PortalService {
  private readonly logger = new Logger(PortalService.name);

  constructor(
    @InjectRepository(ClientUser)
    private readonly clientUserRepo: Repository<ClientUser>,
    @InjectRepository(PortalMessage)
    private readonly portalMsgRepo: Repository<PortalMessage>,
    @InjectRepository(PortalFile)
    private readonly portalFileRepo: Repository<PortalFile>,
    @InjectRepository(Client)
    private readonly clientRepo: Repository<Client>,
    @InjectRepository(Tenant)
    private readonly tenantRepo: Repository<Tenant>,
    private readonly jwtService: JwtService,
    private readonly configService: ConfigService,
    private readonly hmrcService: HmrcService,
    private readonly hmrcApiClient: HmrcApiClient,
    private readonly mailService: MailService,
    private readonly appNotificationsService: AppNotificationsService,
  ) {}

  // ── Invite / Setup ─────────────────────────────────────────────────────────

  /**
   * Called when the agent creates a client.
   * Creates a ClientUser record and sends a portal setup email.
   */
  async createAndInvite(
    tenantId: string,
    clientId: string,
    clientEmail: string,
    clientName: string,
    actingUserId?: string,
  ): Promise<void> {
    // Upsert — avoid duplicate if already exists (e.g. re-invite)
    let cu = await this.clientUserRepo.findOne({ where: { clientId } });
    const frontendUrl =
      this.configService.get<string>('app.frontendUrl') ?? 'http://localhost:3000';
    const tenant = await this.tenantRepo.findOne({ where: { id: tenantId } });
    const firmName = tenant?.firmName ?? 'Your accountancy firm';

    const setupToken = crypto.randomBytes(32).toString('hex');
    const expiresAt = new Date(Date.now() + SETUP_TOKEN_EXPIRY_DAYS * 24 * 60 * 60 * 1000);

    const emailSecret = this.emailHashSecret();

    if (!cu) {
      cu = this.clientUserRepo.create({
        tenantId,
        clientId,
        email: clientEmail,
        emailHash: hashEmail(clientEmail, emailSecret),
        isActive: false,
        portalSetupToken: setupToken,
        portalSetupTokenExpiresAt: expiresAt,
      });
    } else {
      // Refresh token so client can re-use the link
      cu.emailHash = hashEmail(clientEmail, emailSecret);
      cu.portalSetupToken = setupToken;
      cu.portalSetupTokenExpiresAt = expiresAt;
    }
    await this.clientUserRepo.save(cu);

    const setupUrl = `${frontendUrl}/portal/setup?token=${setupToken}`;
    try {
      await this.mailService.sendPortalInvite(
        clientEmail,
        {
          clientName,
          firmName,
          setupUrl,
          expiryDays: SETUP_TOKEN_EXPIRY_DAYS,
        },
        actingUserId,
      );
    } catch (err) {
      this.logger.warn(`Portal invite email failed for client ${clientId}: ${String(err)}`);
    }
  }

  /** Client sets their password via the one-time setup token. */
  async setup(dto: PortalSetupDto): Promise<{ accessToken: string; name: string }> {
    const cu = await this.clientUserRepo.findOne({
      where: { portalSetupToken: dto.token },
    });
    if (!cu) throw new BadRequestException('Invalid or expired setup link');
    if (!cu.portalSetupTokenExpiresAt || cu.portalSetupTokenExpiresAt < new Date()) {
      throw new BadRequestException(
        'This setup link has expired. Ask your accountant to resend the invitation.',
      );
    }

    cu.passwordHash = await hashPassword(dto.password);
    cu.isActive = true;
    cu.portalSetupToken = undefined;
    cu.portalSetupTokenExpiresAt = undefined;
    await this.clientUserRepo.save(cu);

    const client = await this.clientRepo.findOne({ where: { id: cu.clientId } });
    return {
      accessToken: this.signToken(cu),
      name: client?.name ?? '',
    };
  }

  /** Client logs in with email + password. */
  async login(dto: PortalLoginDto): Promise<{ accessToken: string; name: string }> {
    // Hash the incoming email to look up the single matching row directly —
    // no full-table scan needed even though the email column is encrypted.
    const digest = hashEmail(dto.email, this.emailHashSecret());
    const cu = await this.clientUserRepo.findOne({
      where: { emailHash: digest, isActive: true },
    });

    if (!cu || !cu.passwordHash) {
      throw new UnauthorizedException('Invalid email or password');
    }

    const valid = await comparePassword(dto.password, cu.passwordHash);
    if (!valid) throw new UnauthorizedException('Invalid email or password');

    cu.lastLoginAt = new Date();
    await this.clientUserRepo.save(cu);

    const client = await this.clientRepo.findOne({ where: { id: cu.clientId } });
    return {
      accessToken: this.signToken(cu),
      name: client?.name ?? '',
    };
  }

  // ── Portal data ────────────────────────────────────────────────────────────

  async getMe(clientId: string, tenantId: string) {
    const client = await this.clientRepo.findOne({ where: { id: clientId, tenantId } });
    if (!client) throw new NotFoundException('Client not found');
    const tenant = await this.tenantRepo.findOne({ where: { id: tenantId } });
    return {
      name: client.name,
      nino: client.portalOnly ? undefined : client.nino,
      agentType: client.agentType,
      invitationStatus: client.invitationStatus,
      authorisedAt: client.authorisedAt,
      portalOnly: !!client.portalOnly,
      utr: client.utr,
      firmName: tenant?.firmName ?? '',
      firmEmail: tenant?.contactEmail ?? '',
    };
  }

  async getObligations(clientId: string, tenantId: string) {
    const client = await this.clientRepo.findOne({ where: { id: clientId, tenantId } });
    if (!client) throw new NotFoundException('Client not found');
    if (!client.authorisedAt)
      return { message: 'HMRC authorisation pending', obligations: [], businesses: [] };

    try {
      const accessToken = await this.hmrcService.getValidAccessToken(tenantId);
      const baseUrl = this.configService.get<string>('hmrc.baseUrl')!;
      const url = `${baseUrl}/obligations/details/${client.nino}/income-and-expenditure`;

      const res = await this.hmrcApiClient.fetch(url, {
        accessToken,
        headers: { Accept: 'application/vnd.hmrc.3.0+json' },
      });
      if (!res.ok)
        return {
          message: 'Could not load obligations from HMRC',
          obligations: [],
          businesses: [],
        };
      const data = (await res.json()) as {
        obligations?: Array<{
          typeOfBusiness?: string;
          businessId?: string;
          obligationDetails?: Array<{
            periodStartDate: string;
            periodEndDate: string;
            dueDate: string;
            receivedDate?: string;
            status: string;
            periodKey?: string;
          }>;
          obligations?: Array<{
            periodStartDate: string;
            periodEndDate: string;
            dueDate: string;
            receivedDate?: string;
            status: string;
            periodKey?: string;
          }>;
        }>;
      };
      const raw = data.obligations ?? [];
      const businesses = raw.map((group) => {
        const periods = (group.obligationDetails ?? group.obligations ?? []).map((ob) => ({
          periodStartDate: ob.periodStartDate,
          periodEndDate: ob.periodEndDate,
          dueDate: ob.dueDate,
          receivedDate: ob.receivedDate,
          status: this.normalizeObligationStatus(ob.status, ob.dueDate),
          periodKey: ob.periodKey,
        }));
        return {
          businessId: group.businessId ?? '',
          typeOfBusiness: group.typeOfBusiness ?? 'Business',
          label: this.businessLabel(group.typeOfBusiness, group.businessId),
          periods,
        };
      });
      return { obligations: raw, businesses };
    } catch (err) {
      this.logger.warn(`Portal obligations fetch failed: ${String(err)}`);
      return { message: 'Could not load obligations', obligations: [], businesses: [] };
    }
  }

  async getItsaStatus(clientId: string, tenantId: string) {
    const client = await this.clientRepo.findOne({ where: { id: clientId, tenantId } });
    if (!client) throw new NotFoundException('Client not found');
    if (!client.authorisedAt) return { message: 'HMRC authorisation pending', itsaStatuses: [] };

    try {
      const accessToken = await this.hmrcService.getValidAccessToken(tenantId);
      const baseUrl = this.configService.get<string>('hmrc.baseUrl')!;
      const now = new Date();
      const taxYearStart = now.getMonth() >= 3 ? now.getFullYear() : now.getFullYear() - 1;
      const taxYear = `${taxYearStart}-${String(taxYearStart + 1).slice(2)}`;
      const url = `${baseUrl}/individuals/person/itsa-status/${encodeURIComponent(client.nino)}/${encodeURIComponent(taxYear)}?history=true`;

      const res = await this.hmrcApiClient.fetch(url, {
        accessToken,
        headers: { Accept: 'application/vnd.hmrc.2.0+json' },
      });
      if (!res.ok) return { message: 'Could not load HMRC status', itsaStatuses: [] };
      const data = (await res.json()) as { itsaStatuses?: unknown[] };
      return { itsaStatuses: data.itsaStatuses ?? [] };
    } catch (err) {
      this.logger.warn(`Portal ITSA status fetch failed: ${String(err)}`);
      return { message: 'Could not load HMRC status', itsaStatuses: [] };
    }
  }

  async getSubmissions(clientId: string, tenantId: string) {
    const client = await this.clientRepo.findOne({ where: { id: clientId, tenantId } });
    if (!client) throw new NotFoundException('Client not found');
    if (!client.authorisedAt)
      return {
        message: 'HMRC authorisation pending',
        businesses: [],
        totalIncome: 0,
        totalExpenses: 0,
        netProfit: 0,
        netLoss: 0,
      };

    try {
      const accessToken = await this.hmrcService.getValidAccessToken(tenantId);
      const baseUrl = this.configService.get<string>('hmrc.baseUrl')!;
      const now = new Date();
      const taxYearStart = now.getMonth() >= 3 ? now.getFullYear() : now.getFullYear() - 1;
      const taxYear = `${taxYearStart}-${String(taxYearStart + 1).slice(2)}`;
      const url = `${baseUrl}/self-assessment/income-summary/${encodeURIComponent(client.nino)}/${encodeURIComponent(taxYear)}`;

      const res = await this.hmrcApiClient.fetch(url, {
        accessToken,
        headers: { Accept: 'application/vnd.hmrc.1.0+json' },
      });
      if (!res.ok)
        return {
          message: 'No submissions yet',
          businesses: [],
          totalIncome: 0,
          totalExpenses: 0,
          netProfit: 0,
          netLoss: 0,
        };
      const data = (await res.json()) as Record<string, unknown>;
      return { taxYear, ...(data as object) };
    } catch (err) {
      this.logger.warn(`Portal submissions fetch failed: ${String(err)}`);
      return {
        message: 'Could not load submissions',
        businesses: [],
        totalIncome: 0,
        totalExpenses: 0,
        netProfit: 0,
        netLoss: 0,
      };
    }
  }

  async getLiabilities(clientId: string, tenantId: string) {
    const client = await this.clientRepo.findOne({ where: { id: clientId, tenantId } });
    if (!client) throw new NotFoundException('Client not found');
    if (!client.authorisedAt)
      return {
        message: 'HMRC authorisation pending',
        balanceDetails: null,
        liabilities: [],
        paymentDeadlines: { january: null, july: null },
        paymentDetails: null,
      };

    try {
      const accessToken = await this.hmrcService.getValidAccessToken(tenantId);
      const baseUrl = this.configService.get<string>('hmrc.baseUrl')!;
      const url = `${baseUrl}/accounts/self-assessment/${client.nino}/balance-and-transactions?docNumber=&onlyOpenItems=false&onlyChargeReference=false&includeLocks=false&includeStatistical=false&includeInterest=false&includeCodedOut=false`;

      const res = await this.hmrcApiClient.fetch(url, {
        accessToken,
        headers: { Accept: 'application/vnd.hmrc.4.0+json' },
      });
      if (!res.ok)
        return {
          message: 'Could not load liabilities from HMRC',
          balanceDetails: null,
          liabilities: [],
          paymentDeadlines: { january: null, july: null },
          paymentDetails: null,
        };

      const data = (await res.json()) as BalanceAndTransactionsResponse;
      const docs = (data.documentDetails ?? []).filter((doc) => this.isLiabilityDocument(doc));
      const liabilities = docs.map((doc) => this.mapLiabilityRow(doc));
      const january = this.sumDeadlineGroup(liabilities, 1);
      const july = this.sumDeadlineGroup(liabilities, 7);

      return {
        balanceDetails: data.balanceDetails ?? null,
        documentDetails: data.documentDetails ?? [],
        liabilities,
        paymentDeadlines: {
          january,
          july,
        },
        paymentDetails: {
          sortCode: '08-32-10',
          accountNumber: '12001039',
          reference: client.utr ? client.utr : 'Your 10-digit Unique Taxpayer Reference (UTR)',
          hasUtr: !!client.utr,
          amountDue:
            data.balanceDetails?.totalBalance ?? data.balanceDetails?.payableAmount ?? null,
          overdueAmount: data.balanceDetails?.overdueAmount ?? null,
          payOnlineUrl: 'https://www.gov.uk/pay-self-assessment-tax-bill',
        },
      };
    } catch (err) {
      this.logger.warn(`Portal liabilities fetch failed: ${String(err)}`);
      return {
        message: 'Could not load liabilities',
        balanceDetails: null,
        liabilities: [],
        paymentDeadlines: { january: null, july: null },
        paymentDetails: null,
      };
    }
  }

  // ── Messages ───────────────────────────────────────────────────────────────

  async getMessages(clientId: string) {
    return this.portalMsgRepo.find({
      where: { clientId },
      order: { createdAt: 'ASC' },
      take: 100,
    });
  }

  async markMessageRead(clientId: string, messageId: string) {
    const msg = await this.portalMsgRepo.findOne({ where: { id: messageId, clientId } });
    if (!msg) throw new NotFoundException('Message not found');
    // Clients only mark accountant messages as read
    if (msg.sender === 'agent' && !msg.readAt) {
      msg.readAt = new Date();
      await this.portalMsgRepo.save(msg);
    }
    return msg;
  }

  async getUnreadCount(clientId: string): Promise<number> {
    return this.portalMsgRepo.count({
      where: { clientId, sender: 'agent', readAt: IsNull() },
    });
  }

  /** Called by the agent via POST /clients/:id/portal-message */
  async sendMessage(
    tenantId: string,
    clientId: string,
    dto: SendPortalMessageDto,
    actingUserId?: string,
  ): Promise<PortalMessage> {
    const client = await this.clientRepo.findOne({ where: { id: clientId, tenantId } });
    if (!client) throw new NotFoundException('Client not found');

    const tenant = await this.tenantRepo.findOne({ where: { id: tenantId } });
    const firmName = tenant?.firmName ?? 'Your accountancy firm';

    const msg = this.portalMsgRepo.create({
      tenantId,
      clientId,
      subject: dto.subject,
      body: dto.body,
      sender: 'agent',
    });
    await this.portalMsgRepo.save(msg);

    const frontendUrl =
      this.configService.get<string>('app.frontendUrl') ?? 'http://localhost:3000';
    try {
      await this.mailService.sendPortalMessage(
        client.email,
        {
          clientName: client.name,
          firmName,
          subject: dto.subject,
          body: dto.body,
          portalUrl: `${frontendUrl}/portal/messages`,
        },
        actingUserId,
      );
    } catch (err) {
      this.logger.warn(`Portal message email failed for client ${clientId}: ${String(err)}`);
    }

    return msg;
  }

  /** Client → accountant portal chat reply */
  async replyFromClient(
    tenantId: string,
    clientId: string,
    dto: ClientPortalReplyDto,
  ): Promise<PortalMessage> {
    const client = await this.clientRepo.findOne({ where: { id: clientId, tenantId } });
    if (!client) throw new NotFoundException('Client not found');

    const subject = (dto.subject ?? '').trim() || 'Message from portal';
    const body = dto.body.trim();
    if (!body) throw new BadRequestException('Message cannot be empty');

    const msg = this.portalMsgRepo.create({
      tenantId,
      clientId,
      subject,
      body,
      sender: 'client',
      readAt: undefined,
    });
    await this.portalMsgRepo.save(msg);

    const tenant = await this.tenantRepo.findOne({ where: { id: tenantId } });
    const firmName = tenant?.firmName ?? 'Your firm';
    const agentEmail = tenant?.contactEmail;
    const frontendUrl =
      this.configService.get<string>('app.frontendUrl') ?? 'http://localhost:3000';
    const clientDetailUrl = `${frontendUrl}/clients/detail?id=${clientId}`;

    void this.appNotificationsService
      .create({
        tenantId,
        type: 'portal_chat',
        title: `Portal message from ${client.name}`,
        body: body.length > 120 ? `${body.slice(0, 117)}...` : body,
        clientId,
      })
      .catch((err) => this.logger.warn(`Portal chat notification failed: ${String(err)}`));

    if (agentEmail) {
      void this.mailService
        .sendPortalClientReply(agentEmail, {
          agentName: tenant?.contactName ?? 'there',
          clientName: client.name,
          firmName,
          subject,
          body,
          clientDetailUrl,
        })
        .catch((err) => this.logger.warn(`Portal client reply email failed: ${String(err)}`));
    }

    return msg;
  }

  /** Agent — list full portal chat for a client (oldest first). */
  async getMessagesForAgent(tenantId: string, clientId: string): Promise<PortalMessage[]> {
    const client = await this.clientRepo.findOne({ where: { id: clientId, tenantId } });
    if (!client) throw new NotFoundException('Client not found');
    return this.portalMsgRepo.find({
      where: { tenantId, clientId },
      order: { createdAt: 'ASC' },
      take: 100,
    });
  }

  /** Agent marks client messages as read when opening chat. */
  async markClientMessagesRead(tenantId: string, clientId: string): Promise<void> {
    await this.portalMsgRepo
      .createQueryBuilder()
      .update(PortalMessage)
      .set({ readAt: new Date() })
      .where(
        'tenant_id = :tenantId AND client_id = :clientId AND sender = :sender AND read_at IS NULL',
        {
          tenantId,
          clientId,
          sender: 'client',
        },
      )
      .execute();
  }

  // ── File drop ──────────────────────────────────────────────────────────────

  async uploadFile(
    clientId: string,
    tenantId: string,
    file: Express.Multer.File,
  ): Promise<PortalFile> {
    if (file.size > MAX_FILE_SIZE_BYTES) {
      throw new BadRequestException('File exceeds the 10 MB size limit.');
    }
    if (!ALLOWED_MIME_TYPES.has(file.mimetype)) {
      throw new BadRequestException(
        'File type not allowed. Upload PDF, images, spreadsheets, Word documents, CSV, or ZIP files.',
      );
    }

    const client = await this.clientRepo.findOne({ where: { id: clientId, tenantId } });
    if (!client) throw new NotFoundException('Client not found');

    // Persist to disk
    const dir = path.join(UPLOAD_BASE_DIR, clientId);
    fs.mkdirSync(dir, { recursive: true });
    const ext = path.extname(file.originalname) || '';
    const stored = `${crypto.randomUUID()}${ext}`;
    const storagePath = path.join(dir, stored);
    fs.writeFileSync(storagePath, file.buffer);

    const record = this.portalFileRepo.create({
      tenantId,
      clientId,
      originalName: file.originalname,
      mimeType: file.mimetype,
      size: file.size,
      storagePath,
      viewedByAgent: false,
    });
    await this.portalFileRepo.save(record);

    // Notify agent by email (fire-and-forget)
    const tenant = await this.tenantRepo.findOne({ where: { id: tenantId } });
    const agentEmail = tenant?.contactEmail;
    const frontendUrl =
      this.configService.get<string>('app.frontendUrl') ?? 'http://localhost:3000';
    if (agentEmail) {
      void this.mailService
        .sendPortalFileUploaded(agentEmail, {
          agentEmail,
          clientName: client.name,
          firmName: tenant?.firmName ?? 'Your firm',
          fileName: file.originalname,
          fileSize: formatBytes(file.size),
          clientDetailUrl: `${frontendUrl}/clients/detail?id=${clientId}`,
        })
        .catch((err) => this.logger.warn(`File upload notification email failed: ${String(err)}`));
    }

    return record;
  }

  async getFiles(clientId: string): Promise<PortalFile[]> {
    return this.portalFileRepo.find({
      where: { clientId },
      order: { createdAt: 'DESC' },
    });
  }

  async getFileRecord(clientId: string, fileId: string): Promise<PortalFile> {
    const f = await this.portalFileRepo.findOne({ where: { id: fileId, clientId } });
    if (!f) throw new NotFoundException('File not found');
    return f;
  }

  /** Agent — list files uploaded by a specific client. Also marks all as viewed. */
  async getFilesForAgent(tenantId: string, clientId: string): Promise<PortalFile[]> {
    const files = await this.portalFileRepo.find({
      where: { tenantId, clientId },
      order: { createdAt: 'DESC' },
    });
    const unseen = files.filter((f) => !f.viewedByAgent);
    if (unseen.length > 0) {
      await this.portalFileRepo
        .createQueryBuilder()
        .update(PortalFile)
        .set({ viewedByAgent: true })
        .whereInIds(unseen.map((f) => f.id))
        .execute();
    }
    return files;
  }

  async getFileRecordForAgent(
    tenantId: string,
    clientId: string,
    fileId: string,
  ): Promise<PortalFile> {
    const f = await this.portalFileRepo.findOne({ where: { id: fileId, tenantId, clientId } });
    if (!f) throw new NotFoundException('File not found');
    return f;
  }

  async countUnseenFiles(tenantId: string, clientId: string): Promise<number> {
    return this.portalFileRepo.count({
      where: { tenantId, clientId, viewedByAgent: false },
    });
  }

  // ── Agent preview ──────────────────────────────────────────────────────────

  /**
   * Generates a short-lived (15 min) portal JWT for agent preview.
   * The JWT has isPreview: true so PortalJwtStrategy skips the ClientUser DB lookup.
   */
  async generatePreviewToken(tenantId: string, clientId: string): Promise<string> {
    const client = await this.clientRepo.findOne({ where: { id: clientId, tenantId } });
    if (!client) throw new NotFoundException('Client not found');

    const payload: PortalJwtPayload = {
      sub: 'preview',
      clientId,
      tenantId,
      role: 'client',
      isPreview: true,
    };
    return this.jwtService.sign(payload, { expiresIn: '15m' });
  }

  /**
   * Agent opens /portal/preview?token=xxx in a new tab.
   * This endpoint validates the token and sets the portal cookie so the
   * preview page can load the portal routes as the client.
   */
  exchangePreviewToken(token: string): { valid: boolean; accessToken: string } {
    try {
      const payload = this.jwtService.verify<PortalJwtPayload>(token);
      if (!payload.isPreview) throw new Error('Not a preview token');
      // Re-sign as a fresh 15-min token (the original could be near expiry)
      const fresh = this.jwtService.sign(
        {
          sub: 'preview',
          clientId: payload.clientId,
          tenantId: payload.tenantId,
          role: 'client',
          isPreview: true,
        },
        { expiresIn: '15m' },
      );
      return { valid: true, accessToken: fresh };
    } catch {
      throw new BadRequestException('Invalid or expired preview link');
    }
  }

  // ── Helpers ────────────────────────────────────────────────────────────────

  private businessLabel(typeOfBusiness?: string, businessId?: string): string {
    const type = (typeOfBusiness ?? '').toLowerCase();
    let name = 'Business';
    if (type.includes('self-employment') || type === 'self-employment') name = 'Self-employment';
    else if (type.includes('uk-property') || type === 'uk-property') name = 'UK property';
    else if (type.includes('foreign-property')) name = 'Foreign property';
    else if (typeOfBusiness) name = typeOfBusiness;
    const shortId = businessId ? ` (${businessId.slice(-6)})` : '';
    return `${name}${shortId}`;
  }

  private normalizeObligationStatus(status: string, dueDate?: string): string {
    const s = (status ?? '').trim();
    if (/fulfilled|submitted|complete/i.test(s)) return 'Submitted';
    if (/overdue/i.test(s)) return 'Overdue';
    if (dueDate) {
      const due = new Date(dueDate);
      due.setHours(0, 0, 0, 0);
      const today = new Date();
      today.setHours(0, 0, 0, 0);
      if (due < today && /open|pending/i.test(s)) return 'Overdue';
    }
    if (/open|pending/i.test(s)) return 'Pending';
    return s || 'Pending';
  }

  private isLiabilityDocument(doc: HmrcAccountDocumentDetail): boolean {
    const desc = doc.documentDescription ?? '';
    if (['Payment', 'Repayment', 'Clearing Document'].includes(desc)) return false;
    if (doc.creditReason && !doc.documentDescription) return false;
    const original = doc.originalAmount ?? 0;
    const outstanding = doc.outstandingAmount ?? 0;
    return original > 0 || outstanding > 0;
  }

  private mapLiabilityRow(doc: HmrcAccountDocumentDetail) {
    const chargeType = doc.documentDescription ?? doc.documentText ?? '';
    let label = doc.documentText ?? doc.documentDescription ?? 'Charge';
    if (chargeType === 'ITSA- POA 1')
      label = `1st payment on account${doc.taxYear ? ` ${doc.taxYear}` : ''}`;
    else if (chargeType === 'ITSA - POA 2')
      label = `2nd payment on account${doc.taxYear ? ` ${doc.taxYear}` : ''}`;
    else if (chargeType === 'ITSA- Bal Charge')
      label = `Balancing payment${doc.taxYear ? ` ${doc.taxYear}` : ''}`;

    const outstanding = doc.outstandingAmount ?? 0;
    let status: 'paid' | 'upcoming' | 'overdue' = 'upcoming';
    if (outstanding <= 0) status = 'paid';
    else if (doc.documentDueDate) {
      const due = new Date(doc.documentDueDate);
      due.setHours(0, 0, 0, 0);
      const today = new Date();
      today.setHours(0, 0, 0, 0);
      status = due < today ? 'overdue' : 'upcoming';
    }

    const dueMonth = doc.documentDueDate ? new Date(doc.documentDueDate).getUTCMonth() + 1 : null;
    let deadline: 'january' | 'july' | 'other' = 'other';
    if (dueMonth === 1 || chargeType === 'ITSA- POA 1' || chargeType === 'ITSA- Bal Charge') {
      deadline = 'january';
    } else if (dueMonth === 7 || chargeType === 'ITSA - POA 2') {
      deadline = 'july';
    }

    return {
      documentId: doc.documentId,
      taxYear: doc.taxYear,
      label,
      dueDate: doc.documentDueDate ?? null,
      outstandingAmount: outstanding,
      originalAmount: doc.originalAmount ?? null,
      status,
      deadline,
    };
  }

  private sumDeadlineGroup(
    rows: Array<{
      deadline: 'january' | 'july' | 'other';
      outstandingAmount: number;
      label: string;
      dueDate: string | null;
      status: string;
      taxYear?: string;
    }>,
    month: 1 | 7,
  ) {
    const key = month === 1 ? 'january' : 'july';
    const items = rows.filter((r) => r.deadline === key && r.outstandingAmount > 0);
    if (items.length === 0) {
      return {
        label: month === 1 ? '31 January' : '31 July',
        amount: 0,
        items: [] as typeof items,
      };
    }
    return {
      label: month === 1 ? '31 January' : '31 July',
      amount: items.reduce((sum, r) => sum + r.outstandingAmount, 0),
      items,
    };
  }

  private signToken(cu: ClientUser): string {
    const payload: PortalJwtPayload = {
      sub: cu.id,
      clientId: cu.clientId,
      tenantId: cu.tenantId,
      role: 'client',
    };
    return this.jwtService.sign(payload, { expiresIn: ACCESS_TOKEN_EXPIRY });
  }

  cookieName(): string {
    return PORTAL_COOKIE;
  }

  /** Whether this email already has a portal account in the firm. */
  async isPortalEmailInUse(tenantId: string, email: string): Promise<boolean> {
    const digest = hashEmail(email, this.emailHashSecret());
    const existing = await this.clientUserRepo.findOne({ where: { tenantId, emailHash: digest } });
    return !!existing;
  }

  /** Portal customers visible to the actor (owner: all; staff: assigned only). */
  async listCustomers(
    tenantId: string,
    actor?: { role?: string; userId?: string } | null,
  ): Promise<PortalCustomerRow[]> {
    const users = await this.clientUserRepo.find({
      where: { tenantId },
      order: { createdAt: 'DESC' },
    });
    if (users.length === 0) return [];

    const clientIds = users.map((u) => u.clientId);
    const clients = await this.clientRepo.find({ where: { tenantId, id: In(clientIds) } });
    const clientMap = new Map(clients.map((c) => [c.id, c]));

    const rows: PortalCustomerRow[] = [];
    for (const cu of users) {
      const client = clientMap.get(cu.clientId);
      if (!client || client.deletedAt) continue;
      if (actor?.role === 'staff' && actor.userId && client.assignedToUserId !== actor.userId) {
        continue;
      }

      const setupPending =
        !cu.isActive &&
        !!cu.portalSetupToken &&
        (!cu.portalSetupTokenExpiresAt || cu.portalSetupTokenExpiresAt >= new Date());

      rows.push({
        id: client.id,
        name: client.name,
        email: cu.email,
        portalOnly: !!client.portalOnly,
        portalActive: cu.isActive,
        invitedAt: cu.createdAt.toISOString(),
        lastLoginAt: cu.lastLoginAt?.toISOString() ?? null,
        setupPending,
      });
    }
    return rows;
  }

  /** Remove portal access. Deletes portal-only customers entirely. */
  async revokeAccess(
    tenantId: string,
    client: Client,
    actor?: { role?: string; userId?: string } | null,
  ): Promise<{ message: string }> {
    if (actor?.role === 'staff' && actor.userId && client.assignedToUserId !== actor.userId) {
      throw new NotFoundException('Client not found');
    }

    const cu = await this.clientUserRepo.findOne({ where: { tenantId, clientId: client.id } });
    if (!cu) {
      throw new NotFoundException('This customer does not have portal access.');
    }

    await this.clientUserRepo.remove(cu);

    if (client.portalOnly) {
      await this.clientRepo.softRemove(client);
      return { message: 'Portal customer removed.' };
    }

    return { message: 'Portal access removed. You can send a new invite from the client record.' };
  }

  /**
   * Secret used for the email HMAC lookup hash.
   * Reads EMAIL_HASH_SECRET from config; falls back to the JWT secret so
   * existing deployments work without any new env variables.
   */
  private emailHashSecret(): string {
    return (
      this.configService.get<string>('EMAIL_HASH_SECRET') ??
      this.configService.get<string>('auth.jwtSecret') ??
      'dev-fallback'
    );
  }
}

function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}
