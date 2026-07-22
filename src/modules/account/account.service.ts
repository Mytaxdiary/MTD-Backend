import * as archiver from 'archiver';
import * as fs from 'fs';
import * as path from 'path';
import { Injectable, UnauthorizedException, BadRequestException, ConflictException, NotFoundException, Logger } from '@nestjs/common';
import { InjectRepository, InjectDataSource } from '@nestjs/typeorm';
import { In, LessThanOrEqual, Repository, DataSource } from 'typeorm';
import { Cron, CronExpression } from '@nestjs/schedule';
import { ConfigService } from '@nestjs/config';
import { Response } from 'express';
import { authenticator } from 'otplib';
import { User } from '../users/entities/user.entity';
import { Tenant } from '../tenants/entities/tenant.entity';
import { Client } from '../clients/entities/client.entity';
import { ClientNote } from '../clients/entities/client-note.entity';
import { ChaseLog } from '../chase-logs/entities/chase-log.entity';
import { ChaseTemplate } from '../chase-templates/entities/chase-template.entity';
import { AppNotification } from '../app-notifications/entities/app-notification.entity';
import { NotificationPreferences } from '../tenants/entities/notification-preferences.entity';
import { PortalMessage } from '../client-portal/entities/portal-message.entity';
import { PortalFile } from '../client-portal/entities/portal-file.entity';
import { ClientUser } from '../client-portal/entities/client-user.entity';
import { HmrcConnection } from '../hmrc/entities/hmrc-connection.entity';
import { DeletionRequest } from './entities/deletion-request.entity';
import { MailService } from '../mail/mail.service';
import { comparePassword } from '../../common/helpers/crypto.helper';
import { decrypt, isEncrypted } from '../hmrc/crypto.util';

const PORTAL_FILES_BASE = path.join(process.cwd(), 'uploads', 'portal-files');
const GRACE_DAYS = 7;

@Injectable()
export class AccountService {
  private readonly logger = new Logger(AccountService.name);

  constructor(
    @InjectDataSource()
    private readonly dataSource: DataSource,
    @InjectRepository(User)
    private readonly userRepo: Repository<User>,
    @InjectRepository(Tenant)
    private readonly tenantRepo: Repository<Tenant>,
    @InjectRepository(Client)
    private readonly clientRepo: Repository<Client>,
    @InjectRepository(ClientNote)
    private readonly clientNoteRepo: Repository<ClientNote>,
    @InjectRepository(ChaseLog)
    private readonly chaseLogRepo: Repository<ChaseLog>,
    @InjectRepository(ChaseTemplate)
    private readonly chaseTemplateRepo: Repository<ChaseTemplate>,
    @InjectRepository(AppNotification)
    private readonly appNotificationRepo: Repository<AppNotification>,
    @InjectRepository(NotificationPreferences)
    private readonly notifPrefsRepo: Repository<NotificationPreferences>,
    @InjectRepository(PortalMessage)
    private readonly portalMessageRepo: Repository<PortalMessage>,
    @InjectRepository(PortalFile)
    private readonly portalFileRepo: Repository<PortalFile>,
    @InjectRepository(ClientUser)
    private readonly clientUserRepo: Repository<ClientUser>,
    @InjectRepository(HmrcConnection)
    private readonly hmrcConnectionRepo: Repository<HmrcConnection>,
    @InjectRepository(DeletionRequest)
    private readonly deletionRequestRepo: Repository<DeletionRequest>,
    private readonly mailService: MailService,
    private readonly configService: ConfigService,
  ) {}

