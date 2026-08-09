import {
  Body, Controller, Delete, Get, Param, Patch, Post, Query, UseGuards,
} from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { CustomersService } from './customers.service';
import { CreateCustomerDto, UpdateCustomerDto, InviteCustomerDto } from './dto/customer.dto';
import { PaginationDto } from '../../common/dto/pagination.dto';
import { AdminJwtGuard } from '../auth/guards/admin-jwt.guard';
import { PermissionsGuard } from '../auth/guards/permissions.guard';
import { RequirePermissions } from '../auth/decorators/require-permissions.decorator';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import { PERMISSIONS } from '@karrkarr/shared';
import type { AdminJwtPayload } from '../auth/strategies/admin-jwt.strategy';

@ApiTags('customers')
@ApiBearerAuth('AdminJWT')
@UseGuards(AdminJwtGuard, PermissionsGuard)
@Controller('customers')
export class CustomersController {
  constructor(private readonly service: CustomersService) {}

  @Get()
  @RequirePermissions(PERMISSIONS.CUSTOMER_READ)
  @ApiOperation({ summary: 'List customers — NRIC masked unless customer.pii_read' })
  findAll(@Query() pagination: PaginationDto, @CurrentUser() caller: AdminJwtPayload) {
    return this.service.findAll(pagination, caller);
  }

  @Get(':id')
  @RequirePermissions(PERMISSIONS.CUSTOMER_READ)
  @ApiOperation({ summary: 'Get customer detail — NRIC masked unless customer.pii_read' })
  findOne(@Param('id') id: string, @CurrentUser() caller: AdminJwtPayload) {
    return this.service.findOne(id, caller);
  }

  @Post()
  @RequirePermissions(PERMISSIONS.CUSTOMER_WRITE)
  @ApiOperation({ summary: 'Create customer account' })
  create(@Body() dto: CreateCustomerDto) {
    return this.service.create(dto);
  }

  @Patch(':id')
  @RequirePermissions(PERMISSIONS.CUSTOMER_WRITE)
  @ApiOperation({ summary: 'Update customer' })
  update(
    @Param('id') id: string,
    @Body() dto: UpdateCustomerDto,
    @CurrentUser() caller: AdminJwtPayload,
  ) {
    return this.service.update(id, dto, caller);
  }

  @Post('invite')
  @RequirePermissions(PERMISSIONS.CUSTOMER_WRITE)
  @ApiOperation({ summary: 'Send portal invitation to a customer' })
  invite(@Body() dto: InviteCustomerDto) {
    return this.service.invite(dto.customerId);
  }

  @Delete(':id')
  @RequirePermissions(PERMISSIONS.CUSTOMER_WRITE)
  @ApiOperation({ summary: 'Deactivate customer (soft delete)' })
  remove(@Param('id') id: string) {
    return this.service.remove(id);
  }
  @Patch(':id/set-password')
  @RequirePermissions(PERMISSIONS.CUSTOMER_MANAGE)
  @ApiOperation({ summary: 'Admin: set or reset a customer password' })
  async setPassword(
    @Param('id') id: string,
    @Body('password') password: string,
  ) {
    return this.service.setPassword(id, password);
  }

}
