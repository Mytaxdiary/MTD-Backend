import {
  Controller,
  Get,
  Post,
  Patch,
  Delete,
  Body,
  Param,
  Query,
  UseGuards,
  Request,
  Res,
  UseInterceptors,
  UploadedFile,
  BadRequestException,
  HttpCode,
} from '@nestjs/common';
import type { Response as ExpressResponse } from 'express';
import * as fs from 'fs';
import { FileInterceptor } from '@nestjs/platform-express';
import { ApiBearerAuth, ApiConsumes, ApiOperation, ApiTags } from '@nestjs/swagger';
import type { Request as ExpressRequest } from 'express';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { ClientsService } from './clients.service';
import { CreateClientDto } from './dto/create-client.dto';
import { ResendInvitationDto } from './dto/resend-invitation.dto';
import { ListClientsQueryDto } from './dto/list-clients-query.dto';
import { SendPortalMessageDto } from '../client-portal/dto/send-portal-message.dto';
import { PortalService } from '../client-portal/portal.service';
import { GetItsaStatusQueryDto } from './dto/get-itsa-status-query.dto';
import { GetIncomeExpenditureObligationsQueryDto } from './dto/get-income-expenditure-obligations-query.dto';
import { GetCrystallisationObligationsQueryDto } from './dto/get-crystallisation-obligations-query.dto';
import { GetBalanceAndTransactionsQueryDto } from './dto/get-balance-and-transactions-query.dto';
import { GetPaymentsAndAllocationsQueryDto } from './dto/get-payments-and-allocations-query.dto';
import { GetIncomeSummaryQueryDto } from './dto/get-income-summary-query.dto';
import { buildHmrcFraudRequestContext } from '../hmrc/fraud-prevention.parser';

interface RequestUser {
  userId: string;
  email: string;
  tenantId: string;
  loginAt?: number;
  mfaAuthenticated?: boolean;
}

@ApiTags('Clients')
@ApiBearerAuth('access-token')
@UseGuards(JwtAuthGuard)
@Controller('clients')
export class ClientsController {
  constructor(
    private readonly clientsService: ClientsService,
    private readonly portalService: PortalService,
  ) {}

  private fraudContext(req: ExpressRequest) {
    const u = req.user as RequestUser;
    return buildHmrcFraudRequestContext(req, u.email, u.loginAt, u.mfaAuthenticated);
  }

  /** Create client + send HMRC invitation + send notification email */
  @Post()
  @ApiOperation({ summary: 'Add a client and send HMRC authorisation invitation' })
  async create(@Request() req: ExpressRequest, @Body() dto: CreateClientDto) {
    const { tenantId, email } = req.user as RequestUser;
    return this.clientsService.create(tenantId, email, dto, this.fraudContext(req));
  }

  /** List clients for this firm — paginated, server-side status filter */
  @Get()
  @ApiOperation({ summary: 'List clients (paginated, filtered)' })
  async findAll(@Request() req: ExpressRequest, @Query() query: ListClientsQueryDto) {
    const { tenantId } = req.user as RequestUser;
    return this.clientsService.findAll(tenantId, query, this.fraudContext(req));
  }

  /** Pending HMRC invitations (sent, awaiting client accept) */
  @Get('outstanding-invitations')
  @ApiOperation({ summary: 'List clients with outstanding HMRC invitations' })
  async findOutstandingInvitations(@Request() req: ExpressRequest) {
    const { tenantId } = req.user as RequestUser;
    return this.clientsService.findOutstandingInvitations(tenantId, this.fraudContext(req));
  }

  /** Get a single client */
  @Get(':id')
  @ApiOperation({ summary: 'Get client by ID' })
  async findOne(@Request() req: ExpressRequest, @Param('id') id: string) {
    const { tenantId } = req.user as RequestUser;
    return this.clientsService.findOne(tenantId, id);
  }

  /** Resend HMRC invitation for an existing client */
  @Post(':id/resend-invitation')
  @ApiOperation({ summary: 'Resend HMRC authorisation invitation for an existing client' })
  async resendInvitation(
    @Request() req: ExpressRequest,
    @Param('id') id: string,
    @Body() dto: ResendInvitationDto,
  ) {
    const { tenantId, email } = req.user as RequestUser;
    return this.clientsService.resendInvitation(
      tenantId,
      id,
      email,
      dto.personalMessage,
      this.fraudContext(req),
    );
  }

  /** Refresh invitation status from HMRC */
  @Get(':id/invitation-status')
  @ApiOperation({ summary: 'Check and refresh invitation status from HMRC' })
  async checkInvitationStatus(@Request() req: ExpressRequest, @Param('id') id: string) {
    const { tenantId } = req.user as RequestUser;
    return this.clientsService.checkInvitationStatus(tenantId, id, this.fraudContext(req));
  }

  /** Retrieve ITSA status from HMRC for an authorised client */
  @Get(':id/itsa-status')
  @ApiOperation({ summary: 'Retrieve HMRC ITSA status for a client (SA Individual Details v2.0)' })
  async getItsaStatus(
    @Request() req: ExpressRequest,
    @Param('id') id: string,
    @Query() query: GetItsaStatusQueryDto,
  ) {
    const { tenantId } = req.user as RequestUser;
    return this.clientsService.getItsaStatus(tenantId, id, query, this.fraudContext(req));
  }

