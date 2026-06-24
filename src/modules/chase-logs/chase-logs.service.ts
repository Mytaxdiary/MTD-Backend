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
   */
  async create(tenantId: string, dto: CreateChaseLogDto): Promise<ChaseLog> {
    const log = this.repo.create({
      ...dto,
      tenantId,
      sentAt: new Date(),
      status: 'sent',
    });
    const saved = await this.repo.save(log);

    // Fire-and-forget: send the actual email / log SMS
    void this.dispatch(tenantId, dto).catch((err: unknown) => {
      this.logger.error(`Chase dispatch failed for client ${dto.clientId}`, err);
    });

    return saved;
  }

  /**
   * Resolve client email + send via MailService (email) or log stub (SMS).
   */
  private async dispatch(tenantId: string, dto: CreateChaseLogDto): Promise<void> {
    const client = await this.clientRepo.findOne({
      where: { id: dto.clientId, tenantId },
    });
    if (!client?.email) {
      this.logger.warn(`No email for client ${dto.clientId} — chase not delivered`);
      return;
    }

    if (dto.channel === 'email') {
      await this.mailService.sendChaseEmail(client.email, dto.subject, dto.body);
    } else {
      // SMS stub — log for now, integrate SMS provider later
      const tenant = await this.tenantRepo.findOne({ where: { id: tenantId } });
      this.logger.log(
        `[SMS STUB] To: ${client.name} (${tenant?.firmName ?? tenantId}) | ${dto.subject}`,
      );
    }
  }

  /**
   * List all chase logs for a specific client (newest first).
   */
  async listByClient(tenantId: string, clientId: string): Promise<ChaseLog[]> {
    return this.repo.find({
      where: { tenantId, clientId, deletedAt: IsNull() },
      order: { sentAt: 'DESC' },
    });
  }

  /**
   * Update the status of a chase log (e.g. opened, responded, bounced).
   */
  async updateStatus(
    tenantId: string,
    id: string,
    status: string,
  ): Promise<ChaseLog> {
    const log = await this.repo.findOne({
      where: { id, tenantId, deletedAt: IsNull() },
    });
    if (!log) throw new NotFoundException('Chase log not found');
    log.status = status;
    return this.repo.save(log);
  }

  /**
   * Returns a summary map of clientId → { lastChaseAt, chaseCount, lastStatus }
   * for a given list of client IDs. Used by the chase/clients endpoint.
   */
  async summaryForClients(
    tenantId: string,
    clientIds: string[],
  ): Promise<Map<string, ChaseLogSummary>> {
    if (clientIds.length === 0) return new Map();

    const logs = await this.repo.find({
      where: clientIds.map((cid) => ({ tenantId, clientId: cid, deletedAt: IsNull() })),
      order: { sentAt: 'DESC' },
    });

    const map = new Map<string, ChaseLogSummary>();
    for (const cid of clientIds) {
      const clientLogs = logs.filter((l) => l.clientId === cid);
      map.set(cid, {
        clientId: cid,
        lastChaseAt: clientLogs[0]?.sentAt ?? null,
        chaseCount: clientLogs.length,
        lastStatus: clientLogs[0]?.status ?? null,
      });
    }
    return map;
  }
}
