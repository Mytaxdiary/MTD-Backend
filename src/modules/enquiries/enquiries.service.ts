import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { MailService } from '../mail/mail.service';
import { CreateEnquiryDto } from './dto/create-enquiry.dto';
import { Enquiry } from './entities/enquiry.entity';

@Injectable()
export class EnquiriesService {
  private readonly logger = new Logger(EnquiriesService.name);

  constructor(
    @InjectRepository(Enquiry)
    private readonly enquiriesRepo: Repository<Enquiry>,
    private readonly mailService: MailService,
    private readonly configService: ConfigService,
  ) {}

  async create(dto: CreateEnquiryDto): Promise<{ received: true }> {
    // Honeypot: pretend success so bots do not learn which field blocked them.
    if (dto.website?.trim()) {
      this.logger.warn(`Enquiry honeypot triggered for ${dto.email}`);
      return { received: true };
    }

    const enquiry = this.enquiriesRepo.create({
      name: dto.name.trim(),
      firm: dto.firm.trim(),
      email: dto.email.trim().toLowerCase(),
      phone: dto.phone?.trim() || null,
      message: dto.message.trim(),
      sourcePage: dto.sourcePage?.trim() || null,
      planInterest: dto.planInterest?.trim() || null,
      status: 'new',
    });

    const saved = await this.enquiriesRepo.save(enquiry);

    const notifyTo =
      this.configService.get<string>('mail.enquiryNotifyEmail') || 'info@mytaxdiary.co.uk';

    try {
      await this.mailService.sendEnquiryAlertEmail(notifyTo, {
        name: saved.name,
        firm: saved.firm,
        email: saved.email,
        phone: saved.phone,
        message: saved.message,
        sourcePage: saved.sourcePage,
        planInterest: saved.planInterest,
        enquiryId: saved.id,
      });
    } catch (error) {
      // Enquiry is already stored; do not fail the public form if SMTP is down.
      this.logger.error(`Enquiry ${saved.id} saved but alert email failed`, error);
    }

    return { received: true };
  }
}
