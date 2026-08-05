import { Injectable, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Client } from '../clients/entities/client.entity';
import { ClientsService } from '../clients/clients.service';
import { ChaseLogsService } from '../chase-logs/chase-logs.service';
import { currentChaseQuarter, type QuarterInfo } from '../chase/chase-template-vars.util';
import { derivePipelineStatus, type PipelineStatus } from './pipeline-status';

export type DashboardClientRow = {
  id: string;
  name: string;
  invitationStatus: string;
  authorisedAt: string | null;
  /** Canonical pipeline status for list / kanban / year */
  pipelineStatus: PipelineStatus;
  /** @deprecated use pipelineStatus — kept briefly for older clients */
  status: PipelineStatus;
  /** @deprecated use pipelineStatus */
  stage: PipelineStatus;
  /** e.g. "Q4" */
  quarter: string;
  /** e.g. "7 May 2026" */
  deadline: string;
  /** positive = days remaining, negative = days overdue */
  daysLeft: number;
  chase: string;
  chaseCount: number;
  /** Phase 2 manual flag — always false in Phase 1 */
  records: boolean;
  type: string[];
  q1: string;
  q2: string;
  q3: string;
  q4: string;
};

export type DashboardSummary = {
  currentTaxYear: string;
  currentQuarter: string;
  currentDeadline: string;
  metrics: {
    total: number;
    pendingInvites: number;
    notStarted: number;
    chased: number;
    recordsReceived: number;
    readyForReview: number;
    submitted: number;
  };
  clients: DashboardClientRow[];
};

function formatChaseText(lastChaseAt: Date | null, lastStatus: string | null): string {
  if (!lastChaseAt) return 'Not chased';
  const daysAgo = Math.floor((Date.now() - lastChaseAt.getTime()) / 86_400_000);
  if (lastStatus === 'responded') return 'Client responded';
  if (lastStatus === 'bounced') return 'Bounced';
  const ago = daysAgo === 0 ? 'today' : `${daysAgo}d ago`;
  if (lastStatus === 'opened') return `Chased ${ago} (opened)`;
  return `Chased ${ago}`;
}

function ymd(d: Date): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

function deriveQDots(
  isAuthorised: boolean,
  currentQNum: number,
  pipelineStatus: PipelineStatus,
  daysOverdue: number,
): { q1: string; q2: string; q3: string; q4: string } {
  if (!isAuthorised) {
    return { q1: 'N/A', q2: 'N/A', q3: 'N/A', q4: 'N/A' };
  }
  const dots: Record<string, string> = {
    q1: 'pending',
    q2: 'pending',
    q3: 'pending',
    q4: 'pending',
  };
  const key = `q${currentQNum}`;
  if (pipelineStatus === 'submitted') dots[key] = 'filed';
  else if (daysOverdue > 0) dots[key] = 'overdue';
  else if (
    pipelineStatus === 'chased' ||
    pipelineStatus === 'records-received' ||
    pipelineStatus === 'ready-for-review'
  ) {
    dots[key] = 'ready';
  }
  return dots as { q1: string; q2: string; q3: string; q4: string };
}

/** Run async tasks with a fixed concurrency limit. */
async function mapPool<T, R>(
  items: T[],
  concurrency: number,
  fn: (item: T) => Promise<R>,
): Promise<R[]> {
  const results: R[] = new Array(items.length);
  let next = 0;

  async function worker(): Promise<void> {
    while (next < items.length) {
      const i = next++;
      results[i] = await fn(items[i]);
    }
  }

  const workers = Array.from({ length: Math.min(concurrency, items.length) }, () => worker());
  await Promise.all(workers);
  return results;
}

@Injectable()
export class DashboardService {
  private readonly logger = new Logger(DashboardService.name);

  constructor(
    @InjectRepository(Client)
    private readonly clientRepo: Repository<Client>,
    private readonly chaseLogsService: ChaseLogsService,
    private readonly clientsService: ClientsService,
  ) {}

