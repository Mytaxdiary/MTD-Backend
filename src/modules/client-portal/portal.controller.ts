import {
  BadRequestException,
  Controller,
  Get,
  Param,
  Patch,
  Post,
  Request,
  Res,
  UploadedFile,
  UseGuards,
  UseInterceptors,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { memoryStorage } from 'multer';
import { ApiBearerAuth, ApiConsumes, ApiOperation, ApiTags } from '@nestjs/swagger';
import type { Request as ExpressRequest, Response } from 'express';
import * as fs from 'fs';
import * as path from 'path';
import { PortalJwtGuard } from './guards/portal-jwt.guard';
import { PortalService } from './portal.service';
import type { PortalRequestUser } from './strategies/portal-jwt.strategy';

@ApiTags('Client Portal')
@ApiBearerAuth('access-token')
@UseGuards(PortalJwtGuard)
@Controller('portal')
export class PortalController {
  constructor(private readonly portalService: PortalService) {}

  private user(req: ExpressRequest): PortalRequestUser {
    return req.user as PortalRequestUser;
  }

  @Get('me')
  @ApiOperation({ summary: 'Client profile + firm details' })
  async getMe(@Request() req: ExpressRequest) {
    const { clientId, tenantId, isPreview } = this.user(req);
    const data = await this.portalService.getMe(clientId, tenantId);
    return { ...data, isPreview: isPreview ?? false };
  }

  @Get('obligations')
  @ApiOperation({ summary: 'HMRC quarterly obligations for this client' })
  getObligations(@Request() req: ExpressRequest) {
    const { clientId, tenantId } = this.user(req);
    return this.portalService.getObligations(clientId, tenantId);
  }

  @Get('liabilities')
  @ApiOperation({ summary: 'HMRC SA balance and transactions for this client' })
  getLiabilities(@Request() req: ExpressRequest) {
    const { clientId, tenantId } = this.user(req);
    return this.portalService.getLiabilities(clientId, tenantId);
  }

  @Get('messages')
  @ApiOperation({ summary: 'Messages from accountant' })
  getMessages(@Request() req: ExpressRequest) {
    const { clientId } = this.user(req);
    return this.portalService.getMessages(clientId);
  }

  @Get('messages/unread-count')
  @ApiOperation({ summary: 'Number of unread messages' })
  async getUnreadCount(@Request() req: ExpressRequest) {
    const { clientId } = this.user(req);
    const count = await this.portalService.getUnreadCount(clientId);
    return { count };
  }

  @Patch('messages/:id/read')
  @ApiOperation({ summary: 'Mark a message as read' })
  markRead(@Request() req: ExpressRequest, @Param('id') id: string) {
    const { clientId } = this.user(req);
    return this.portalService.markMessageRead(clientId, id);
  }

  // ── File drop ──────────────────────────────────────────────────────────────

  @Post('files')
  @ApiOperation({ summary: 'Upload a file to the client portal (max 10 MB)' })
  @ApiConsumes('multipart/form-data')
  @UseInterceptors(
    FileInterceptor('file', {
      storage: memoryStorage(),
      limits: { fileSize: 10 * 1024 * 1024 },
      fileFilter: (_req, file, cb) => {
        const ext = path.extname(file.originalname).toLowerCase();
        const allowed = ['.pdf', '.jpg', '.jpeg', '.png', '.gif', '.webp', '.csv', '.xls', '.xlsx', '.doc', '.docx', '.zip', '.txt'];
        if (!allowed.includes(ext)) {
          return cb(new BadRequestException(`File type ${ext} is not allowed`), false);
        }
        cb(null, true);
      },
    }),
  )
  async uploadFile(
    @Request() req: ExpressRequest,
    @UploadedFile() file: Express.Multer.File,
  ) {
    if (!file) throw new BadRequestException('No file attached');
    const { clientId, tenantId } = this.user(req);
    return this.portalService.uploadFile(clientId, tenantId, file);
  }

  @Get('files')
  @ApiOperation({ summary: 'List files uploaded by this client' })
  getFiles(@Request() req: ExpressRequest) {
    const { clientId } = this.user(req);
    return this.portalService.getFiles(clientId);
  }

  @Get('files/:id/download')
  @ApiOperation({ summary: 'Download a file uploaded by this client' })
  async downloadFile(
    @Request() req: ExpressRequest,
    @Param('id') id: string,
    @Res() res: Response,
  ) {
    const { clientId } = this.user(req);
    const record = await this.portalService.getFileRecord(clientId, id);
    if (!fs.existsSync(record.storagePath)) {
      return res.status(404).json({ message: 'File not found on disk' });
    }
    res.download(record.storagePath, record.originalName);
  }
}
