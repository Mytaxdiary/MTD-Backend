import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { FindOptionsWhere, LessThanOrEqual, Like, Repository } from 'typeorm';
import { randomUUID } from 'crypto';
import {
  BlockReason,
  ProspectStatus,
  SuppressionValueType,
  TaskStatus,
  TouchChannel,
  TouchDirection,
  TouchEventType,
} from './outreach.enums';
import { Campaign } from './entities/campaign.entity';
import { Contact } from './entities/contact.entity';
import { Firm } from './entities/firm.entity';
import { Sequence } from './entities/sequence.entity';
import { SequenceStep } from './entities/sequence-step.entity';
import { Suppression } from './entities/suppression.entity';
import { Task } from './entities/task.entity';
import { Template } from './entities/template.entity';
import { Touchpoint } from './entities/touchpoint.entity';
import {
  AssignSequenceDto,
  ContactsQueryDto,
  CreateCampaignDto,
  CreateContactDto,
  CreateFirmDto,
  CreateSequenceDto,
  CreateSequenceStepDto,
  CreateSuppressionDto,
  CreateTemplateDto,
  CreateTouchpointDto,
  PaginationQueryDto,
  SuppressionsQueryDto,
  UpdateContactDto,
  UpdateFirmDto,
  UpdateSequenceDto,
  UpdateTaskDto,
  UpdateTemplateDto,
} from './dto/outreach.dto';

function pageMeta(total: number, page: number, limit: number) {
  return {
    page,
    limit,
    total,
    totalPages: Math.max(1, Math.ceil(total / limit)),
  };
}

@Injectable()
export class OutreachService {
  constructor(
    @InjectRepository(Firm) private readonly firms: Repository<Firm>,
    @InjectRepository(Contact) private readonly contacts: Repository<Contact>,
    @InjectRepository(Touchpoint)
    private readonly touchpoints: Repository<Touchpoint>,
    @InjectRepository(Template)
    private readonly templates: Repository<Template>,
    @InjectRepository(Sequence)
    private readonly sequences: Repository<Sequence>,
    @InjectRepository(SequenceStep)
    private readonly steps: Repository<SequenceStep>,
    @InjectRepository(Task) private readonly tasks: Repository<Task>,
    @InjectRepository(Suppression)
    private readonly suppressions: Repository<Suppression>,
    @InjectRepository(Campaign)
    private readonly campaigns: Repository<Campaign>,
  ) {}

  // ---- Firms ----
  async listFirms(q: PaginationQueryDto) {
    const page = q.page ?? 1;
    const limit = q.limit ?? 20;
    const where: FindOptionsWhere<Firm>[] | FindOptionsWhere<Firm> = q.search
      ? [{ name: Like(`%${q.search}%`) }, { domain: Like(`%${q.search}%`) }]
      : {};
    const [items, total] = await this.firms.findAndCount({
      where,
      order: { updatedAt: 'DESC' },
      skip: (page - 1) * limit,
      take: limit,
    });
    return { items, ...pageMeta(total, page, limit) };
  }

  async findFirmOrFail(id: string) {
    const firm = await this.firms.findOne({ where: { id } });
    if (!firm) throw new NotFoundException('Firm not found');
    return firm;
  }

  async getFirm(id: string) {
    const firm = await this.findFirmOrFail(id);
    const contacts = await this.contacts.find({
      where: { firmId: id },
      order: { updatedAt: 'DESC' },
      take: 50,
    });
    return { ...firm, contacts };
  }

  createFirm(dto: CreateFirmDto) {
    const firm = this.firms.create({
      name: dto.name,
      domain: dto.domain,
      website: dto.website,
      notes: dto.notes,
    });
    return this.firms.save(firm);
  }

  async updateFirm(id: string, dto: UpdateFirmDto) {
    const firm = await this.findFirmOrFail(id);
    Object.assign(firm, dto);
    return this.firms.save(firm);
  }

