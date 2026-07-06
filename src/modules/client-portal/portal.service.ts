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
import { Repository, IsNull } from 'typeorm';
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
  ): Promise<void> {
    // Upsert — avoid duplicate if already exists (e.g. re-invite)
    let cu = await this.clientUserRepo.findOne({ where: { clientId } });
    const frontendUrl = this.configService.get<string>('app.frontendUrl') ?? 'http://localhost:3000';
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
      await this.mailService.sendPortalInvite(clientEmail, {
        clientName,
        firmName,
        setupUrl,
        expiryDays: SETUP_TOKEN_EXPIRY_DAYS,
      });
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
      throw new BadRequestException('This setup link has expired. Ask your accountant to resend the invitation.');
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
      nino: client.nino,
      agentType: client.agentType,
      invitationStatus: client.invitationStatus,
      authorisedAt: client.authorisedAt,
      firmName: tenant?.firmName ?? '',
      firmEmail: tenant?.contactEmail ?? '',
    };
  }

  async getObligations(clientId: string, tenantId: string) {
    const client = await this.clientRepo.findOne({ where: { id: clientId, tenantId } });
    if (!client) throw new NotFoundException('Client not found');
    if (!client.authorisedAt) return { message: 'HMRC authorisation pending', obligations: [] };

    try {
      const accessToken = await this.hmrcService.getValidAccessToken(tenantId);
      const baseUrl = this.configService.get<string>('hmrc.baseUrl')!;
      const url = `${baseUrl}/obligations/details/${client.nino}/income-and-expenditure?status=Open`;

      const res = await this.hmrcApiClient.fetch(url, {
        accessToken,
        headers: { Accept: 'application/vnd.hmrc.3.0+json' },
      });
      if (!res.ok) return { message: 'Could not load obligations from HMRC', obligations: [] };
      const data = await res.json() as { obligations?: unknown[] };
      return { obligations: data.obligations ?? [] };
    } catch (err) {
      this.logger.warn(`Portal obligations fetch failed: ${String(err)}`);
      return { message: 'Could not load obligations', obligations: [] };
    }
  }

  async getLiabilities(clientId: string, tenantId: string) {
    const client = await this.clientRepo.findOne({ where: { id: clientId, tenantId } });
    if (!client) throw new NotFoundException('Client not found');
    if (!client.authorisedAt) return { message: 'HMRC authorisation pending', balanceDetails: null };

    try {
      const accessToken = await this.hmrcService.getValidAccessToken(tenantId);
      const baseUrl = this.configService.get<string>('hmrc.baseUrl')!;
      const url = `${baseUrl}/accounts/self-assessment/${client.nino}/balance-and-transactions?docNumber=&onlyOpenItems=false&onlyChargeReference=false&includeLocks=false&includeStatistical=false&includeInterest=false&includeCodedOut=false`;

      const res = await this.hmrcApiClient.fetch(url, {
        accessToken,
        headers: { Accept: 'application/vnd.hmrc.4.0+json' },
      });
      if (!res.ok) return { message: 'Could not load liabilities from HMRC', balanceDetails: null };
      return res.json();
    } catch (err) {
      this.logger.warn(`Portal liabilities fetch failed: ${String(err)}`);
      return { message: 'Could not load liabilities', balanceDetails: null };
    }
  }

  // ── Messages ───────────────────────────────────────────────────────────────

  async getMessages(clientId: string) {
    return this.portalMsgRepo.find({
      where: { clientId },
      order: { createdAt: 'DESC' },
      take: 50,
    });
  }

  async markMessageRead(clientId: string, messageId: string) {
    const msg = await this.portalMsgRepo.findOne({ where: { id: messageId, clientId } });
    if (!msg) throw new NotFoundException('Message not found');
    if (!msg.readAt) {
      msg.readAt = new Date();
      await this.portalMsgRepo.save(msg);
    }
    return msg;
  }

  async getUnreadCount(clientId: string): Promise<number> {
    return this.portalMsgRepo.count({ where: { clientId, readAt: IsNull() } });
  }

  /** Called by the agent via POST /clients/:id/portal-message */
  async sendMessage(
    tenantId: string,
    clientId: string,
    dto: SendPortalMessageDto,
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
    });
    await this.portalMsgRepo.save(msg);

    // Email notification to client
    const frontendUrl = this.configService.get<string>('app.frontendUrl') ?? 'http://localhost:3000';
    try {
      await this.mailService.sendPortalMessage(client.email, {
        clientName: client.name,
        firmName,
        subject: dto.subject,
        body: dto.body,
        portalUrl: `${frontendUrl}/portal/messages`,
      });
    } catch (err) {
      this.logger.warn(`Portal message email failed for client ${clientId}: ${String(err)}`);
    }

    return msg;
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
    const frontendUrl = this.configService.get<string>('app.frontendUrl') ?? 'http://localhost:3000';
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
        .catch((err) =>
          this.logger.warn(`File upload notification email failed: ${String(err)}`),
        );
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

  async getFileRecordForAgent(tenantId: string, clientId: string, fileId: string): Promise<PortalFile> {
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
        { sub: 'preview', clientId: payload.clientId, tenantId: payload.tenantId, role: 'client', isPreview: true },
        { expiresIn: '15m' },
      );
      return { valid: true, accessToken: fresh };
    } catch {
      throw new BadRequestException('Invalid or expired preview link');
    }
  }

  // ── Helpers ────────────────────────────────────────────────────────────────

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
