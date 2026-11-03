import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  ParseUUIDPipe,
  Patch,
  Post,
  Query,
  UseGuards,
} from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { AuthAudience } from '../../common/decorators/auth-audience.decorator';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { OutreachService } from './outreach.service';
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

/**
 * Prospect outreach CRM APIs.
 * Reuses platform admin auth (no separate outreach login).
 */
@ApiTags('Outreach')
@Controller('outreach')
@UseGuards(JwtAuthGuard)
@AuthAudience('admin')
@ApiBearerAuth('access-token')
export class OutreachController {
  constructor(private readonly outreach: OutreachService) {}

  // Firms
  @Get('firms')
  @ApiOperation({ summary: 'List outreach prospect firms' })
  listFirms(@Query() q: PaginationQueryDto) {
    return this.outreach.listFirms(q);
  }

  @Get('firms/:id')
  getFirm(@Param('id', ParseUUIDPipe) id: string) {
    return this.outreach.getFirm(id);
  }

  @Post('firms')
  @HttpCode(HttpStatus.CREATED)
  createFirm(@Body() dto: CreateFirmDto) {
    return this.outreach.createFirm(dto);
  }

  @Patch('firms/:id')
  updateFirm(@Param('id', ParseUUIDPipe) id: string, @Body() dto: UpdateFirmDto) {
    return this.outreach.updateFirm(id, dto);
  }

  // Contacts / prospects
  @Get('contacts')
  listContacts(@Query() q: ContactsQueryDto) {
    return this.outreach.listContacts(q);
  }

  @Get('contacts/:id')
  getContact(@Param('id', ParseUUIDPipe) id: string) {
    return this.outreach.getContact(id);
  }

  @Post('contacts')
  @HttpCode(HttpStatus.CREATED)
  createContact(@Body() dto: CreateContactDto) {
    return this.outreach.createContact(dto);
  }

  @Patch('contacts/:id')
  updateContact(@Param('id', ParseUUIDPipe) id: string, @Body() dto: UpdateContactDto) {
    return this.outreach.updateContact(id, dto);
  }

  @Post('contacts/:id/assign-sequence')
  assignSequence(@Param('id', ParseUUIDPipe) id: string, @Body() dto: AssignSequenceDto) {
    return this.outreach.assignSequence(id, dto);
  }

  @Post('contacts/:id/advance-step')
  advanceStep(@Param('id', ParseUUIDPipe) id: string) {
    return this.outreach.advanceStep(id);
  }

  @Post('contacts/:id/stop-sequence')
  stopSequence(@Param('id', ParseUUIDPipe) id: string, @Body() body: { reason?: string }) {
    return this.outreach.stopSequence(id, body?.reason);
  }

  @Post('contacts/:id/release')
  @ApiOperation({ summary: 'Human release — clear send_held so cold sends may go' })
  releaseContact(@Param('id', ParseUUIDPipe) id: string) {
    return this.outreach.releaseContact(id);
  }

  // Touchpoints
  @Post('touchpoints')
  @HttpCode(HttpStatus.CREATED)
  createTouchpoint(@Body() dto: CreateTouchpointDto) {
    return this.outreach.createTouchpoint(dto);
  }

  // Templates
  @Get('templates')
  listTemplates(@Query() q: PaginationQueryDto) {
    return this.outreach.listTemplates(q);
  }

  @Get('templates/:id')
  getTemplate(@Param('id', ParseUUIDPipe) id: string) {
    return this.outreach.getTemplate(id);
  }

  @Post('templates')
  @HttpCode(HttpStatus.CREATED)
  createTemplate(@Body() dto: CreateTemplateDto) {
    return this.outreach.createTemplate(dto);
  }

  @Patch('templates/:id')
  updateTemplate(@Param('id', ParseUUIDPipe) id: string, @Body() dto: UpdateTemplateDto) {
    return this.outreach.updateTemplate(id, dto);
  }

  // Sequences
  @Get('sequences')
  listSequences() {
    return this.outreach.listSequences();
  }

  @Get('sequences/:id')
  getSequence(@Param('id', ParseUUIDPipe) id: string) {
    return this.outreach.getSequence(id);
  }

  @Post('sequences')
  @HttpCode(HttpStatus.CREATED)
  createSequence(@Body() dto: CreateSequenceDto) {
    return this.outreach.createSequence(dto);
  }

  @Patch('sequences/:id')
  updateSequence(@Param('id', ParseUUIDPipe) id: string, @Body() dto: UpdateSequenceDto) {
    return this.outreach.updateSequence(id, dto);
  }

  @Post('sequences/:id/steps')
  @HttpCode(HttpStatus.CREATED)
  addStep(@Param('id', ParseUUIDPipe) id: string, @Body() dto: CreateSequenceStepDto) {
    return this.outreach.addSequenceStep(id, dto);
  }

  // Today queue
  @Get('tasks/today')
  todayQueue() {
    return this.outreach.todayQueue();
  }

  @Patch('tasks/:id')
  updateTask(@Param('id', ParseUUIDPipe) id: string, @Body() dto: UpdateTaskDto) {
    return this.outreach.updateTask(id, dto);
  }

  // Suppressions
  @Get('suppressions')
  listSuppressions(@Query() q: SuppressionsQueryDto) {
    return this.outreach.listSuppressions(q);
  }

  @Post('suppressions')
  @HttpCode(HttpStatus.CREATED)
  createSuppression(@Body() dto: CreateSuppressionDto) {
    return this.outreach.createSuppression(dto);
  }

  @Delete('suppressions/:id')
  deleteSuppression(@Param('id', ParseUUIDPipe) id: string) {
    return this.outreach.deleteSuppression(id);
  }

  // Campaigns
  @Get('campaigns')
  listCampaigns() {
    return this.outreach.listCampaigns();
  }

  @Get('campaigns/:id/stats')
  campaignStats(@Param('id', ParseUUIDPipe) id: string) {
    return this.outreach.getCampaignStats(id);
  }

  @Post('campaigns')
  @HttpCode(HttpStatus.CREATED)
  createCampaign(@Body() dto: CreateCampaignDto) {
    return this.outreach.createCampaign(dto);
  }

  @Post('campaigns/:id/release')
  releaseCampaign(@Param('id', ParseUUIDPipe) id: string) {
    return this.outreach.releaseCampaign(id);
  }
}
