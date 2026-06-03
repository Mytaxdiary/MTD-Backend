import { Controller, Get, Post, Body, Param, Query, UseGuards, Request } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import type { Request as ExpressRequest } from 'express';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { ClientsService } from './clients.service';
import { CreateClientDto } from './dto/create-client.dto';
import { ResendInvitationDto } from './dto/resend-invitation.dto';
import { GetItsaStatusQueryDto } from './dto/get-itsa-status-query.dto';
import { buildHmrcFraudRequestContext } from '../hmrc/fraud-prevention.parser';

interface RequestUser {
  userId: string;
  email: string;
  tenantId: string;
}

@ApiTags('Clients')
@ApiBearerAuth('access-token')
@UseGuards(JwtAuthGuard)
@Controller('clients')
export class ClientsController {
  constructor(private readonly clientsService: ClientsService) {}

  private fraudContext(req: ExpressRequest) {
    const { email } = req.user as RequestUser;
    return buildHmrcFraudRequestContext(req, email);
  }

  /** Create client + send HMRC invitation + send notification email */
  @Post()
  @ApiOperation({ summary: 'Add a client and send HMRC authorisation invitation' })
  async create(@Request() req: ExpressRequest, @Body() dto: CreateClientDto) {
    const { tenantId, email } = req.user as RequestUser;
    return this.clientsService.create(tenantId, email, dto, this.fraudContext(req));
  }

  /** List all clients for this firm */
  @Get()
  @ApiOperation({ summary: 'List all clients for this firm' })
  async findAll(@Request() req: ExpressRequest) {
    const { tenantId } = req.user as RequestUser;
    return this.clientsService.findAll(tenantId, this.fraudContext(req));
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

  /** Verify agent–client relationship with HMRC (POST /agents/{arn}/relationships) */
  @Get(':id/relationship-status')
  @ApiOperation({ summary: 'Verify HMRC agent–client relationship is active' })
  async checkRelationshipStatus(@Request() req: ExpressRequest, @Param('id') id: string) {
    const { tenantId } = req.user as RequestUser;
    return this.clientsService.checkRelationshipStatus(tenantId, id, this.fraudContext(req));
  }

  /** Sandbox only — simulate client accepting invitation (Postman step 9) */
  @Post(':id/accept-invitation-sandbox')
  @ApiOperation({ summary: 'Accept HMRC invitation in sandbox (test-support API)' })
  async acceptInvitationSandbox(@Request() req: ExpressRequest, @Param('id') id: string) {
    const { tenantId } = req.user as RequestUser;
    return this.clientsService.acceptInvitationSandbox(tenantId, id, this.fraudContext(req));
  }
}
