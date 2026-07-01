import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Client } from '../clients/entities/client.entity';
import { ChaseLogsService } from '../chase-logs/chase-logs.service';
import { currentChaseQuarter } from '../chase/chase-template-vars.util';

export type DashboardClientRow = {
  id: string;
  name: string;
  invitationStatus: string;
  authorisedAt: string | null;
  /** overdue | due-soon | authorized | pending-invite */
  status: string;
  /** not-started | chased | received */
  stage: string;
  /** e.g. "Q4" */
  quarter: string;
  /** e.g. "7 May 2026" */
  deadline: string;
  /** positive = days remaining, negative = days overdue */
  daysLeft: number;
  chase: string;
  chaseCount: number;
  /** always false — no backend model for internal "records received" state */
  records: boolean;
  /** always [] — requires separate HMRC businesses API call per client */
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
    overdue: number;
    dueSoon: number;
  };
  clients: DashboardClientRow[];
};

function formatChaseText(
  lastChaseAt: Date | null,
  lastStatus: string,
): string {
  if (!lastChaseAt) return 'Not chased';
  const daysAgo = Math.floor((Date.now() - lastChaseAt.getTime()) / 86_400_000);
  if (lastStatus === 'responded') return 'Records received';
  if (lastStatus === 'bounced') return 'Bounced';
  const ago = daysAgo === 0 ? 'today' : `${daysAgo}d ago`;
  if (lastStatus === 'opened') return `Chased ${ago} (opened)`;
  return `Chased ${ago}`;
}

function deriveQDots(
  isAuthorised: boolean,
  currentQNum: number,
  daysOverdue: number,
): { q1: string; q2: string; q3: string; q4: string } {
  if (!isAuthorised) {
    return { q1: 'N/A', q2: 'N/A', q3: 'N/A', q4: 'N/A' };
  }
  const dots: Record<string, string> = { q1: 'pending', q2: 'pending', q3: 'pending', q4: 'pending' };
  if (daysOverdue > 0) dots[`q${currentQNum}`] = 'overdue';
  return dots as { q1: string; q2: string; q3: string; q4: string };
}

@Injectable()
export class DashboardService {
  constructor(
    @InjectRepository(Client)
    private readonly clientRepo: Repository<Client>,
    private readonly chaseLogsService: ChaseLogsService,
  ) {}

  async getSummary(tenantId: string): Promise<DashboardSummary> {
    const clients = await this.clientRepo.find({
      where: { tenantId },
      order: { createdAt: 'ASC' },
    });

    const quarter = currentChaseQuarter();
    const currentQNum = parseInt(quarter.label.charAt(1)); // "Q4 2025–26" → 4
    const daysOverdue = quarter.daysOverdue;

    const now = new Date();
    const taxYearStart = now.getMonth() >= 3 ? now.getFullYear() : now.getFullYear() - 1;
    const currentTaxYear = `${taxYearStart}-${String(taxYearStart + 1).slice(2)}`;

    const clientIds = clients.map((c) => c.id);
    const summaryMap =
      clientIds.length > 0
        ? await this.chaseLogsService.summaryForClients(tenantId, clientIds)
        : new Map<string, { lastChaseAt: Date; lastStatus: string; chaseCount: number }>();

    const rows: DashboardClientRow[] = clients.map((c) => {
      const isAuthorised = !!c.authorisedAt;
      const summary = summaryMap.get(c.id);
      const lastChaseAt: Date | null = summary?.lastChaseAt ?? null;
      const lastStatus = summary?.lastStatus ?? '';
      const chaseCount = summary?.chaseCount ?? 0;

      let status: string;
      if (!isAuthorised) {
        status = 'pending-invite';
      } else if (daysOverdue > 0) {
        status = 'overdue';
      } else if (daysOverdue >= -30) {
        status = 'due-soon';
      } else {
        status = 'authorized';
      }

      let stage = 'not-started';
      if (isAuthorised && lastChaseAt) {
        stage = lastStatus === 'responded' ? 'received' : 'chased';
      }

      return {
        id: c.id,
        name: c.name,
        invitationStatus: c.invitationStatus,
        authorisedAt: c.authorisedAt?.toISOString() ?? null,
        status,
        stage,
        quarter: `Q${currentQNum}`,
        deadline: isAuthorised ? quarter.deadlineFormatted : 'N/A',
        daysLeft: isAuthorised ? -daysOverdue : 0,
        chase: formatChaseText(lastChaseAt, lastStatus),
        chaseCount,
        records: false,
        type: [],
        ...deriveQDots(isAuthorised, currentQNum, daysOverdue),
      };
    });

    return {
      currentTaxYear,
      currentQuarter: `Q${currentQNum}`,
      currentDeadline: quarter.deadlineFormatted,
      metrics: {
        total: rows.length,
        pendingInvites: rows.filter((r) => r.status === 'pending-invite').length,
        overdue: rows.filter((r) => r.status === 'overdue').length,
        dueSoon: rows.filter((r) => r.status === 'due-soon').length,
      },
      clients: rows,
    };
  }
}
