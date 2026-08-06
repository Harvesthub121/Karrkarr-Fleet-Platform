import {
  Body, Controller, Get, Param, Patch, Post, Query, UseGuards,
} from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { RentalsService } from './rentals.service';
import { CreateRentalDto, UpdateRentalDto, ReturnVehicleDto, TerminateRentalDto } from './dto/rental.dto';
import { PaginationDto } from '../../common/dto/pagination.dto';
import { AdminJwtGuard } from '../auth/guards/admin-jwt.guard';
import { PermissionsGuard } from '../auth/guards/permissions.guard';
import { RequirePermissions } from '../auth/decorators/require-permissions.decorator';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import { PERMISSIONS } from '@vida/shared';
import { RentalStatus } from '@prisma/client';
import type { AdminJwtPayload } from '../auth/strategies/admin-jwt.strategy';

@ApiTags('rentals')
@ApiBearerAuth('AdminJWT')
@UseGuards(AdminJwtGuard, PermissionsGuard)
@Controller('rentals')
export class RentalsController {
  constructor(private readonly service: RentalsService) {}

  @Get()
  @RequirePermissions(PERMISSIONS.RENTAL_READ)
  @ApiOperation({ summary: 'List rental agreements' })
  findAll(
    @Query() pagination: PaginationDto,
    @Query('branchId') branchId?: string,
    @Query('status') status?: RentalStatus,
  ) {
    return this.service.findAll(pagination, branchId, status);
  }

  @Get(':id')
  @RequirePermissions(PERMISSIONS.RENTAL_READ)
  @ApiOperation({ summary: 'Get rental agreement detail' })
  findOne(@Param('id') id: string) {
    return this.service.findOne(id);
  }

  @Post()
  @RequirePermissions(PERMISSIONS.RENTAL_WRITE)
  @ApiOperation({ summary: 'Create rental agreement (DRAFT)' })
  create(@Body() dto: CreateRentalDto, @CurrentUser() caller: AdminJwtPayload) {
    return this.service.create(dto, caller.sub);
  }

  @Patch(':id')
  @RequirePermissions(PERMISSIONS.RENTAL_WRITE)
  @ApiOperation({ summary: 'Update rental agreement details' })
  update(@Param('id') id: string, @Body() dto: UpdateRentalDto) {
    return this.service.update(id, dto);
  }

  @Post(':id/activate')
  @RequirePermissions(PERMISSIONS.RENTAL_WRITE)
  @ApiOperation({ summary: 'Activate rental — vehicle moves to RENTED_OUT' })
  activate(@Param('id') id: string, @CurrentUser() caller: AdminJwtPayload) {
    return this.service.activate(id, caller.sub);
  }

  @Post(':id/return')
  @RequirePermissions(PERMISSIONS.RENTAL_WRITE)
  @ApiOperation({ summary: 'Return vehicle — rental COMPLETED, vehicle moves to CLEANING' })
  returnVehicle(
    @Param('id') id: string,
    @Body() dto: ReturnVehicleDto,
    @CurrentUser() caller: AdminJwtPayload,
  ) {
    return this.service.returnVehicle(id, dto, caller.sub);
  }

  @Post(':id/terminate')
  @RequirePermissions(PERMISSIONS.RENTAL_TERMINATE)
  @ApiOperation({ summary: 'Early termination of rental agreement' })
  terminate(
    @Param('id') id: string,
    @Body() dto: TerminateRentalDto,
    @CurrentUser() caller: AdminJwtPayload,
  ) {
    return this.service.terminate(id, dto, caller.sub);
  }
}
