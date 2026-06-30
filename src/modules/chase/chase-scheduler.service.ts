import { Injectable, Logger } from '@nestjs/common';
import { Cron, CronExpression } from '@nestjs/schedule';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Tenant } from '../tenants/entities/tenant.entity';
import { ChaseService } from './chase.service';
import { ChaseLogsService } from '../chase-logs/chase-logs.service';
import { ChaseTemplatesService } from '../chase-templates/chase-templates.service';
import { renderTemplate } from './chase-template-vars.util';
import { currentChaseQuarter } from './chase-template-vars.util';

/**
 * Minimum days that must have passed since the last chase before we auto-send again.
 * Prevents duplicate sends if the cron runs more than once or a manual chase was sent recently.
 */
const CHASE_COOLDOWN_DAYS = 6;

/**
 * How many days before the deadline we send the "upcoming" reminder.
 * e.g. 7 = send when exactly 7 days (or fewer) remain AND cooldown is clear.
 */
const UPCOMING_TRIGGER_DAYS = 7;

@Injectable()
export class ChaseSchedulerService {
  private readonly logger = new Logger(ChaseSchedulerService.name);

  constructor(
    @InjectRepository(Tenant)
    private readonly tenantRepo: Repository<Tenant>,
    private readonly chaseService: ChaseService,
    private readonly chaseLogsService: ChaseLogsService,
    private readonly chaseTemplatesService: ChaseTemplatesService,
  ) {}

  /**
   * Runs every day at 08:00 UTC.
   * For every tenant, identifies clients that need chasing and auto-sends the appropriate template.
   *
   * Auto-trigger rules:
   *   Overdue  (daysOverdue >= 1): send on day 1, then again after COOLDOWN days
   *   Upcoming (daysOverdue between -UPCOMING_TRIGGER_DAYS and -1): send once per cooldown window
   *
   * Skips clients that were chased within the last CHASE_COOLDOWN_DAYS days.
   */
  @Cron(CronExpression.EVERY_DAY_AT_8AM)
  async runDailyChase(): Promise<void> {
    this.logger.log('Auto-chase scheduler started');

    const tenants = await this.tenantRepo.find();
    if (tenants.length === 0) {
      this.logger.log('No tenants found — skipping auto-chase');
      return;
    }

    let totalSent = 0;
    let totalSkipped = 0;

    for (const tenant of tenants) {
      try {
        const { sent, skipped } = await this.processTenant(tenant);
        totalSent += sent;
        totalSkipped += skipped;
      } catch (err) {
        this.logger.error(`Auto-chase failed for tenant ${tenant.id}`, err);
      }
    }

    this.logger.log(
      `Auto-chase complete — sent: ${totalSent}, skipped (cooldown/no-trigger): ${totalSkipped}`,
    );
  }

  // ─── Per-tenant logic ──────────────────────────────────────────────────────

  private async processTenant(tenant: Tenant): Promise<{ sent: number; skipped: number }> {
    const clients = await this.chaseService.listNeedsChasing(tenant.id);
    if (clients.length === 0) return { sent: 0, skipped: 0 };

    const templates = await this.chaseTemplatesService.list(tenant.id);
    const quarter = currentChaseQuarter();
    const now = new Date();

    const firmName = tenant.firmName ?? 'Your accountancy firm';
    const agentName = tenant.contactName ?? 'Your accountant';

    let sent = 0;
    let skipped = 0;

    for (const client of clients) {
      // ── Decide whether this client needs a chase today ──────────────────────

      const isOverdue = client.daysOverdue >= 1;
      const isUpcoming =
        client.daysOverdue >= -UPCOMING_TRIGGER_DAYS && client.daysOverdue < 0;

      if (!isOverdue && !isUpcoming) {
        skipped++;
        continue;
      }

      // ── Cooldown check — skip if chased recently ────────────────────────────
      if (client.lastChase) {
        const lastChaseDate = new Date(client.lastChase);
        const daysSince = Math.floor(
          (now.getTime() - lastChaseDate.getTime()) / 86_400_000,
        );
        if (daysSince < CHASE_COOLDOWN_DAYS) {
          skipped++;
          continue;
        }
      }

      // ── Pick template ────────────────────────────────────────────────────────
      const template = this.pickTemplate(
        templates,
        client.workflowType,
        isOverdue,
      );

      if (!template) {
        this.logger.warn(
          `No suitable template found for client ${client.id} (workflowType=${client.workflowType}, overdue=${isOverdue})`,
        );
        skipped++;
        continue;
      }

      // ── Render template variables ────────────────────────────────────────────
      const vars = {
        name: client.name,
        business: client.business,
        quarter: quarter.label,
        deadline: quarter.deadlineFormatted,
        agent_name: agentName,
        firm_name: firmName,
      };

      const subject = renderTemplate(template.subject, vars);
      const body = renderTemplate(template.body, vars);

      // ── Create chase log + send email ────────────────────────────────────────
      try {
        await this.chaseLogsService.create(tenant.id, {
          clientId: client.id,
          templateId: template.id,
          channel: 'email',
          subject,
          body,
        });
        sent++;
        this.logger.debug(
          `Auto-chase sent to client ${client.id} (tenant ${tenant.id}): "${subject}"`,
        );
      } catch (err) {
        this.logger.error(
          `Auto-chase send failed for client ${client.id} (tenant ${tenant.id})`,
          err,
        );
        skipped++;
      }
    }

    return { sent, skipped };
  }

  /**
   * Picks the best default template based on workflow type and urgency.
   *
   * Priority:
   *   bookkeeping + overdue  → "Bookkeeping overdue"
   *   bookkeeping + upcoming → "Bookkeeping reminder"
   *   data-request + overdue → "Data request (urgent)"
   *   data-request + upcoming→ "Data request (gentle)"
   *   general / unknown      → first available default template
   */
  private pickTemplate(
    templates: { id: string; name: string; type: string; subject: string; body: string; isDefault: boolean }[],
    workflowType: string,
    isOverdue: boolean,
  ) {
    const defaults = templates.filter((t) => t.isDefault);

    if (workflowType === 'bookkeeping') {
      const target = isOverdue ? 'Bookkeeping overdue' : 'Bookkeeping reminder';
      const match = defaults.find((t) => t.name === target);
      if (match) return match;
      // Fallback to any bookkeeping default
      return defaults.find((t) => t.type === 'bookkeeping') ?? defaults[0] ?? null;
    }

    if (workflowType === 'data-request') {
      const target = isOverdue ? 'Data request (urgent)' : 'Data request (gentle)';
      const match = defaults.find((t) => t.name === target);
      if (match) return match;
      return defaults.find((t) => t.type === 'data-request') ?? defaults[0] ?? null;
    }

    // Unknown workflow type — use first available default
    return defaults[0] ?? null;
  }
}
