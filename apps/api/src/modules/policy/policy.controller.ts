import { Body, Controller, Get, Param, Post, Query, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { PolicyService } from './policy.service';
import { SetPolicyDto } from './dto/policy.dto';
import { AdminJwtGuard } from '../auth/guards/admin-jwt.guard';
import { PermissionsGuard } from '../auth/guards/permissions.guard';
import { RequirePermissions } from '../auth/decorators/require-permissions.decorator';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import { PERMISSIONS, POLICY_DEFAULTS } from '@karrkarr/shared';
import type { AdminJwtPayload } from '../auth/strategies/admin-jwt.strategy';
import type { PolicyKey } from '@karrkarr/shared';

@ApiTags('policy')
@ApiBearerAuth('AdminJWT')
@UseGuards(AdminJwtGuard, PermissionsGuard)
@Controller('policy')
export class PolicyController {
  constructor(private readonly service: PolicyService) {}

  @Get()
  @RequirePermissions(PERMISSIONS.POLICY_MANAGE)
  @ApiOperation({ summary: 'Get all resolved policy settings for a branch (or global)' })
  getAll(@Query('branchId') branchId?: string) {
    return this.service.getAll(branchId);
  }

  @Get('defaults')
  @RequirePermissions(PERMISSIONS.POLICY_MANAGE)
  @ApiOperation({ summary: 'Get the compiled default values for all policy keys' })
  getDefaults() {
    return POLICY_DEFAULTS;
  }

  @Get(':key/history')
  @RequirePermissions(PERMISSIONS.POLICY_MANAGE)
  @ApiOperation({ summary: 'Get change history for a specific policy key' })
  getHistory(@Param('key') key: PolicyKey, @Query('branchId') branchId?: string) {
    return this.service.findHistory(key, branchId);
  }

  @Post()
  @RequirePermissions(PERMISSIONS.POLICY_MANAGE)
  @ApiOperation({ summary: 'Set a policy value (creates a new versioned entry)' })
  set(@Body() dto: SetPolicyDto, @CurrentUser() caller: AdminJwtPayload) {
    return this.service.set(
      dto.key,
      dto.value,
      dto.branchId ?? null,
      caller.sub,
      dto.description,
    );
  }
}
