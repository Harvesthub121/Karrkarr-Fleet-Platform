import {
  Body, Controller, Delete, Get, Param, Patch, Post, Query, UseGuards,
} from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { VehiclesService } from './vehicles.service';
import {
  CreateVehicleDto, UpdateVehicleDto, ChangeVehicleStatusDto,
  UpdateMileageDto, VehicleFilterDto,
} from './dto/vehicle.dto';
import { PaginationDto } from '../../common/dto/pagination.dto';
import { AdminJwtGuard } from '../auth/guards/admin-jwt.guard';
import { PermissionsGuard } from '../auth/guards/permissions.guard';
import { RequirePermissions } from '../auth/decorators/require-permissions.decorator';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import { PERMISSIONS } from '@vida/shared';
import type { AdminJwtPayload } from '../auth/strategies/admin-jwt.strategy';

@ApiTags('vehicles')
@ApiBearerAuth('AdminJWT')
@UseGuards(AdminJwtGuard, PermissionsGuard)
@Controller('vehicles')
export class VehiclesController {
  constructor(private readonly service: VehiclesService) {}

  @Get()
  @RequirePermissions(PERMISSIONS.VEHICLE_READ)
  @ApiOperation({ summary: 'List vehicles with filtering by branch/status/expiry' })
  findAll(@Query() filter: VehicleFilterDto, @Query() pagination: PaginationDto) {
    return this.service.findAll(filter, pagination);
  }

  @Get(':id')
  @RequirePermissions(PERMISSIONS.VEHICLE_READ)
  @ApiOperation({ summary: 'Get vehicle detail' })
  findOne(@Param('id') id: string) {
    return this.service.findOne(id);
  }

  @Get(':id/dashboard')
  @RequirePermissions(PERMISSIONS.VEHICLE_READ)
  @ApiOperation({
    summary: 'Vehicle dashboard — registration, compliance dates, current rental, payment status, service/accident history, documents, photos',
  })
  getDashboard(@Param('id') id: string) {
    return this.service.getDashboard(id);
  }

  @Get(':id/status-history')
  @RequirePermissions(PERMISSIONS.VEHICLE_READ)
  @ApiOperation({ summary: 'Vehicle status transition history' })
  getStatusHistory(@Param('id') id: string) {
    return this.service.getStatusHistory(id);
  }

  @Post()
  @RequirePermissions(PERMISSIONS.VEHICLE_CREATE)
  @ApiOperation({ summary: 'Add vehicle to fleet' })
  create(@Body() dto: CreateVehicleDto, @CurrentUser() caller: AdminJwtPayload) {
    return this.service.create(dto, caller);
  }

  @Patch(':id')
  @RequirePermissions(PERMISSIONS.VEHICLE_UPDATE)
  @ApiOperation({ summary: 'Update vehicle details' })
  update(@Param('id') id: string, @Body() dto: UpdateVehicleDto) {
    return this.service.update(id, dto);
  }

  @Patch(':id/status')
  @RequirePermissions(PERMISSIONS.VEHICLE_STATUS_CHANGE)
  @ApiOperation({ summary: 'Change vehicle status — validated by status machine' })
  changeStatus(
    @Param('id') id: string,
    @Body() dto: ChangeVehicleStatusDto,
    @CurrentUser() caller: AdminJwtPayload,
  ) {
    return this.service.changeStatus(id, dto, caller);
  }

  @Patch(':id/mileage')
  @RequirePermissions(PERMISSIONS.VEHICLE_UPDATE)
  @ApiOperation({ summary: 'Update vehicle current mileage' })
  updateMileage(@Param('id') id: string, @Body() dto: UpdateMileageDto) {
    return this.service.updateMileage(id, dto);
  }

  @Delete(':id')
  @RequirePermissions(PERMISSIONS.VEHICLE_DELETE)
  @ApiOperation({ summary: 'Retire vehicle (soft delete)' })
  remove(@Param('id') id: string) {
    return this.service.remove(id);
  }
}
