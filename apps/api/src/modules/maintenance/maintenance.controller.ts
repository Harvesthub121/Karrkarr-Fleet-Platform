import {
  Body, Controller, Delete, Get, Param, Patch, Post, Query, UseGuards,
} from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { MaintenanceService } from './maintenance.service';
import {
  CreateMaintenanceRecordDto, UpdateMaintenanceRecordDto,
  CreateAccidentRecordDto, UpdateAccidentRecordDto,
} from './dto/maintenance.dto';
import { PaginationDto } from '../../common/dto/pagination.dto';
import { AdminJwtGuard } from '../auth/guards/admin-jwt.guard';
import { PermissionsGuard } from '../auth/guards/permissions.guard';
import { RequirePermissions } from '../auth/decorators/require-permissions.decorator';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import { PERMISSIONS } from '@karrkarr/shared';
import type { AdminJwtPayload } from '../auth/strategies/admin-jwt.strategy';

@ApiTags('maintenance')
@ApiBearerAuth('AdminJWT')
@UseGuards(AdminJwtGuard, PermissionsGuard)
@Controller('maintenance')
export class MaintenanceController {
  constructor(private readonly service: MaintenanceService) {}

  // --- Service records -------------------------------------------------------

  @Get('service-records')
  @RequirePermissions(PERMISSIONS.MAINTENANCE_READ)
  @ApiOperation({ summary: 'List maintenance records (optionally filter by vehicleId)' })
  findAll(@Query('vehicleId') vehicleId: string | undefined, @Query() pagination: PaginationDto) {
    return this.service.findAllMaintenance(vehicleId, pagination);
  }

  @Get('service-records/:id')
  @RequirePermissions(PERMISSIONS.MAINTENANCE_READ)
  @ApiOperation({ summary: 'Get maintenance record' })
  findOne(@Param('id') id: string) {
    return this.service.findOneMaintenance(id);
  }

  @Post('service-records')
  @RequirePermissions(PERMISSIONS.MAINTENANCE_WRITE)
  @ApiOperation({ summary: 'Create maintenance record' })
  create(@Body() dto: CreateMaintenanceRecordDto, @CurrentUser() caller: AdminJwtPayload) {
    return this.service.createMaintenance(dto, caller.sub);
  }

  @Patch('service-records/:id')
  @RequirePermissions(PERMISSIONS.MAINTENANCE_WRITE)
  @ApiOperation({ summary: 'Update maintenance record' })
  update(@Param('id') id: string, @Body() dto: UpdateMaintenanceRecordDto) {
    return this.service.updateMaintenance(id, dto);
  }

  @Delete('service-records/:id')
  @RequirePermissions(PERMISSIONS.MAINTENANCE_WRITE)
  @ApiOperation({ summary: 'Delete maintenance record' })
  remove(@Param('id') id: string) {
    return this.service.deleteMaintenance(id);
  }

  // --- Accident records -------------------------------------------------------

  @Get('accident-records')
  @RequirePermissions(PERMISSIONS.MAINTENANCE_READ)
  @ApiOperation({ summary: 'List accident records (optionally filter by vehicleId)' })
  findAllAccidents(
    @Query('vehicleId') vehicleId: string | undefined,
    @Query() pagination: PaginationDto,
  ) {
    return this.service.findAllAccidents(vehicleId, pagination);
  }

  @Get('accident-records/:id')
  @RequirePermissions(PERMISSIONS.MAINTENANCE_READ)
  @ApiOperation({ summary: 'Get accident record' })
  findOneAccident(@Param('id') id: string) {
    return this.service.findOneAccident(id);
  }

  @Post('accident-records')
  @RequirePermissions(PERMISSIONS.MAINTENANCE_WRITE)
  @ApiOperation({ summary: 'Record accident' })
  createAccident(@Body() dto: CreateAccidentRecordDto) {
    return this.service.createAccident(dto);
  }

  @Patch('accident-records/:id')
  @RequirePermissions(PERMISSIONS.MAINTENANCE_WRITE)
  @ApiOperation({ summary: 'Update accident record' })
  updateAccident(@Param('id') id: string, @Body() dto: UpdateAccidentRecordDto) {
    return this.service.updateAccident(id, dto);
  }
}