  /** List all business income sources from HMRC (Business Details v2.0) */
  @Get(':id/businesses')
  @ApiOperation({ summary: 'List HMRC business income sources for a client' })
  async listBusinesses(@Request() req: ExpressRequest, @Param('id') id: string) {
    const { tenantId } = req.user as RequestUser;
    return this.clientsService.listBusinesses(tenantId, id, this.fraudContext(req));
  }

  /** Retrieve one business income source from HMRC (Business Details v2.0) */
  @Get(':id/businesses/:businessId')
  @ApiOperation({ summary: 'Retrieve HMRC business details for a client business' })
  async getBusinessDetails(
    @Request() req: ExpressRequest,
    @Param('id') id: string,
    @Param('businessId') businessId: string,
  ) {
    const { tenantId } = req.user as RequestUser;
    return this.clientsService.getBusinessDetails(
      tenantId,
      id,
      businessId,
      this.fraudContext(req),
    );
  }

  /** Income & expenditure obligations (Obligations MTD v3.0) */
  @Get(':id/obligations/income-and-expenditure')
  @ApiOperation({ summary: 'Retrieve HMRC quarterly obligations for a client business' })
  async getIncomeAndExpenditureObligations(
    @Request() req: ExpressRequest,
    @Param('id') id: string,
    @Query() query: GetIncomeExpenditureObligationsQueryDto,
  ) {
    const { tenantId } = req.user as RequestUser;
    return this.clientsService.getIncomeAndExpenditureObligations(
      tenantId,
      id,
      query,
      this.fraudContext(req),
    );
  }

  /** Final declaration obligations (Obligations MTD v3.0 crystallisation) */
  @Get(':id/obligations/crystallisation')
  @ApiOperation({ summary: 'Retrieve HMRC final declaration obligations for a client' })
  async getCrystallisationObligations(
    @Request() req: ExpressRequest,
    @Param('id') id: string,
    @Query() query: GetCrystallisationObligationsQueryDto,
  ) {
    const { tenantId } = req.user as RequestUser;
    return this.clientsService.getCrystallisationObligations(
      tenantId,
      id,
      query,
      this.fraudContext(req),
    );
  }

  /** SA Accounts balance and transactions (v4.0) */
  @Get(':id/liabilities/balance-and-transactions')
  @ApiOperation({ summary: 'Retrieve HMRC SA balance and transactions for a client' })
  async getBalanceAndTransactions(
    @Request() req: ExpressRequest,
    @Param('id') id: string,
    @Query() query: GetBalanceAndTransactionsQueryDto,
  ) {
    const { tenantId } = req.user as RequestUser;
    return this.clientsService.getBalanceAndTransactions(
      tenantId,
      id,
      query,
      this.fraudContext(req),
    );
  }

  /** SA Accounts payment history and allocations (v4.0) */
  @Get(':id/liabilities/payments-and-allocations')
  @ApiOperation({ summary: 'List HMRC SA payments and allocation details for a client' })
  async getPaymentsAndAllocations(
    @Request() req: ExpressRequest,
    @Param('id') id: string,
    @Query() query: GetPaymentsAndAllocationsQueryDto,
  ) {
    const { tenantId } = req.user as RequestUser;
    return this.clientsService.getPaymentsAndAllocations(
      tenantId,
      id,
      query,
      this.fraudContext(req),
    );
  }

  /**
   * Aggregate Business Income Source Summary (BISS v3.0) for all businesses.
   * Returns YTD totalIncome, totalExpenses, netProfit, netLoss.
   */
  @Get(':id/income-summary')
  @ApiOperation({ summary: 'Retrieve aggregated YTD income summary (BISS v3.0) for a client' })
  async getIncomeSummary(
    @Request() req: ExpressRequest,
    @Param('id') id: string,
    @Query() query: GetIncomeSummaryQueryDto,
  ) {
    const { tenantId } = req.user as RequestUser;
    return this.clientsService.getIncomeSummary(
      tenantId,
      id,
      query.taxYear,
      this.fraudContext(req),
    );
  }

  /** Verify agent–client relationship with HMRC (POST /agents/{arn}/relationships) */
  @Get(':id/relationship-status')
  @ApiOperation({ summary: 'Verify HMRC agent–client relationship is active' })
  async checkRelationshipStatus(@Request() req: ExpressRequest, @Param('id') id: string) {
    const { tenantId } = req.user as RequestUser;
    return this.clientsService.checkRelationshipStatus(tenantId, id, this.fraudContext(req));
  }

  /** Send a message to the client's portal */
  @Post(':id/portal-message')
  @ApiOperation({ summary: 'Send a message to the client portal' })
  async sendPortalMessage(
    @Request() req: ExpressRequest,
    @Param('id') id: string,
    @Body() dto: SendPortalMessageDto,
  ) {
    const { tenantId } = req.user as RequestUser;
    return this.portalService.sendMessage(tenantId, id, dto);
  }

