import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { IsNull, Repository } from 'typeorm';
import { ChaseTemplate } from './entities/chase-template.entity';
import { CreateChaseTemplateDto } from './dto/create-chase-template.dto';
import { UpdateChaseTemplateDto } from './dto/update-chase-template.dto';

/** Default templates seeded for every new tenant on first request. */
const DEFAULT_TEMPLATES: Omit<CreateChaseTemplateDto, never>[] = [
  {
    type: 'bookkeeping',
    name: 'Bookkeeping reminder',
    subject: 'Quarterly bookkeeping needed — {business}',
    body: "Hi {name},\n\nJust a reminder that your {quarter} quarterly records are due by {deadline}. Please complete your bookkeeping in your accounting software and let us know when it's ready for us to review.\n\nIf you need any help, just reply to this email.\n\nBest regards,\n{agent_name}",
  },
  {
    type: 'bookkeeping',
    name: 'Bookkeeping overdue',
    subject: 'Action required: overdue bookkeeping — {business}',
    body: 'Hi {name},\n\nThe deadline for your {quarter} quarterly update has passed. Please complete your bookkeeping as soon as possible so we can review and ensure your records are up to date with HMRC.\n\nBest regards,\n{agent_name}',
  },
  {
    type: 'data-request',
    name: 'Data request — gentle',
    subject: 'Quarterly records needed — {business}',
    body: 'Hi {name},\n\nWe need your income and expense records for {quarter} (due {deadline}). Please send us your bank statements, invoices, and receipts for the period.\n\nYou can reply to this email with attachments, or upload files directly in your portal.\n\nBest regards,\n{agent_name}',
  },
  {
    type: 'data-request',
    name: 'Data request — urgent',
    subject: 'Urgent: records overdue — {business}',
    body: 'Hi {name},\n\nYour {quarter} records are now overdue. We need your bank statements and receipts urgently to submit your quarterly update to HMRC.\n\nPlease send everything you have as soon as possible.\n\nBest regards,\n{agent_name}',
  },
  {
    type: 'general',
    name: 'Welcome / onboarding',
    subject: 'Welcome to {firm_name} — getting started',
    body: "Hi {name},\n\nWelcome! We're looking forward to helping you with your Making Tax Digital obligations.\n\nYou'll receive a separate email from HMRC asking you to authorise us as your agent. Please accept this — it allows us to manage your quarterly updates.\n\nBest regards,\n{agent_name}",
  },
];

@Injectable()
export class ChaseTemplatesService {
  constructor(
    @InjectRepository(ChaseTemplate)
    private readonly repo: Repository<ChaseTemplate>,
  ) {}

  /** Returns all templates for the tenant. Seeds defaults on first call. */
  async list(tenantId: string): Promise<ChaseTemplate[]> {
    const existing = await this.repo.find({
      where: { tenantId, deletedAt: IsNull() },
      order: { createdAt: 'ASC' },
    });

    if (existing.length === 0) {
      await this.seedDefaults(tenantId);
      return this.repo.find({
        where: { tenantId, deletedAt: IsNull() },
        order: { createdAt: 'ASC' },
      });
    }

    return existing;
  }

  async create(tenantId: string, dto: CreateChaseTemplateDto): Promise<ChaseTemplate> {
    const template = this.repo.create({ ...dto, tenantId, isDefault: false });
    return this.repo.save(template);
  }

  async update(
    tenantId: string,
    id: string,
    dto: UpdateChaseTemplateDto,
  ): Promise<ChaseTemplate> {
    const template = await this.repo.findOne({
      where: { id, tenantId, deletedAt: IsNull() },
    });
    if (!template) throw new NotFoundException('Chase template not found');
    Object.assign(template, dto);
    return this.repo.save(template);
  }

  async delete(tenantId: string, id: string): Promise<void> {
    const template = await this.repo.findOne({
      where: { id, tenantId, deletedAt: IsNull() },
    });
    if (!template) throw new NotFoundException('Chase template not found');
    await this.repo.softDelete(id);
  }

  private async seedDefaults(tenantId: string): Promise<void> {
    const entities = DEFAULT_TEMPLATES.map((t) =>
      this.repo.create({ ...t, tenantId, isDefault: true }),
    );
    await this.repo.save(entities);
  }
}
