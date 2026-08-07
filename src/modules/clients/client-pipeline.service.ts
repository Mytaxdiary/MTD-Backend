import { BadRequestException, Injectable, Logger, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { In, IsNull, Repository } from 'typeorm';
import { Client } from './entities/client.entity';
import { ClientStatusHistory } from './entities/client-status-history.entity';
import { User } from '../users/entities/user.entity';
import {
  isManualPipelineStatus,
  isPipelineStatus,
  nextManualPipelineStatus,
  pipelineStatusRank,
  type ManualPipelineStatus,
  type PipelineStatus,
} from '../dashboard/pipeline-status';

export type StatusHistoryEntryDto = {
  id: string;
  fromStatus: string | null;
  toStatus: string;
  source: 'system' | 'agent';
  changedByUserId: string | null;
  changedByName: string | null;
  createdAt: string;
};

export type StatusHistoryResponse = {
  currentStatus: PipelineStatus;
  nextManualStatus: ManualPipelineStatus | null;
  history: StatusHistoryEntryDto[];
};

@Injectable()
export class ClientPipelineService {
  private readonly logger = new Logger(ClientPipelineService.name);

  constructor(
    @InjectRepository(Client)
    private readonly clientRepo: Repository<Client>,
    @InjectRepository(ClientStatusHistory)
    private readonly historyRepo: Repository<ClientStatusHistory>,
    @InjectRepository(User)
    private readonly userRepo: Repository<User>,
  ) {}

  /**
   * Persist a forward (or equal no-op) pipeline transition and append audit history.
   * System transitions only move forward by rank; agent transitions must be the exact next manual step.
   */
  async transition(
    tenantId: string,
    clientId: string,
    toStatus: PipelineStatus,
    opts: {
      source: 'system' | 'agent';
      userId?: string | null;
    },
  ): Promise<Client> {
    const client = await this.clientRepo.findOne({
      where: { id: clientId, tenantId, deletedAt: IsNull() },
    });
    if (!client) throw new NotFoundException('Client not found');

    const fromRaw = client.pipelineStatus;
    const fromStatus: PipelineStatus = isPipelineStatus(fromRaw) ? fromRaw : 'pending-invite';

    if (fromStatus === toStatus) {
      return client;
    }

    if (opts.source === 'agent') {
      if (!isManualPipelineStatus(toStatus)) {
        throw new BadRequestException('Agents can only set Records received or Ready for review.');
      }
      const expected = nextManualPipelineStatus(fromStatus);
      if (expected !== toStatus) {
        throw new BadRequestException(
          expected
            ? `Next allowed status is ${expected}.`
            : `Cannot change status from ${fromStatus} manually.`,
        );
      }
    } else if (pipelineStatusRank(toStatus) <= pipelineStatusRank(fromStatus)) {
      // System never downgrades or rewrites equal/lower statuses.
      return client;
    }

    client.pipelineStatus = toStatus;
    await this.clientRepo.save(client);

    const history = this.historyRepo.create({
      tenantId,
      clientId,
      fromStatus,
      toStatus,
      source: opts.source,
      changedByUserId: opts.source === 'agent' ? (opts.userId ?? null) : null,
    });
    await this.historyRepo.save(history);

    this.logger.log(`Client ${clientId} pipeline ${fromStatus} → ${toStatus} (${opts.source})`);
    return client;
  }

  /** Record initial pending-invite history when a client is created. */
  async recordInitialStatus(tenantId: string, clientId: string): Promise<void> {
    const existing = await this.historyRepo.count({
      where: { tenantId, clientId, deletedAt: IsNull() },
    });
    if (existing > 0) return;

    await this.historyRepo.save(
      this.historyRepo.create({
        tenantId,
        clientId,
        fromStatus: null,
        toStatus: 'pending-invite',
        source: 'system',
        changedByUserId: null,
      }),
    );
  }

  async markNotStarted(tenantId: string, clientId: string): Promise<void> {
    await this.transition(tenantId, clientId, 'not-started', { source: 'system' });
  }

  async markChased(tenantId: string, clientId: string): Promise<void> {
    const client = await this.clientRepo.findOne({
      where: { id: clientId, tenantId, deletedAt: IsNull() },
    });
    if (!client) return;
    const from: PipelineStatus = isPipelineStatus(client.pipelineStatus)
      ? client.pipelineStatus
      : 'pending-invite';
    // Only auto-advance from not-started (not from pending-invite or manual stages).
    if (from !== 'not-started') return;
    await this.transition(tenantId, clientId, 'chased', { source: 'system' });
  }

  async markSubmitted(tenantId: string, clientId: string): Promise<void> {
    await this.transition(tenantId, clientId, 'submitted', { source: 'system' });
  }

  /** Best-effort batch for dashboard HMRC submitted detection. */
  async markSubmittedMany(tenantId: string, clientIds: string[]): Promise<void> {
    for (const clientId of clientIds) {
      try {
        await this.markSubmitted(tenantId, clientId);
      } catch (err) {
        this.logger.warn(`markSubmitted failed for ${clientId}: ${String(err)}`);
      }
    }
  }

  async setManualStatus(
    tenantId: string,
    clientId: string,
    status: ManualPipelineStatus,
    userId: string,
  ): Promise<StatusHistoryResponse> {
    await this.transition(tenantId, clientId, status, { source: 'agent', userId });
    return this.getStatusHistory(tenantId, clientId);
  }

  async getStatusHistory(tenantId: string, clientId: string): Promise<StatusHistoryResponse> {
    const client = await this.clientRepo.findOne({
      where: { id: clientId, tenantId, deletedAt: IsNull() },
    });
    if (!client) throw new NotFoundException('Client not found');

    const currentStatus: PipelineStatus = isPipelineStatus(client.pipelineStatus)
      ? client.pipelineStatus
      : 'pending-invite';

    const rows = await this.historyRepo.find({
      where: { tenantId, clientId, deletedAt: IsNull() },
      order: { createdAt: 'DESC' },
    });

    const userIds = [
      ...new Set(rows.map((r) => r.changedByUserId).filter((id): id is string => !!id)),
    ];
    const users =
      userIds.length > 0 ? await this.userRepo.find({ where: { id: In(userIds) } }) : [];
    const nameById = new Map(users.map((u) => [u.id, `${u.firstName} ${u.lastName}`.trim()]));

    return {
      currentStatus,
      nextManualStatus: nextManualPipelineStatus(currentStatus),
      history: rows.map((r) => ({
        id: r.id,
        fromStatus: r.fromStatus ?? null,
        toStatus: r.toStatus,
        source: r.source,
        changedByUserId: r.changedByUserId ?? null,
        changedByName: r.changedByUserId
          ? (nameById.get(r.changedByUserId) ?? 'Unknown user')
          : null,
        createdAt: r.createdAt.toISOString(),
      })),
    };
  }
}