  /** Resend portal setup invite email */
  @Post(':id/portal-invite')
  @ApiOperation({ summary: 'Resend client portal setup invite' })
  async resendPortalInvite(@Request() req: ExpressRequest, @Param('id') id: string) {
    const { tenantId } = req.user as RequestUser;
    const client = await this.clientsService.findOne(tenantId, id);
    await this.portalService.createAndInvite(tenantId, id, client.email, client.name);
    return { message: 'Portal invite resent' };
  }

  /** Generate a short-lived preview token for the agent to view the client portal */
  @Post(':id/portal-preview-token')
  @ApiOperation({ summary: 'Generate agent preview token for client portal' })
  async generatePortalPreviewToken(@Request() req: ExpressRequest, @Param('id') id: string) {
    const { tenantId } = req.user as RequestUser;
    const token = await this.portalService.generatePreviewToken(tenantId, id);
    return { previewToken: token };
  }

  /** Agent — list files uploaded by a client via the portal */
  @Get(':id/portal-files')
  @ApiOperation({ summary: 'List files the client uploaded to their portal' })
  async getPortalFiles(@Request() req: ExpressRequest, @Param('id') id: string) {
    const { tenantId } = req.user as RequestUser;
    return this.portalService.getFilesForAgent(tenantId, id);
  }

  /** Agent — download a file uploaded by a client */
  @Get(':id/portal-files/:fileId/download')
  @ApiOperation({ summary: 'Download a file the client uploaded to their portal' })
  async downloadPortalFile(
    @Request() req: ExpressRequest,
    @Param('id') id: string,
    @Param('fileId') fileId: string,
    @Res() res: ExpressResponse,
  ) {
    const { tenantId } = req.user as RequestUser;
    const record = await this.portalService.getFileRecordForAgent(tenantId, id, fileId);
    if (!fs.existsSync(record.storagePath)) {
      return res.status(404).json({ message: 'File not found on disk' });
    }
    res.download(record.storagePath, record.originalName);
  }

  // ── Client Notes ─────────────────────────────────────────────────────────────

  @Get(':id/notes')
  @ApiOperation({ summary: 'List notes for a client' })
  async getNotes(@Request() req: ExpressRequest, @Param('id') id: string) {
    const { tenantId } = req.user as RequestUser;
    return this.clientsService.getNotes(tenantId, id);
  }

  @Post(':id/notes')
  @ApiOperation({ summary: 'Create a note for a client' })
  async createNote(
    @Request() req: ExpressRequest,
    @Param('id') id: string,
    @Body() body: { text: string },
  ) {
    const { tenantId, email } = req.user as RequestUser;
    const authorName = (req.user as RequestUser & { name?: string }).name ?? email;
    return this.clientsService.createNote(tenantId, id, body.text, authorName);
  }

  @Patch(':id/notes/:noteId')
  @ApiOperation({ summary: 'Update a client note (text or isPinned)' })
  async updateNote(
    @Request() req: ExpressRequest,
    @Param('id') id: string,
    @Param('noteId') noteId: string,
    @Body() body: { text?: string; isPinned?: boolean },
  ) {
    const { tenantId } = req.user as RequestUser;
    return this.clientsService.updateNote(tenantId, id, noteId, body);
  }

  @Delete(':id/notes/:noteId')
  @HttpCode(204)
  @ApiOperation({ summary: 'Delete a client note' })
  async deleteNote(
    @Request() req: ExpressRequest,
    @Param('id') id: string,
    @Param('noteId') noteId: string,
  ) {
    const { tenantId } = req.user as RequestUser;
    await this.clientsService.deleteNote(tenantId, id, noteId);
  }

  /** Sandbox only — simulate client accepting invitation (Postman step 9) */
  @Post(':id/accept-invitation-sandbox')
  @ApiOperation({ summary: 'Accept HMRC invitation in sandbox (test-support API)' })
  async acceptInvitationSandbox(@Request() req: ExpressRequest, @Param('id') id: string) {
    const { tenantId } = req.user as RequestUser;
    return this.clientsService.acceptInvitationSandbox(tenantId, id, this.fraudContext(req));
  }

  /** Bulk CSV import — validates all rows first; creates clients + sends invitations only if clean */
  @Post('import')
  @ApiOperation({ summary: 'Bulk import clients from a CSV file' })
  @ApiConsumes('multipart/form-data')
  @UseInterceptors(
    FileInterceptor('file', {
      limits: { fileSize: 2 * 1024 * 1024 }, // 2 MB max
      fileFilter: (_req, file, cb) => {
        if (!file.originalname.match(/\.(csv|txt)$/i)) {
          return cb(new BadRequestException('Only .csv files are accepted'), false);
        }
        cb(null, true);
      },
    }),
  )
  async bulkImport(
    @Request() req: ExpressRequest,
    @UploadedFile() file: Express.Multer.File,
  ) {
    if (!file) throw new BadRequestException('No file uploaded. Please attach a CSV file.');
    const { tenantId, email } = req.user as RequestUser;
    return this.clientsService.bulkImport(
      tenantId,
      email,
      file.buffer,
      this.fraudContext(req),
    );
  }
}
