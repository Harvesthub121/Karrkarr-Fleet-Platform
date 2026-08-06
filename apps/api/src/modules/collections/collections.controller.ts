import {
  Controller,
  Get,
  Post,
  Param,
  Body,
  Query,
  UseGuards,
} from '@nestjs/common';
import { ApiTags, ApiOperation, ApiBearerAuth } from '@nestjs/swagger';
import { CollectionsService } from './collections.service';
import { RequirePermissions } from '../auth/decorators/require-permissions.decorator';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import { AdminJwtGuard } from '../auth/guards/admin-jwt.guard';
import { PermissionsGuard } from '../auth/guards/permissions.guard';
import { PERMISSIONS } from '@karrkarr/shared';
import { IsString, IsEnum, IsOptional } from 'class-validator';
import { NotificationChannel } from '@prisma/client';

class ManualReminderDto {
  @IsEnum(NotificationChannel)
  channel: NotificationChannel;
}

@ApiTags('Collections')
@ApiBearerAuth()
@UseGuards(AdminJwtGuard, PermissionsGuard)
@Controller('collections')
export class CollectionsController {
  constructor(private readonly collections: CollectionsService) {}

  @Get('summary')
  @ApiOperation({ summary: 'Collections ageing summary' })
  @RequirePermissions(PERMISSIONS.COLLECTIONS_READ)
  async summary(@Query('branchId') branchId?: string) {
    return this.collections.getSummary(branchId);
  }

  @Get('rows')
  @ApiOperation({ summary: 'Collections dashboard rows' })
  @RequirePermissions(PERMISSIONS.COLLECTIONS_READ)
  async rows(
    @Query('branchId') branchId?: string,
    @Query('page') page: number = 1,
    @Query('pageSize') pageSize: number = 50,
  ) {
    return this.collections.getRows(branchId, page, pageSize);
  }

  @Get('customers/:customerId/audit-trail')
  @ApiOperation({ summary: 'Full payment audit trail for a customer' })
  @RequirePermissions(PERMISSIONS.COLLECTIONS_READ)
  async auditTrail(@Param('customerId') customerId: string) {
    return this.collections.getCustomerAuditTrail(customerId);
  }

  @Post('invoices/:invoiceId/remind')
  @ApiOperation({ summary: 'Trigger a manual reminder for an invoice' })
  @RequirePermissions(PERMISSIONS.COLLECTIONS_ACTION)
  async triggerReminder(
    @Param('invoiceId') invoiceId: string,
    @Body() dto: ManualReminderDto,
    @CurrentUser() user: { id: string },
  ) {
    await this.collections.triggerManualReminder(invoiceId, dto.channel, user.id);
    return { ok: true };
  }
}