  // ---- Contacts ----
  async listContacts(q: ContactsQueryDto) {
    const page = q.page ?? 1;
    const limit = q.limit ?? 20;
    const qb = this.contacts
      .createQueryBuilder('c')
      .leftJoinAndSelect('c.firm', 'firm')
      .orderBy('c.updatedAt', 'DESC')
      .skip((page - 1) * limit)
      .take(limit);
    if (q.firmId) qb.andWhere('c.firm_id = :firmId', { firmId: q.firmId });
    if (q.status) qb.andWhere('c.status = :status', { status: q.status });
    if (q.search) {
      qb.andWhere(
        '(c.email LIKE :s OR c.first_name LIKE :s OR c.last_name LIKE :s OR c.recipient_id LIKE :s)',
        { s: `%${q.search}%` },
      );
    }
    const [items, total] = await qb.getManyAndCount();
    return { items, ...pageMeta(total, page, limit) };
  }

  async getContact(id: string) {
    const contact = await this.contacts.findOne({
      where: { id },
      relations: ['firm', 'currentSequence'],
    });
    if (!contact) throw new NotFoundException('Contact not found');
    const touchpoints = await this.touchpoints.find({
      where: { contactId: id },
      order: { occurredAt: 'DESC' },
      take: 100,
    });
    const openTasks = await this.tasks.find({
      where: { contactId: id, status: TaskStatus.OPEN },
      order: { dueAt: 'ASC' },
    });
    return { ...contact, touchpoints, openTasks };
  }

  async createContact(dto: CreateContactDto) {
    const firm = await this.firms.findOne({ where: { id: dto.firmId } });
    if (!firm) throw new NotFoundException('Firm not found');
    const recipientId = dto.recipientId?.trim() || randomUUID();
    const existingEmail = await this.contacts.findOne({
      where: { email: dto.email.toLowerCase() },
    });
    if (existingEmail) {
      throw new BadRequestException('Email already exists on another contact');
    }
    const contact = this.contacts.create({
      firmId: dto.firmId,
      email: dto.email.toLowerCase(),
      recipientId,
      firstName: dto.firstName,
      lastName: dto.lastName,
      salutation: dto.salutation || (dto.firstName ? `Hi ${dto.firstName},` : 'Hello,'),
      currentSequenceId: dto.currentSequenceId,
      status: ProspectStatus.NEW,
      sendHeld: true,
    });
    return this.contacts.save(contact);
  }

  async updateContact(id: string, dto: UpdateContactDto) {
    const contact = await this.contacts.findOne({ where: { id } });
    if (!contact) throw new NotFoundException('Contact not found');
    Object.assign(contact, dto);
    return this.contacts.save(contact);
  }

  // ---- Touchpoints ----
  async createTouchpoint(dto: CreateTouchpointDto) {
    if (!dto.contactId && !dto.firmId) {
      throw new BadRequestException('contactId or firmId is required');
    }
    if (dto.contactId) {
      const c = await this.contacts.findOne({ where: { id: dto.contactId } });
      if (!c) throw new NotFoundException('Contact not found');
    }
    const now = new Date();
    const touch = this.touchpoints.create({
      contactId: dto.contactId,
      firmId: dto.firmId,
      occurredAt: now,
      channel: dto.channel,
      direction: dto.direction,
      eventType: dto.eventType,
      summary: dto.summary,
      responseCategory: dto.responseCategory,
      templateId: dto.templateId,
      sequenceId: dto.sequenceId,
      stepNumber: dto.stepNumber,
      campaignId: dto.campaignId,
      loggedAt: now,
    });
    return this.touchpoints.save(touch);
  }

  // ---- Templates ----
  async listTemplates(q: PaginationQueryDto) {
    const page = q.page ?? 1;
    const limit = q.limit ?? 50;
    const where = q.search
      ? [{ handbookCode: Like(`%${q.search}%`) }, { name: Like(`%${q.search}%`) }]
      : {};
    const [items, total] = await this.templates.findAndCount({
      where,
      order: { handbookCode: 'ASC', version: 'DESC' },
      skip: (page - 1) * limit,
      take: limit,
    });
    return { items, ...pageMeta(total, page, limit) };
  }

