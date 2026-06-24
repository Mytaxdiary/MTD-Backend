import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { IsNull, Not, Repository } from 'typeorm';
import { Client } from '../clients/entities/client.entity';
import { ChaseLogsService } from '../chase-logs/chase-logs.service';
import { currentChaseQuarter } from './chase-template-vars.util';

export type ChaseClientDto = {
  id: string;
  name: string;
  /** NINO — used as secondary identifier */
  business: string;
  deadline: string;
  /** positive = overdue days, negative = days remaining */
  daysOverdue: number;
  /** quarter label e.g. "Q1 2026–27" */
  quarter: string;
  lastChase: string | null;
  chaseCount: number;
  /** last chase status: sent | opened | responded | bounced | null */
  status: string;
  /** email | sms */
  channel: string;
  /** bookkeeping | data-request — defaults to 'bookkeeping' if not set */
  workflowType: string;
};

@Injectable()
export class ChaseService {
  constructor(
    @InjectRepository(Client)
    private readonly clientRepo: Repository<Client>,
    private readonly chaseLogsService: ChaseLogsService,
  ) {}

  /**
   * Returns all authorised clients for the tenant with their chase info.
   * Clients are sorted: overdue first (descending daysOverdue), then upcoming.
   */
  async listNeedsChasing(tenantId: string): Promise<ChaseClientDto[]> {
    const authorisedClients = await this.clientRepo.find({
      where: { tenantId, authorisedAt: Not(IsNull()) },
      order: { createdAt: 'ASC' },
    });

    if (authorisedClients.length === 0) return [];

    const quarter = currentChaseQuarter();
    const clientIds = authorisedClients.map((c) => c.id);
    const summaryMap = await this.chaseLogsService.summaryForClients(tenantId, clientIds);

    const rows: ChaseClientDto[] = authorisedClients.map((c) => {
      const summary = summaryMap.get(c.id);
      const lastChaseAt = summary?.lastChaseAt ?? null;

      // Determine effective status from last chase
      let status = 'not-started';
      if (lastChaseAt) {
        status = summary?.lastStatus ?? 'sent';
      }

      return {
        id: c.id,
        name: c.name,
        business: c.nino,
        deadline: quarter.deadlineFormatted,
        daysOverdue: quarter.daysOverdue,
        quarter: quarter.label,
        lastChase: lastChaseAt
          ? lastChaseAt.toLocaleDateString('en-GB', {
              day: 'numeric',
              month: 'short',
              year: 'numeric',
            })
          : null,
        chaseCount: summary?.chaseCount ?? 0,
        status,
        channel: 'email',
        workflowType: c.workflowType ?? 'bookkeeping',
      };
    });

    // Sort: overdue first (daysOverdue > 0 desc), then upcoming (asc by daysOverdue)
    return rows.sort((a, b) => {
      if (a.daysOverdue > 0 && b.daysOverdue <= 0) return -1;
      if (a.daysOverdue <= 0 && b.daysOverdue > 0) return 1;
      if (a.daysOverdue > 0 && b.daysOverdue > 0) return b.daysOverdue - a.daysOverdue;
      return a.daysOverdue - b.daysOverdue;
    });
  }
}