  async generateExport(userId: string, password: string, res: Response): Promise<void> {
    const user = await this.userRepo.findOne({ where: { id: userId } });
    if (!user) throw new UnauthorizedException('User not found');

    const valid = await comparePassword(password, user.passwordHash);
    if (!valid) throw new UnauthorizedException('Incorrect password');

    const tenantId = user.tenantId;

    // Gather all data
    const tenant = await this.tenantRepo.findOne({ where: { id: tenantId } });
    const users = await this.userRepo.find({ where: { tenantId } });
    const clients = await this.clientRepo.find({ where: { tenantId } });
    const clientIds = clients.map((c) => c.id);

    const [notes, chaseLogs, chaseTemplates, notifications, portalMessages, portalFiles, clientUsers] =
      await Promise.all([
        clientIds.length ? this.clientNoteRepo.find({ where: { clientId: In(clientIds) } }) : [],
        clientIds.length ? this.chaseLogRepo.find({ where: { clientId: In(clientIds) } }) : [],
        this.chaseTemplateRepo.find({ where: { tenantId } }),
        this.appNotificationRepo.find({ where: { tenantId } }),
        clientIds.length ? this.portalMessageRepo.find({ where: { clientId: In(clientIds) } }) : [],
        clientIds.length ? this.portalFileRepo.find({ where: { clientId: In(clientIds) } }) : [],
        clientIds.length ? this.clientUserRepo.find({ where: { clientId: In(clientIds) } }) : [],
      ]);

    // Strip sensitive fields before export
    const safeUsers = users.map(({ passwordHash, totpSecret, ...rest }) => rest);
    const safeClientUsers = clientUsers.map(({ passwordHash, ...rest }) => rest);

    const exportData = {
      exportedAt: new Date().toISOString(),
      firm: tenant,
      account: safeUsers,
      clients: clients.map(({ ninoHash, ...rest }) => rest),
      notes,
      chaseTemplates,
      chaseLogs,
      notifications: notifications.map(({ tenantId: _t, ...rest }) => rest),
      portalMessages,
      portalFileMetadata: portalFiles,
      portalAccounts: safeClientUsers,
    };

    // Build CSV for clients
    const clientCsv = this.toCsv(
      clients.map(({ ninoHash: _nh, ...rest }) => rest),
    );

    // Build ZIP and stream to response
    res.setHeader('Content-Type', 'application/zip');
    res.setHeader(
      'Content-Disposition',
      `attachment; filename="mytaxdiary-export-${new Date().toISOString().slice(0, 10)}.zip"`,
    );

    const archive = new archiver.ZipArchive({ zlib: { level: 9 } });
    archive.on('error', (err) => {
      this.logger.error('Archive error', err);
      if (!res.headersSent) res.status(500).end();
    });

    archive.pipe(res);

    archive.append(JSON.stringify(exportData, null, 2), { name: 'export.json' });
    archive.append(clientCsv, { name: 'clients.csv' });
    archive.append(JSON.stringify(notes, null, 2), { name: 'notes.json' });
    archive.append(JSON.stringify(chaseLogs, null, 2), { name: 'chase-logs.json' });
    archive.append(JSON.stringify(portalMessages, null, 2), { name: 'portal-messages.json' });

    // Include uploaded portal files
    for (const file of portalFiles) {
      if (fs.existsSync(file.storagePath)) {
        archive.file(file.storagePath, { name: `portal-files/${file.clientId}/${file.originalName}` });
      }
    }

    await archive.finalize();

    this.logger.log(`Data export completed for user ${userId} (tenant ${tenantId})`);
  }

  // ── Deletion request ──────────────────────────────────────────────────────

  async getDeletionStatus(userId: string): Promise<{ status: string; executeAt: string | null } | null> {
    const req = await this.deletionRequestRepo.findOne({
      where: { userId, status: 'pending' },
      order: { createdAt: 'DESC' },
    });
    if (!req) return null;
    // MySQL datetime columns may arrive as a string — wrap in new Date() to ensure it's a Date before calling toISOString()
    return { status: req.status, executeAt: new Date(req.executeAt).toISOString() };
  }

  async requestDeletion(userId: string, password: string, mfaCode?: string): Promise<{ executeAt: string }> {
    const user = await this.userRepo.findOne({ where: { id: userId } });
    if (!user) throw new NotFoundException('User not found');

    // Step-up: verify password
    const passwordOk = await comparePassword(password, user.passwordHash);
    if (!passwordOk) throw new UnauthorizedException('Incorrect password');

    // Step-up: verify MFA if enabled
    if (user.mfaEnabled) {
      if (!mfaCode) throw new BadRequestException('Your account has 2FA enabled. Please provide your authenticator code.');
      const encKey = this.configService.get<string>('hmrc.encryptionKey');
      const plain = encKey && isEncrypted(user.totpSecret ?? '')
        ? decrypt(user.totpSecret!, encKey)
        : (user.totpSecret ?? '');
      const valid = authenticator.verify({ token: mfaCode.replace(/\s/g, ''), secret: plain });
      if (!valid) throw new BadRequestException('Invalid authenticator code. Please try again.');
    }

    // Only one pending request allowed at a time
    const existing = await this.deletionRequestRepo.findOne({ where: { userId, status: 'pending' } });
    if (existing) throw new ConflictException('A deletion request is already pending for this account.');

    const executeAt = new Date();
    executeAt.setDate(executeAt.getDate() + GRACE_DAYS);

    const req = this.deletionRequestRepo.create({
      userId,
      tenantId: user.tenantId!,
      status: 'pending',
      executeAt,
      requesterEmail: user.email,
    });
    await this.deletionRequestRepo.save(req);

    const frontendUrl = this.configService.get<string>('app.frontendUrl') ?? 'http://localhost:3000';
    await this.mailService.sendDeletionRequestEmail({
      to: user.email,
      firstName: user.firstName,
      executeDate: executeAt.toLocaleDateString('en-GB', { day: 'numeric', month: 'long', year: 'numeric' }),
      settingsUrl: `${frontendUrl}/settings?section=data-privacy`,
    }).catch((e) => this.logger.error('Failed to send deletion request email', e));

    this.logger.warn(`Deletion request created for user ${userId}, executes at ${executeAt.toISOString()}`);
    return { executeAt: executeAt.toISOString() };
  }

