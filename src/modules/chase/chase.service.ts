import { Injectable, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { IsNull, Not, Repository } from 'typeorm';
import { Client } from '../clients/entities/client.entity';
import { ClientsService } from '../clients/clients.service';
import { ChaseLogsService, chasePeriodRowKey } from '../chase-logs/chase-logs.service';
import type { ListChaseClientsQueryDto } from './dto/list-chase-clients-query.dto';
import type { RequestUser } from '../auth/strategies/jwt.strategy';
import { staffClientWhere } from '../clients/staff-client-scope.util';
import {
  chaseGreetingName,
  currentChaseQuarter,
  currentUkTaxYearDateRange,
  daysBetween,
  formatUkLongDate,
  quarterLabelFromPeriodStart,
  ukQuarterCodeFromPeriodStart,
} from './chase-template-vars.util';

export type ChaseClientDto = {
  /** Unique row key: clientId::businessId::periodStartDate */
  rowKey: string;
  id: string;
  businessId: string | null;
  businessName: string | null;
  typeOfBusiness: string | null;
  periodStartDate: string | null;
  periodEndDate: string | null;
  dueDate: string | null;
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
  /** True when HMRC obligations failed and calendar fallback was used */
  obligationsFallback?: boolean;
};

export type ChaseClientsPage = {
  clients: ChaseClientDto[];
  page: number;
  limit: number;
  totalClients: number;
  totalPages: number;
};

const HMRC_CONCURRENCY = 4;

async function mapPool<T, R>(
  items: T[],
  concurrency: number,
  fn: (item: T, index: number) => Promise<R>,
): Promise<R[]> {
  const results: R[] = new Array(items.length);
  let next = 0;
  async function worker(): Promise<void> {
    while (next < items.length) {
      const i = next++;
      results[i] = await fn(items[i], i);
    }
  }
  const workers = Array.from({ length: Math.min(concurrency, items.length) }, () => worker());
  await Promise.all(workers);
  return results;
}

@Injectable()
export class ChaseService {
  private readonly logger = new Logger(ChaseService.name);

  constructor(
    @InjectRepository(Client)
    private readonly clientRepo: Repository<Client>,
    private readonly chaseLogsService: ChaseLogsService,
    private readonly clientsService: ClientsService,
  ) {}

  /**
   * Paginated chase list: authorised clients → page → HMRC open obligations →
   * one row per business × open period. Fulfilled periods never appear.
   */
  async listNeedsChasing(
    tenantId: string,
    query: ListChaseClientsQueryDto = {},
    actor?: RequestUser | null,
  ): Promise<ChaseClientsPage> {
    const page = Math.max(1, Number(query.page) || 1);
    const limit = Math.min(50, Math.max(1, Number(query.limit) || 5));
    const search = (query.search ?? '').trim().toLowerCase();
    const quarterFilter = (query.quarter ?? 'all').toUpperCase();
    const sortBy = query.sortBy ?? 'deadline';
    const sortDir = query.sortDir ?? 'desc';

    let authorised = await this.clientRepo.find({
      where: staffClientWhere(tenantId, actor, { authorisedAt: Not(IsNull()) }),
      order: { createdAt: 'ASC' },
    });

    if (search) {
      authorised = authorised.filter((c) => {
        const name = (c.name ?? '').toLowerCase();
        const preferred = (c.preferredName ?? '').toLowerCase();
        return name.includes(search) || preferred.includes(search);
      });
    }

    // Stable client order before paging (name then id)
    authorised.sort((a, b) => {
      const cmp = a.name.localeCompare(b.name);
      return cmp !== 0 ? cmp : a.id.localeCompare(b.id);
    });

    const totalClients = authorised.length;
    const totalPages = Math.max(1, Math.ceil(totalClients / limit) || 1);
    const safePage = Math.min(page, totalPages);
    const offset = (safePage - 1) * limit;
    const pageClients = authorised.slice(offset, offset + limit);

    if (pageClients.length === 0) {
      return { clients: [], page: safePage, limit, totalClients, totalPages };
    }

    const expanded = await mapPool(pageClients, HMRC_CONCURRENCY, async (c) =>
      this.expandClientOpenPeriods(tenantId, c),
    );
    let rows = expanded.flat();

    if (quarterFilter !== 'ALL' && ['Q1', 'Q2', 'Q3', 'Q4'].includes(quarterFilter)) {
      rows = rows.filter((r) => {
        if (!r.periodStartDate) {
          // Fallback calendar row: match by quarter label prefix
          return r.quarter.toUpperCase().startsWith(quarterFilter);
        }
        return ukQuarterCodeFromPeriodStart(r.periodStartDate) === quarterFilter;
      });
    }

    rows = this.sortRows(rows, sortBy, sortDir);

    const targets = rows.map((r) => ({
      clientId: r.id,
      businessId: r.businessId,
      periodStartDate: r.periodStartDate,
    }));
    const summaryMap = await this.chaseLogsService.summaryForPeriods(tenantId, targets);

    const clients = rows.map((r) => {
      const key = chasePeriodRowKey(r.id, r.businessId, r.periodStartDate);
      const summary = summaryMap.get(key);
      const lastChaseAt = summary?.lastChaseAt ?? null;
      return {
        ...r,
        rowKey: key,
        lastChase: lastChaseAt
          ? lastChaseAt.toLocaleDateString('en-GB', {
              day: 'numeric',
              month: 'short',
              year: 'numeric',
            })
          : null,
        chaseCount: summary?.chaseCount ?? 0,
        status: lastChaseAt ? (summary?.lastStatus ?? 'sent') : 'not-started',
      };
    });

    return { clients, page: safePage, limit, totalClients, totalPages };
  }

  /**
   * Internal: walk every authorised client page for auto-chase (no UI pagination).
   */
  async listAllNeedsChasing(tenantId: string): Promise<ChaseClientDto[]> {
    const first = await this.listNeedsChasing(tenantId, { page: 1, limit: 5 });
    const all = [...first.clients];
    for (let p = 2; p <= first.totalPages; p++) {
      const next = await this.listNeedsChasing(tenantId, { page: p, limit: 5 });
      all.push(...next.clients);
    }
    return all;
  }

  private async expandClientOpenPeriods(
    tenantId: string,
    client: Client,
  ): Promise<ChaseClientDto[]> {
    const { fromDate, toDate } = currentUkTaxYearDateRange();
    try {
      const res = await this.clientsService.getIncomeAndExpenditureObligations(
        tenantId,
        client.id,
        { fromDate, toDate, status: 'open' },
      );
      const groups = res.obligations ?? [];
      const rows: ChaseClientDto[] = [];

      for (const group of groups) {
        const details = group.obligationDetails ?? [];
        for (const ob of details) {
          if ((ob.status ?? '').toLowerCase() === 'fulfilled') continue;
          const periodStart = (ob.periodStartDate ?? '').slice(0, 10);
          const periodEnd = (ob.periodEndDate ?? '').slice(0, 10);
          const due = (ob.dueDate ?? '').slice(0, 10);
          if (!periodStart || !periodEnd || !due) continue;

          const daysOverdue = daysBetween(due);
          const daysSincePeriodEnd = daysBetween(periodEnd);
          const quarter = quarterLabelFromPeriodStart(periodStart);
          const businessName = group.typeOfBusiness?.replace(/-/g, ' ') || group.businessId || null;

          rows.push({
            rowKey: chasePeriodRowKey(client.id, group.businessId, periodStart),
            id: client.id,
            businessId: group.businessId ?? null,
            businessName,
            typeOfBusiness: group.typeOfBusiness ?? null,
            periodStartDate: periodStart,
            periodEndDate: periodEnd,
            dueDate: due,
            name: client.name,
            preferredName: client.preferredName,
            greetingName: chaseGreetingName(client.name, client.preferredName),
            business: client.nino,
            deadline: formatUkLongDate(due),
            daysOverdue,
            daysSincePeriodEnd,
            quarter,
            lastChase: null,
            chaseCount: 0,
            status: 'not-started',
            channel: 'email',
            workflowType: client.workflowType ?? 'bookkeeping',
          });
        }
      }

      if (rows.length > 0) return rows;

      // Authorised but no open obligations this tax year — nothing to chase
      return [];
    } catch (err) {
      this.logger.warn(
        `Obligations fetch failed for client ${client.id}; using calendar fallback`,
        err instanceof Error ? err.message : String(err),
      );
      return this.fallbackBusinessRows(tenantId, client);
    }
  }

  private async fallbackBusinessRows(tenantId: string, client: Client): Promise<ChaseClientDto[]> {
    const quarter = currentChaseQuarter();
    const toIsoDate = (d: Date) => {
      const y = d.getFullYear();
      const m = String(d.getMonth() + 1).padStart(2, '0');
      const day = String(d.getDate()).padStart(2, '0');
      return `${y}-${m}-${day}`;
    };
    const periodStart = toIsoDate(quarter.periodStartDate);
    const periodEnd = toIsoDate(quarter.periodEndDate);
    const due = toIsoDate(quarter.deadline);

    let businesses: Array<{ businessId: string; typeOfBusiness: string; tradingName?: string }> =
      [];
    try {
      businesses = await this.clientsService.listBusinessIncomeSources(tenantId, client.id);
    } catch {
      businesses = [];
    }

    const sources =
      businesses.length > 0
        ? businesses
        : [{ businessId: '', typeOfBusiness: '', tradingName: undefined }];

    return sources.map((b) => {
      const businessId = b.businessId || null;
      return {
        rowKey: chasePeriodRowKey(client.id, businessId, periodStart),
        id: client.id,
        businessId,
        businessName: b.tradingName?.trim() || b.typeOfBusiness || null,
        typeOfBusiness: b.typeOfBusiness || null,
        periodStartDate: periodStart,
        periodEndDate: periodEnd,
        dueDate: due,
        name: client.name,
        preferredName: client.preferredName,
        greetingName: chaseGreetingName(client.name, client.preferredName),
        business: client.nino,
        deadline: quarter.deadlineFormatted,
        daysOverdue: quarter.daysOverdue,
        daysSincePeriodEnd: quarter.daysSincePeriodEnd,
        quarter: quarter.label,
        lastChase: null,
        chaseCount: 0,
        status: 'not-started',
        channel: 'email',
        workflowType: client.workflowType ?? 'bookkeeping',
        obligationsFallback: true,
      };
    });
  }

  private sortRows(
    rows: ChaseClientDto[],
    sortBy: 'quarter' | 'deadline' | 'name',
    sortDir: 'asc' | 'desc',
  ): ChaseClientDto[] {
    const dir = sortDir === 'asc' ? 1 : -1;
    return [...rows].sort((a, b) => {
      let cmp = 0;
      if (sortBy === 'name') {
        cmp = a.name.localeCompare(b.name);
        if (cmp === 0) {
          cmp = (a.periodStartDate ?? '').localeCompare(b.periodStartDate ?? '');
        }
      } else if (sortBy === 'quarter') {
        cmp = (a.periodStartDate ?? '').localeCompare(b.periodStartDate ?? '');
        if (cmp === 0) cmp = a.name.localeCompare(b.name);
      } else {
        // deadline
        cmp = (a.dueDate ?? '').localeCompare(b.dueDate ?? '');
        if (cmp === 0) cmp = a.name.localeCompare(b.name);
      }
      if (cmp !== 0) return cmp * dir;
      return (a.businessName ?? '').localeCompare(b.businessName ?? '');
    });
  }
}
