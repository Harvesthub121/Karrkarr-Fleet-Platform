import {
  Body, Controller, Delete, Get, Param, Patch, Post, Query, UseGuards,
} from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { DocumentsService } from './documents.service';
import { CreateDocumentDto, UpdateDocumentDto, RequestUploadDto } from './dto/document.dto';
import { PaginationDto } from '../../common/dto/pagination.dto';
import { AdminJwtGuard } from '../auth/guards/admin-jwt.guard';
import { PermissionsGuard } from '../auth/guards/permissions.guard';
import { RequirePermissions } from '../auth/decorators/require-permissions.decorator';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import { PERMISSIONS } from '@vida/shared';
import type { AdminJwtPayload } from '../auth/strategies/admin-jwt.strategy';

@ApiTags('documents')
@ApiBearerAuth('AdminJWT')
@UseGuards(AdminJwtGuard, PermissionsGuard)
@Controller('documents')
export class DocumentsController {
  constructor(private readonly service: DocumentsService) {}

  @Post('upload-url')
  @RequirePermissions(PERMISSIONS.VEHICLE_UPDATE)
  @ApiOperation({ summary: 'Request presigned PUT URL for direct S3 upload' })
  requestUpload(@Body() dto: RequestUploadDto, @CurrentUser() caller: AdminJwtPayload) {
    return this.service.requestUpload(dto, caller.sub);
  }

  @Get()
  @RequirePermissions(PERMISSIONS.VEHICLE_READ)
  @ApiOperation({ summary: 'List documents with optional filters' })
  findAll(
    @Query() pagination: PaginationDto,
    @Query('vehicleId') vehicleId?: string,
    @Query('customerId') customerId?: string,
    @Query('rentalAgreementId') rentalAgreementId?: string,
  ) {
    return this.service.findAll({ vehicleId, customerId, rentalAgreementId }, pagination);
  }

  @Get(':id')
  @RequirePermissions(PERMISSIONS.VEHICLE_READ)
  @ApiOperation({ summary: 'Get document metadata' })
  findOne(@Param('id') id: string) {
    return this.service.findOne(id);
  }

  @Get(':id/download')
  @RequirePermissions(PERMISSIONS.VEHICLE_READ)
  @ApiOperation({ summary: 'Get presigned GET URL for document download' })
  getDownloadUrl(@Param('id') id: string) {
    return this.service.getDownloadUrl(id);
  }

  @Post()
  @RequirePermissions(PERMISSIONS.VEHICLE_UPDATE)
  @ApiOperation({ summary: 'Register a document after uploading to S3' })
  create(@Body() dto: CreateDocumentDto, @CurrentUser() caller: AdminJwtPayload) {
    return this.service.create(dto, caller.sub, false);
  }

  @Patch(':id')
  @RequirePermissions(PERMISSIONS.VEHICLE_UPDATE)
  @ApiOperation({ summary: 'Update document metadata' })
  update(@Param('id') id: string, @Body() dto: UpdateDocumentDto) {
    return this.service.update(id, dto);
  }

  @Delete(':id')
  @RequirePermissions(PERMISSIONS.VEHICLE_DELETE)
  @ApiOperation({ summary: 'Delete document and remove from S3' })
  remove(@Param('id') id: string) {
    return this.service.remove(id);
  }
}