  async getTemplate(id: string) {
    const row = await this.templates.findOne({ where: { id } });
    if (!row) throw new NotFoundException('Template not found');
    return row;
  }

  createTemplate(dto: CreateTemplateDto) {
    const row = this.templates.create({
      handbookCode: dto.handbookCode,
      version: dto.version || '1.0',
      name: dto.name,
      channel: dto.channel,
      subject: dto.subject,
      body: dto.body,
      linkAsset: dto.linkAsset,
    });
    return this.templates.save(row);
  }

  async updateTemplate(id: string, dto: UpdateTemplateDto) {
    const row = await this.getTemplate(id);
    Object.assign(row, dto);
    return this.templates.save(row);
  }

  // ---- Sequences ----
  async listSequences() {
    return this.sequences.find({
      relations: ['steps'],
      order: { code: 'ASC' },
    });
  }

  async getSequence(id: string) {
    const seq = await this.sequences.findOne({
      where: { id },
      relations: ['steps', 'steps.template'],
    });
    if (!seq) throw new NotFoundException('Sequence not found');
    seq.steps = (seq.steps || []).sort((a, b) => a.stepNumber - b.stepNumber);
    return seq;
  }

  createSequence(dto: CreateSequenceDto) {
    const seq = this.sequences.create({ ...dto });
    return this.sequences.save(seq);
  }

  async updateSequence(id: string, dto: UpdateSequenceDto) {
    const seq = await this.sequences.findOne({ where: { id } });
    if (!seq) throw new NotFoundException('Sequence not found');
    Object.assign(seq, dto);
    return this.sequences.save(seq);
  }

  async addSequenceStep(sequenceId: string, dto: CreateSequenceStepDto) {
    await this.getSequence(sequenceId);
    const tpl = await this.templates.findOne({ where: { id: dto.templateId } });
    if (!tpl) throw new NotFoundException('Template not found');
    const step = this.steps.create({ sequenceId, ...dto });
    return this.steps.save(step);
  }

  async assignSequence(contactId: string, dto: AssignSequenceDto) {
    const contact = await this.contacts.findOne({ where: { id: contactId } });
    if (!contact) throw new NotFoundException('Contact not found');
    const seq = await this.getSequence(dto.sequenceId);
    const first = (seq.steps || []).sort((a, b) => a.stepNumber - b.stepNumber)[0];
    contact.currentSequenceId = seq.id;
    contact.currentStep = first?.stepNumber ?? 1;
    contact.status = ProspectStatus.READY;
    contact.sendHeld = true;
    return this.contacts.save(contact);
  }

  /**
   * Basic advance: if held or suppressed, log send_blocked and refuse.
   * Otherwise move to next step (or unresponsive at end).
   */
  async advanceStep(contactId: string) {
    const contact = await this.contacts.findOne({ where: { id: contactId } });
    if (!contact) throw new NotFoundException('Contact not found');
    if (!contact.currentSequenceId) {
      throw new BadRequestException('Contact is not on a sequence');
    }

    const blocked = await this.checkSendBlocked(contact);
    if (blocked) {
      await this.createTouchpoint({
        contactId: contact.id,
        firmId: contact.firmId,
        channel: TouchChannel.SYSTEM,
        direction: TouchDirection.SYSTEM,
        eventType: TouchEventType.SEND_BLOCKED,
        summary: `Send blocked: ${blocked}`,
        sequenceId: contact.currentSequenceId,
        stepNumber: contact.currentStep ?? undefined,
      });
      // persist block reason on last touch — summary is enough for MVP
      return { ok: false, blocked, contact };
    }

    const seq = await this.getSequence(contact.currentSequenceId);
    const ordered = (seq.steps || []).sort((a, b) => a.stepNumber - b.stepNumber);
    const current = contact.currentStep ?? ordered[0]?.stepNumber ?? 1;
    const idx = ordered.findIndex((s) => s.stepNumber === current);
    const step = idx >= 0 ? ordered[idx] : ordered[0];
    if (!step) throw new BadRequestException('Sequence has no steps');

    await this.createTouchpoint({
      contactId: contact.id,
      firmId: contact.firmId,
      channel: TouchChannel.EMAIL_COLD,
      direction: TouchDirection.OUTBOUND,
      eventType: TouchEventType.SENT,
      summary: `Advanced/sent step ${step.stepNumber} (${step.template?.handbookCode || step.templateId})`,
      sequenceId: seq.id,
      stepNumber: step.stepNumber,
      templateId: step.templateId,
    });

    contact.status = ProspectStatus.IN_SEQUENCE;
    const next = ordered[idx + 1];
    if (next) {
      contact.currentStep = next.stepNumber;
      await this.contacts.save(contact);
      return { ok: true, completed: false, contact, nextStep: next.stepNumber };
    }

    contact.currentStep = undefined;
    contact.currentSequenceId = undefined;
    contact.status = ProspectStatus.UNRESPONSIVE;
    await this.contacts.save(contact);
    return { ok: true, completed: true, contact };
  }

