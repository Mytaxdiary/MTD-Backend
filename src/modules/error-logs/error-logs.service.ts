import { Injectable, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Brackets, Repository } from 'typeorm';
import { SystemErrorLog, type SystemErrorSource } from './entities/system-error-log.entity';

export type RecordSystemErrorInput = {
  source: SystemErrorSource;
  endpoint: string;
  message: string;
  httpMethod?: string | null;
  statusCode?: number | null;
  clientId?: string | null;
  clientLabel?: string | null;
  tenantId?: string | null;
  tenantLabel?: string | null;
  userId?: string | null;
  metadata?: Record<string, unknown> | null;
};

export type SystemErrorLogListItem = {
  id: string;
  source: SystemErrorSource;
  endpoint: string;
  httpMethod: string | null;
  statusCode: number | null;
  message: string;
  clientId: string | null;
  clientLabel: string | null;
  tenantId: string | null;
  tenantLabel: string | null;
  userId: string | null;
  metadata: Record<string, unknown> | null;
  createdAt: string;
};

export type SystemErrorLogListResponse = {
  items: SystemErrorLogListItem[];
  total: number;
  page: number;
  limit: number;
  totalPages: number;
};

@Injectable()
export class ErrorLogsService {
  private readonly logger = new Logger(ErrorLogsService.name);

  constructor(
    @InjectRepository(SystemErrorLog)
    private readonly errorLogRepo: Repository<SystemErrorLog>,
  ) {}

  /**
   * Persist a failed call / server error for the admin errors list.
   * Never throws — logging must not break the original request path.
   */
  async record(input: RecordSystemErrorInput): Promise<void> {
    try {
      const row = this.errorLogRepo.create({
        source: input.source,
        endpoint: this.truncate(input.endpoint, 500) || '(unknown)',
        httpMethod: input.httpMethod ? this.truncate(input.httpMethod, 16) : null,
        statusCode: input.statusCode ?? null,
        message: this.truncate(input.message, 1000) || 'Unknown error',
        clientId: input.clientId ?? null,
        clientLabel: input.clientLabel ? this.truncate(input.clientLabel, 255) : null,
        tenantId: input.tenantId ?? null,
        tenantLabel: input.tenantLabel ? this.truncate(input.tenantLabel, 255) : null,
        userId: input.userId ?? null,
        metadata: input.metadata ?? null,
      });
      await this.errorLogRepo.save(row);
    } catch (err) {
      this.logger.warn(`Failed to record system error log: ${String(err)}`);
    }
  }

  async listForAdmin(opts: {
    page?: number;
    limit?: number;
    source?: SystemErrorSource;
    statusCode?: number;
    from?: string;
    to?: string;
    search?: string;
  }): Promise<SystemErrorLogListResponse> {
    const page = Math.max(1, opts.page ?? 1);
    const limit = Math.min(100, Math.max(1, opts.limit ?? 20));
    const search = opts.search?.trim();

    const qb = this.errorLogRepo
      .createQueryBuilder('e')
      .orderBy('e.createdAt', 'DESC')
      .skip((page - 1) * limit)
      .take(limit);

    if (opts.source) {
      qb.andWhere('e.source = :source', { source: opts.source });
    }

    if (opts.statusCode != null) {
      qb.andWhere('e.statusCode = :statusCode', { statusCode: opts.statusCode });
    }

    if (opts.from) {
      const fromDate = new Date(opts.from);
      if (!Number.isNaN(fromDate.getTime())) {
        qb.andWhere('e.createdAt >= :from', { from: fromDate });
      }
    }

    if (opts.to) {
      const toDate = new Date(opts.to);
      if (!Number.isNaN(toDate.getTime())) {
        qb.andWhere('e.createdAt <= :to', { to: toDate });
      }
    }

    if (search) {
      const q = `%${search.toLowerCase()}%`;
      qb.andWhere(
        new Brackets((w) => {
          w.where('LOWER(e.endpoint) LIKE :q', { q })
            .orWhere('LOWER(e.message) LIKE :q', { q })
            .orWhere('LOWER(e.clientLabel) LIKE :q', { q })
            .orWhere('LOWER(e.tenantLabel) LIKE :q', { q });
        }),
      );
    }

    const [rows, total] = await qb.getManyAndCount();

    return {
      items: rows.map((row) => this.toListItem(row)),
      total,
      page,
      limit,
      totalPages: Math.max(1, Math.ceil(total / limit)),
    };
  }

  private toListItem(row: SystemErrorLog): SystemErrorLogListItem {
    return {
      id: row.id,
      source: row.source,
      endpoint: row.endpoint,
      httpMethod: row.httpMethod ?? null,
      statusCode: row.statusCode ?? null,
      message: row.message,
      clientId: row.clientId ?? null,
      clientLabel: row.clientLabel ?? null,
      tenantId: row.tenantId ?? null,
      tenantLabel: row.tenantLabel ?? null,
      userId: row.userId ?? null,
      metadata: (row.metadata as Record<string, unknown> | null) ?? null,
      createdAt: row.createdAt.toISOString(),
    };
  }

  private truncate(value: string, max: number): string {
    const trimmed = value.trim();
    if (trimmed.length <= max) return trimmed;
    return trimmed.slice(0, max - 1) + '…';
  }
}
