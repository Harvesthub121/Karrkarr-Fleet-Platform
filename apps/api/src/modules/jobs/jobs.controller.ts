import { Controller, Post, Get, UseGuards } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiBearerAuth } from '@nestjs/swagger';
import { JobsService } from './jobs.service';
import { RequirePermissions } from '../auth/decorators/require-permissions.decorator';
import { AdminJwtGuard } from '../auth/guards/admin-jwt.guard';
import { PermissionsGuard } from '../auth/guards/permissions.guard';
import { PERMISSIONS } from '@vida/shared';

/**
 * JobsController — manual trigger endpoints for SUPER_ADMIN ops use.
 * Invaluable during incident response and for testing new deployments.
 * All routes require POLICY_MANAGE (SUPER_ADMIN only) as a proxy for
 * "system-level operation".
 */
@ApiTags('Jobs')
@ApiBearerAuth()
@UseGuards(AdminJwtGuard, PermissionsGuard)
@Controller('admin/jobs')
export class JobsController {
  constructor(private readonly jobs: JobsService) {}

  @Get('stats')
  @ApiOperation({ summary: 'Queue statistics (SUPER_ADMIN)' })
  @RequirePermissions(PERMISSIONS.POLICY_MANAGE)
  async stats() {
    return this.jobs.getQueueStats();
  }

  @Post('trigger/payment-reminder')
  @ApiOperation({ summary: 'Manually trigger payment reminder sweep' })
  @RequirePermissions(PERMISSIONS.POLICY_MANAGE)
  async triggerPaymentReminder() {
    await this.jobs.triggerPaymentReminder();
    return { queued: true };
  }

  @Post('trigger/interest-accrual')
  @ApiOperation({ summary: 'Manually trigger interest accrual sweep' })
  @RequirePermissions(PERMISSIONS.POLICY_MANAGE)
  async triggerInterestAccrual() {
    await this.jobs.triggerInterestAccrual();
    return { queued: true };
  }

  @Post('trigger/expiry-reminder')
  @ApiOperation({ summary: 'Manually trigger expiry reminder sweep' })
  @RequirePermissions(PERMISSIONS.POLICY_MANAGE)
  async triggerExpiryReminder() {
    await this.jobs.triggerExpiryReminder();
    return { queued: true };
  }

  @Post('trigger/rental-status')
  @ApiOperation({ summary: 'Manually trigger rental status update' })
  @RequirePermissions(PERMISSIONS.POLICY_MANAGE)
  async triggerRentalStatus() {
    await this.jobs.triggerRentalStatus();
    return { queued: true };
  }

  @Post('trigger/risk-scoring')
  @ApiOperation({ summary: 'Manually trigger risk scoring sweep' })
  @RequirePermissions(PERMISSIONS.POLICY_MANAGE)
  async triggerRiskScoring() {
    await this.jobs.triggerRiskScoring();
    return { queued: true };
  }

  @Post('trigger/invoice-generation')
  @ApiOperation({ summary: 'Manually trigger invoice generation' })
  @RequirePermissions(PERMISSIONS.POLICY_MANAGE)
  async triggerInvoiceGeneration() {
    await this.jobs.triggerInvoiceGeneration();
    return { queued: true };
  }
}
