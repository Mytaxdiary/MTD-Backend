import { Injectable, Logger, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { IsNull, Repository } from 'typeorm';
import { ChaseLog } from './entities/chase-log.entity';
import { CreateChaseLogDto } from './dto/create-chase-log.dto';
import { Client } from '../clients/entities/client.entity';
import { Tenant } from '../tenants/entities/tenant.entity';
import { MailService } from '../mail/mail.service';

export type ChaseLogSummary = {
  clientId: string;
  lastChaseAt: Date | null;
  chaseCount: number;
  lastStatus: string | null;
};

export type ChaseBusinessSummary = ChaseLogSummary & {
  businessId: string | null;
};

export type ChasePeriodSummary = ChaseBusinessSummary & {
  periodStartDate: string | null;
};

/** Legacy / business-only key: clientId::businessId */
export function chaseRowKey(clientId: string, businessId?: string | null): string {
  return `${clientId}::${businessId ?? ''}`;
}

/** Period-scoped key: clientId::businessId::periodStartDate */
export function chasePeriodRowKey(
  clientId: string,
  businessId?: string | null,
  periodStartDate?: string | null,
): string {
  return `${clientId}::${businessId ?? ''}::${periodStartDate ?? ''}`;
}

function normalizeDateKey(value?: string | Date | null): string | null {
  if (value == null || value === '') return null;
  if (value instanceof Date) {
    return value.toISOString().slice(0, 10);
  }
  const s = String(value).trim();
  return s.length >= 10 ? s.slice(0, 10) : s;
}

@Injectable()
export class ChaseLogsService {
  private readonly logger = new Logger(ChaseLogsService.name);

  constructor(
    @InjectRepository(ChaseLog)
    private readonly repo: Repository<ChaseLog>,
    @InjectRepository(Client)
    private readonly clientRepo: Repository<Client>,
    @InjectRepository(Tenant)
    private readonly tenantRepo: Repository<Tenant>,
    private readonly mailService: MailService,
  ) {}

  /**
   * Create a chase log entry and send the email (channel = email) or log SMS stub.
   * Status is per business×period via businessId + periodStartDate.
   */
  async create(tenantId: string, dto: CreateChaseLogDto, actingUserId?: string): Promise<ChaseLog> {
    const log = this.repo.create({
      clientId: dto.clientId,
      businessId: dto.businessId?.trim() || null,
      businessName: dto.businessName?.trim() || null,
      periodStartDate: dto.periodStartDate?.trim() || null,
      periodEndDate: dto.periodEndDate?.trim() || null,
      dueDate: dto.dueDate?.trim() || null,
      quarterLabel: dto.quarterLabel?.trim() || null,
      templateId: dto.templateId,
      channel: dto.channel,
      subject: dto.subject,
      body: dto.body,
      tenantId,
      sentAt: new Date(),
      status: 'sent',
      sentByUserId: actingUserId,
    });
    const saved = await this.repo.save(log);

    void this.dispatch(tenantId, dto, saved.id, actingUserId).catch((err: unknown) => {
      this.logger.error(`Chase dispatch failed for client ${dto.clientId}`, err);
    });

    return saved;
  }

  private async dispatch(
    tenantId: string,
    dto: CreateChaseLogDto,
    logId: string,
    actingUserId?: string,
  ): Promise<void> {
    const client = await this.clientRepo.findOne({
      where: { id: dto.clientId, tenantId },
    });
    if (!client?.email) {
      this.logger.warn(`No email for client ${dto.clientId} — chase not delivered`);
      return;
    }

    if (dto.channel === 'email') {
      const meta = await this.mailService.sendChaseEmail(
        client.email,
        dto.subject,
        dto.body,
        actingUserId,
      );
      await this.repo.update(logId, {
        fromEmail: meta.fromEmail,
        sendVia: meta.via,
      });
    } else {
      const tenant = await this.tenantRepo.findOne({ where: { id: tenantId } });
      this.logger.log(
        `[SMS STUB] To: ${client.name} (${tenant?.firmName ?? tenantId}) | ${dto.subject}`,
      );
    }
  }

  async listByClient(tenantId: string, clientId: string): Promise<ChaseLog[]> {
    return this.repo.find({
      where: { tenantId, clientId, deletedAt: IsNull() },
      order: { sentAt: 'DESC' },
    });
  }

  async updateStatus(tenantId: string, id: string, status: string): Promise<ChaseLog> {
    const log = await this.repo.findOne({
      where: { id, tenantId, deletedAt: IsNull() },
    });
    if (!log) throw new NotFoundException('Chase log not found');
    log.status = status;
    return this.repo.save(log);
  }

  /**
   * Client-level summary (legacy / dashboard). Counts all logs for the client.
   */
  async summaryForClients(
    tenantId: string,
    clientIds: string[],
    since?: Date,
  ): Promise<Map<string, ChaseLogSummary>> {
    if (clientIds.length === 0) return new Map();

    const logs = await this.repo.find({
      where: clientIds.map((cid) => ({ tenantId, clientId: cid, deletedAt: IsNull() })),
      order: { sentAt: 'DESC' },
    });

    const map = new Map<string, ChaseLogSummary>();
    for (const cid of clientIds) {
      const clientLogs = logs.filter((l) => {
        if (l.clientId !== cid) return false;
        if (!since) return true;
        return l.sentAt.getTime() >= since.getTime();
      });
      map.set(cid, {
        clientId: cid,
        lastChaseAt: clientLogs[0]?.sentAt ?? null,
        chaseCount: clientLogs.length,
        lastStatus: clientLogs[0]?.status ?? null,
      });
    }
    return map;
  }

  /**
   * Per-business chase summary. Key = clientId::businessId (empty businessId = legacy).
   */
  async summaryForBusinesses(
    tenantId: string,
    targets: Array<{ clientId: string; businessId?: string | null }>,
    since?: Date,
  ): Promise<Map<string, ChaseBusinessSummary>> {
    if (targets.length === 0) return new Map();

    const clientIds = [...new Set(targets.map((t) => t.clientId))];
    const logs = await this.repo.find({
      where: clientIds.map((cid) => ({ tenantId, clientId: cid, deletedAt: IsNull() })),
      order: { sentAt: 'DESC' },
    });

    const map = new Map<string, ChaseBusinessSummary>();
    for (const t of targets) {
      const bizId = t.businessId ?? null;
      const key = chaseRowKey(t.clientId, bizId);
      const matched = logs.filter((l) => {
        if (l.clientId !== t.clientId) return false;
        const logBiz = l.businessId ?? null;
        if (bizId) {
          if (logBiz !== bizId) return false;
        } else if (logBiz) {
          return false;
        }
        if (!since) return true;
        return l.sentAt.getTime() >= since.getTime();
      });
      map.set(key, {
        clientId: t.clientId,
        businessId: bizId,
        lastChaseAt: matched[0]?.sentAt ?? null,
        chaseCount: matched.length,
        lastStatus: matched[0]?.status ?? null,
      });
    }
    return map;
  }

  /**
   * Per-business×period chase summary.
   * Key = clientId::businessId::periodStartDate
   */
  async summaryForPeriods(
    tenantId: string,
    targets: Array<{
      clientId: string;
      businessId?: string | null;
      periodStartDate?: string | null;
    }>,
    since?: Date,
  ): Promise<Map<string, ChasePeriodSummary>> {
    if (targets.length === 0) return new Map();

    const clientIds = [...new Set(targets.map((t) => t.clientId))];
    const logs = await this.repo.find({
      where: clientIds.map((cid) => ({ tenantId, clientId: cid, deletedAt: IsNull() })),
      order: { sentAt: 'DESC' },
    });

    const map = new Map<string, ChasePeriodSummary>();
    for (const t of targets) {
      const bizId = t.businessId ?? null;
      const period = normalizeDateKey(t.periodStartDate);
      const key = chasePeriodRowKey(t.clientId, bizId, period);
      const matched = logs.filter((l) => {
        if (l.clientId !== t.clientId) return false;
        const logBiz = l.businessId ?? null;
        if (bizId) {
          if (logBiz !== bizId) return false;
        } else if (logBiz) {
          return false;
        }
        const logPeriod = normalizeDateKey(l.periodStartDate);
        if (period) {
          if (logPeriod !== period) return false;
        } else if (logPeriod) {
          return false;
        }
        if (!since) return true;
        return l.sentAt.getTime() >= since.getTime();
      });
      map.set(key, {
        clientId: t.clientId,
        businessId: bizId,
        periodStartDate: period,
        lastChaseAt: matched[0]?.sentAt ?? null,
        chaseCount: matched.length,
        lastStatus: matched[0]?.status ?? null,
      });
    }
    return map;
  }
}
