import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  NotFoundException,
  Param,
  Patch,
  Post,
  Request,
  UseGuards,
} from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import type { Request as ExpressRequest } from 'express';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { ChaseTemplatesService } from './chase-templates.service';
import { CreateChaseTemplateDto } from './dto/create-chase-template.dto';
import { UpdateChaseTemplateDto } from './dto/update-chase-template.dto';

interface RequestUser {
  tenantId: string;
}

@ApiTags('chase-templates')
@ApiBearerAuth('access-token')
@UseGuards(JwtAuthGuard)
@Controller('chase-templates')
export class ChaseTemplatesController {
  constructor(private readonly service: ChaseTemplatesService) {}

  private tenantId(req: ExpressRequest): string {
    const id = (req.user as RequestUser)?.tenantId;
    if (!id) throw new NotFoundException('No tenant on this account');
    return id;
  }

  @Get()
  @ApiOperation({ summary: 'List chase templates for this firm (seeds defaults on first call)' })
  list(@Request() req: ExpressRequest) {
    return this.service.list(this.tenantId(req));
  }

  @Post()
  @ApiOperation({ summary: 'Create a new chase template' })
  create(@Request() req: ExpressRequest, @Body() dto: CreateChaseTemplateDto) {
    return this.service.create(this.tenantId(req), dto);
  }

  @Patch(':id')
  @ApiOperation({ summary: 'Update a chase template' })
  update(
    @Request() req: ExpressRequest,
    @Param('id') id: string,
    @Body() dto: UpdateChaseTemplateDto,
  ) {
    return this.service.update(this.tenantId(req), id, dto);
  }

  @Delete(':id')
  @HttpCode(204)
  @ApiOperation({ summary: 'Delete a chase template' })
  remove(@Request() req: ExpressRequest, @Param('id') id: string) {
    return this.service.delete(this.tenantId(req), id);
  }
}
