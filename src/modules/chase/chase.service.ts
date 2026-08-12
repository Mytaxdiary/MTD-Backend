import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { IsNull, Not, Repository } from 'typeorm';
import { Client } from '../clients/entities/client.entity';
import { ClientsService } from '../clients/clients.service';
import { ChaseLogsService, chaseRowKey } from '../chase-logs/chase-logs.service';
import { chaseGreetingName, currentChaseQuarter } from './chase-template-vars.util';

export type ChaseClientDto = {
  /** Unique row key: clientId::businessId */
  rowKey: string;
  id: string;
  businessId: string | null;
  /** HMRC trading name (or fallback label) */
  businessName: string | null;
  typeOfBusiness: string | null;
  /** Full legal name (for list display) */
  name: string;
  preferredName?: string;
  greetingName: string;
  /** NINO — legacy {business} template var */
  business: string;
  deadline: string;
  daysOverdue: number;
  daysSincePeriodEnd: number;
  quarter: string;
  lastChase: string | null;
  chaseCount: number;
  status: string;
  channel: string;
  workflowType: string;
};

@Injectable()
export class ChaseService {
  constructor(
    @InjectRepository(Client)
    private readonly clientRepo: Repository<Client>,
    private readonly chaseLogsService: ChaseLogsService,
    private readonly clientsService: ClientsService,
  ) {}

  /**
   * Authorised clients expanded to one row per HMRC business.
   * If HMRC returns no businesses, one fallback row (businessId null) is kept.
   */
  async listNeedsChasing(tenantId: string): Promise<ChaseClientDto[]> {
    const authorisedClients = await this.clientRepo.find({
      where: { tenantId, authorisedAt: Not(IsNull()) },
      order: { createdAt: 'ASC' },
    });

    if (authorisedClients.length === 0) return [];

    const quarter = currentChaseQuarter();

    const expanded = await Promise.all(
      authorisedClients.map(async (c) => {
        const businesses = await this.clientsService.listBusinessIncomeSources(tenantId, c.id);
        if (businesses.length === 0) {
          return [
            {
              client: c,
              businessId: null as string | null,
              businessName: null as string | null,
              typeOfBusiness: null as string | null,
            },
          ];
        }
        return businesses.map((b) => ({
          client: c,
          businessId: b.businessId,
          businessName: b.tradingName?.trim() || b.typeOfBusiness || b.businessId,
          typeOfBusiness: b.typeOfBusiness,
        }));
      }),
    );

    const flat = expanded.flat();
    const targets = flat.map((r) => ({
      clientId: r.client.id,
      businessId: r.businessId,
    }));
    const summaryMap = await this.chaseLogsService.summaryForBusinesses(tenantId, targets);

    const rows: ChaseClientDto[] = flat.map((r) => {
      const key = chaseRowKey(r.client.id, r.businessId);
      const summary = summaryMap.get(key);
      const lastChaseAt = summary?.lastChaseAt ?? null;

      let status = 'not-started';
      if (lastChaseAt) {
        status = summary?.lastStatus ?? 'sent';
      }

      return {
        rowKey: key,
        id: r.client.id,
        businessId: r.businessId,
        businessName: r.businessName,
        typeOfBusiness: r.typeOfBusiness,
        name: r.client.name,
        preferredName: r.client.preferredName,
        greetingName: chaseGreetingName(r.client.name, r.client.preferredName),
        business: r.client.nino,
        deadline: quarter.deadlineFormatted,
        daysOverdue: quarter.daysOverdue,
        daysSincePeriodEnd: quarter.daysSincePeriodEnd,
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
        workflowType: r.client.workflowType ?? 'bookkeeping',
      };
    });

    return rows.sort((a, b) => {
      if (a.daysOverdue > 0 && b.daysOverdue <= 0) return -1;
      if (a.daysOverdue <= 0 && b.daysOverdue > 0) return 1;
      if (a.daysOverdue > 0 && b.daysOverdue > 0) return b.daysOverdue - a.daysOverdue;
      const nameCmp = a.name.localeCompare(b.name);
      if (nameCmp !== 0) return nameCmp;
      return (a.businessName ?? '').localeCompare(b.businessName ?? '');
    });
  }
}