  async stopSequence(contactId: string, reason?: string) {
    const contact = await this.contacts.findOne({ where: { id: contactId } });
    if (!contact) throw new NotFoundException('Contact not found');
    const seqId = contact.currentSequenceId;
    contact.currentSequenceId = undefined;
    contact.currentStep = undefined;
    contact.status = ProspectStatus.PARKED;
    await this.contacts.save(contact);
    await this.createTouchpoint({
      contactId: contact.id,
      firmId: contact.firmId,
      channel: TouchChannel.SYSTEM,
      direction: TouchDirection.SYSTEM,
      eventType: TouchEventType.NOTE,
      summary: reason || 'Sequence stopped',
      sequenceId: seqId || undefined,
    });
    return contact;
  }

  async releaseContact(contactId: string) {
    const contact = await this.contacts.findOne({ where: { id: contactId } });
    if (!contact) throw new NotFoundException('Contact not found');
    const blocked = await this.checkSendBlocked(contact, { ignoreHold: true });
    if (blocked && blocked !== BlockReason.OTHER) {
      // still allow release flag clear only if not suppressed/dnc
      if (blocked === BlockReason.SUPPRESSED || blocked === BlockReason.DO_NOT_CONTACT) {
        throw new BadRequestException(`Cannot release: ${blocked}`);
      }
    }
    contact.sendHeld = false;
    if (contact.status === ProspectStatus.NEW) {
      contact.status = ProspectStatus.READY;
    }
    return this.contacts.save(contact);
  }

  private async checkSendBlocked(
    contact: Contact,
    opts?: { ignoreHold?: boolean },
  ): Promise<BlockReason | null> {
    if (contact.doNotContact) return BlockReason.DO_NOT_CONTACT;
    if (!opts?.ignoreHold && contact.sendHeld) return BlockReason.OTHER; // held
    const email = contact.email.toLowerCase();
    const domain = email.includes('@') ? email.split('@')[1] : '';
    const where: FindOptionsWhere<Suppression>[] = [
      { value: email, valueType: SuppressionValueType.EMAIL },
    ];
    if (domain) {
      where.push({ value: domain, valueType: SuppressionValueType.DOMAIN });
    }
    const hit = await this.suppressions.findOne({ where });
    if (hit) return BlockReason.SUPPRESSED;
    return null;
  }

  // ---- Tasks / today queue ----
  async todayQueue() {
    const end = new Date();
    end.setHours(23, 59, 59, 999);
    const items = await this.tasks.find({
      where: {
        status: TaskStatus.OPEN,
        dueAt: LessThanOrEqual(end),
      },
      relations: ['contact', 'contact.firm', 'suggestedTemplate'],
      order: { priority: 'ASC', dueAt: 'ASC' },
      take: 200,
    });
    return { items, asOf: new Date().toISOString() };
  }

