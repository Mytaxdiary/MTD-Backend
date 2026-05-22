import { Controller, Get, Post, Body, Param, UseGuards, Request } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import type { Request as ExpressRequest } from 'express';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { ClientsService } from './clients.service';
import { CreateClientDto } from './dto/create-client.dto';
import { ResendInvitationDto } from './dto/resend-invitation.dto';

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

  /** Create client + send HMRC invitation + send notification email */
  @Post()
  @ApiOperation({ summary: 'Add a client and send HMRC authorisation invitation' })
  async create(@Request() req: ExpressRequest, @Body() dto: CreateClientDto) {
    const { tenantId, email } = req.user as RequestUser;
    return this.clientsService.create(tenantId, email, dto);
  }

  /** List all clients for this firm */
  @Get()
  @ApiOperation({ summary: 'List all clients for this firm' })
  async findAll(@Request() req: ExpressRequest) {
    const { tenantId } = req.user as RequestUser;
    return this.clientsService.findAll(tenantId);
  }

  /** Pending HMRC invitations (sent, awaiting client accept) */
  @Get('outstanding-invitations')
  @ApiOperation({ summary: 'List clients with outstanding HMRC invitations' })
  async findOutstandingInvitations(@Request() req: ExpressRequest) {
    const { tenantId } = req.user as RequestUser;
    return this.clientsService.findOutstandingInvitations(tenantId);
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
    return this.clientsService.resendInvitation(tenantId, id, email, dto.personalMessage);
  }

  /** Refresh invitation status from HMRC */
  @Get(':id/invitation-status')
  @ApiOperation({ summary: 'Check and refresh invitation status from HMRC' })
  async checkInvitationStatus(@Request() req: ExpressRequest, @Param('id') id: string) {
    const { tenantId } = req.user as RequestUser;
    return this.clientsService.checkInvitationStatus(tenantId, id);
  }

  /** Sandbox only — simulate client accepting invitation (Postman step 9) */
  @Post(':id/accept-invitation-sandbox')
  @ApiOperation({ summary: 'Accept HMRC invitation in sandbox (test-support API)' })
  async acceptInvitationSandbox(@Request() req: ExpressRequest, @Param('id') id: string) {
    const { tenantId } = req.user as RequestUser;
    return this.clientsService.acceptInvitationSandbox(tenantId, id);
  }
}