  async cancelDeletion(userId: string): Promise<void> {
    const req = await this.deletionRequestRepo.findOne({ where: { userId, status: 'pending' } });
    if (!req) throw new NotFoundException('No pending deletion request found.');

    req.status = 'cancelled';
    await this.deletionRequestRepo.save(req);

    const user = await this.userRepo.findOne({ where: { id: userId } });
    if (user) {
      await this.mailService.sendDeletionCancelledEmail({
        to: user.email,
        firstName: user.firstName,
      }).catch((e) => this.logger.error('Failed to send deletion cancelled email', e));
    }

    this.logger.log(`Deletion request cancelled for user ${userId}`);
  }

  /**
   * Cron: runs every hour and executes any deletion requests whose executeAt has passed.
   */
  @Cron(CronExpression.EVERY_HOUR)
  async processPendingDeletions(): Promise<void> {
    const now = new Date();
    const due = await this.deletionRequestRepo.find({
      where: { status: 'pending', executeAt: LessThanOrEqual(now) },
    });

    for (const req of due) {
      try {
        await this.executeAccountDeletion(req);
        this.logger.warn(`Account deletion executed for user ${req.userId} (tenant ${req.tenantId})`);
      } catch (err) {
        this.logger.error(`Failed to execute deletion for user ${req.userId}`, err);
      }
    }
  }

  private async executeAccountDeletion(req: DeletionRequest): Promise<void> {
    const { userId, tenantId } = req;

    const clients = await this.clientRepo.find({ where: { tenantId }, select: ['id'] });
    const clientIds = clients.map((c) => c.id);

    await this.dataSource.transaction(async (manager) => {
      if (clientIds.length > 0) {
        await manager.delete(PortalFile, { clientId: In(clientIds) });
        await manager.delete(PortalMessage, { clientId: In(clientIds) });
        await manager.delete(ClientUser, { clientId: In(clientIds) });
        await manager.delete(ChaseLog, { clientId: In(clientIds) });
        await manager.delete(ClientNote, { clientId: In(clientIds) });
        await manager.delete(Client, { tenantId });
      }
      await manager.delete(HmrcConnection, { tenantId });
      await manager.delete(ChaseTemplate, { tenantId });
      await manager.delete(AppNotification, { tenantId });
      await manager.delete(NotificationPreferences, { tenantId });
      // Soft-delete the user account (preserves billing records via deletedAt)
      await manager.softDelete(User, { id: userId });

      // Mark the request as completed
      await manager.update(DeletionRequest, { id: req.id }, {
        status: 'completed',
        executedAt: new Date(),
      });
    });

    // Delete portal files from disk
    for (const clientId of clientIds) {
      const dir = path.join(PORTAL_FILES_BASE, clientId);
      if (fs.existsSync(dir)) fs.rmSync(dir, { recursive: true, force: true });
    }
  }

  // ── Helpers ───────────────────────────────────────────────────────────────

  private toCsv(rows: Record<string, unknown>[]): string {
    if (!rows.length) return '';
    const headers = Object.keys(rows[0]);
    const lines = [
      headers.join(','),
      ...rows.map((r) =>
        headers.map((h) => JSON.stringify(r[h] ?? '')).join(','),
      ),
    ];
    return lines.join('\n');
  }
}