  async updateTask(id: string, dto: UpdateTaskDto) {
    const task = await this.tasks.findOne({ where: { id } });
    if (!task) throw new NotFoundException('Task not found');
    Object.assign(task, dto);
    return this.tasks.save(task);
  }

  async createFollowUpTask(contactId: string, dueAt: Date, type = TaskStatus.OPEN) {
    void type;
    const contact = await this.contacts.findOne({ where: { id: contactId } });
    if (!contact) throw new NotFoundException('Contact not found');
    const task = this.tasks.create({
      contactId,
      type: 'follow_up' as never,
      dueAt,
      priority: 3,
      status: TaskStatus.OPEN,
    });
    return this.tasks.save(task);
  }

  // ---- Suppressions ----
  async listSuppressions(q: SuppressionsQueryDto) {
    const page = q.page ?? 1;
    const limit = q.limit ?? 50;
    const qb = this.suppressions
      .createQueryBuilder('s')
      .orderBy('s.added_at', 'DESC')
      .skip((page - 1) * limit)
      .take(limit);
    if (q.valueType) qb.andWhere('s.value_type = :vt', { vt: q.valueType });
    if (q.search) qb.andWhere('s.value LIKE :s', { s: `%${q.search}%` });
    const [items, total] = await qb.getManyAndCount();
    return { items, ...pageMeta(total, page, limit) };
  }

  async createSuppression(dto: CreateSuppressionDto) {
    const value = dto.value.trim().toLowerCase();
    const existing = await this.suppressions.findOne({
      where: { value, valueType: dto.valueType },
    });
    if (existing) return existing;
    const row = this.suppressions.create({
      value,
      valueType: dto.valueType,
      reason: dto.reason,
      scope: dto.scope,
      notes: dto.notes,
      addedAt: new Date(),
    });
    return this.suppressions.save(row);
  }

  async deleteSuppression(id: string) {
    const row = await this.suppressions.findOne({ where: { id } });
    if (!row) throw new NotFoundException('Suppression not found');
    await this.suppressions.softRemove(row);
    return { ok: true };
  }

  // ---- Campaigns ----
  async listCampaigns() {
    const items = await this.campaigns.find({
      relations: ['sequence'],
      order: { updatedAt: 'DESC' },
    });
    return { items };
  }

  async getCampaignStats(id: string) {
    const campaign = await this.campaigns.findOne({
      where: { id },
      relations: ['sequence'],
    });
    if (!campaign) throw new NotFoundException('Campaign not found');
    const rows = await this.touchpoints
      .createQueryBuilder('t')
      .select('t.event_type', 'eventType')
      .addSelect('COUNT(*)', 'count')
      .where('t.campaign_id = :id', { id })
      .groupBy('t.event_type')
      .getRawMany<{ eventType: string; count: string }>();
    const counts: Record<string, number> = {};
    for (const r of rows) counts[r.eventType] = Number(r.count);
    return {
      campaign,
      stats: {
        sent: counts[TouchEventType.SENT] || 0,
        delivered: counts[TouchEventType.DELIVERED] || 0,
        bounced:
          (counts[TouchEventType.BOUNCED_HARD] || 0) + (counts[TouchEventType.BOUNCED_SOFT] || 0),
        clicked: counts[TouchEventType.CLICKED] || 0,
        replied: counts[TouchEventType.REPLIED] || 0,
        blocked: counts[TouchEventType.SEND_BLOCKED] || 0,
      },
    };
  }

  createCampaign(dto: CreateCampaignDto) {
    const row = this.campaigns.create({
      name: dto.name,
      sequenceId: dto.sequenceId,
      waveNumber: dto.waveNumber ?? 1,
      utmCampaign: dto.utmCampaign,
      releaseHeld: true,
    });
    return this.campaigns.save(row);
  }

  async releaseCampaign(id: string) {
    const campaign = await this.campaigns.findOne({ where: { id } });
    if (!campaign) throw new NotFoundException('Campaign not found');
    campaign.releaseHeld = false;
    return this.campaigns.save(campaign);
  }
}