  async getSummary(tenantId: string): Promise<DashboardSummary> {
    const clients = await this.clientRepo.find({
      where: { tenantId },
      order: { createdAt: 'ASC' },
    });

    const quarter = currentChaseQuarter();
    const currentQNum = parseInt(quarter.label.charAt(1), 10); // "Q4 2025–26" → 4
    const daysOverdue = quarter.daysOverdue;

    const now = new Date();
    const taxYearStart = now.getMonth() >= 3 ? now.getFullYear() : now.getFullYear() - 1;
    const currentTaxYear = `${taxYearStart}-${String(taxYearStart + 1).slice(2)}`;

    const clientIds = clients.map((c) => c.id);
    const summaryMap =
      clientIds.length > 0
        ? await this.chaseLogsService.summaryForClients(
            tenantId,
            clientIds,
            quarter.periodStartDate,
          )
        : new Map();

    const authorised = clients.filter((c) => !!c.authorisedAt);
    const submittedIds = await this.findSubmittedClientIds(tenantId, authorised, quarter);

    const rows: DashboardClientRow[] = clients.map((c) => {
      const isAuthorised = !!c.authorisedAt;
      const summary = summaryMap.get(c.id);
      const lastChaseAt: Date | null = summary?.lastChaseAt ?? null;
      const lastStatus = summary?.lastStatus ?? null;
      const chaseCount = summary?.chaseCount ?? 0;
      const chasedThisQuarter = chaseCount > 0;
      const submitted = submittedIds.has(c.id);

      const pipelineStatus = derivePipelineStatus({
        isAuthorised,
        submitted,
        chasedThisQuarter,
      });

      return {
        id: c.id,
        name: c.name,
        invitationStatus: c.invitationStatus,
        authorisedAt: c.authorisedAt?.toISOString() ?? null,
        pipelineStatus,
        status: pipelineStatus,
        stage: pipelineStatus,
        quarter: `Q${currentQNum}`,
        deadline: isAuthorised ? quarter.deadlineFormatted : 'N/A',
        daysLeft: isAuthorised ? -daysOverdue : 0,
        chase: formatChaseText(lastChaseAt, lastStatus),
        chaseCount,
        records: false,
        type: [],
        ...deriveQDots(isAuthorised, currentQNum, pipelineStatus, daysOverdue),
      };
    });

    const count = (s: PipelineStatus) => rows.filter((r) => r.pipelineStatus === s).length;

    return {
      currentTaxYear,
      currentQuarter: `Q${currentQNum}`,
      currentDeadline: quarter.deadlineFormatted,
      metrics: {
        total: rows.length,
        pendingInvites: count('pending-invite'),
        notStarted: count('not-started'),
        chased: count('chased'),
        recordsReceived: count('records-received'),
        readyForReview: count('ready-for-review'),
        submitted: count('submitted'),
      },
      clients: rows,
    };
  }

  /**
   * Best-effort: mark clients whose current-quarter I&E obligation is fulfilled on HMRC.
   * Failures are ignored so the dashboard still loads from auth + chase data.
   */
  private async findSubmittedClientIds(
    tenantId: string,
    authorised: Client[],
    quarter: QuarterInfo,
  ): Promise<Set<string>> {
    const submitted = new Set<string>();
    if (authorised.length === 0) return submitted;

    const fromDate = ymd(quarter.periodStartDate);
    const toDate = ymd(quarter.periodEndDate);
    const periodEndYmd = ymd(quarter.periodEndDate);

    await mapPool(authorised, 3, async (client) => {
      try {
        const res = await this.clientsService.getIncomeAndExpenditureObligations(
          tenantId,
          client.id,
          { fromDate, toDate },
          null,
        );
        const details = (res.obligations ?? []).flatMap((o) => o.obligationDetails ?? []);
        const match = details.find(
          (d) => d.periodEndDate === periodEndYmd && (d.status === 'fulfilled' || !!d.receivedDate),
        );
        if (match) submitted.add(client.id);
      } catch (err) {
        this.logger.debug(`Dashboard submitted check skipped for ${client.id}: ${String(err)}`);
      }
    });

    return submitted;
  }
}
