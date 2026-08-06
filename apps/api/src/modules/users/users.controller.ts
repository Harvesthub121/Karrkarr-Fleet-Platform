import { Body, Controller, Delete, Get, Param, Patch, Post, Query, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { UsersService } from './users.service';
import { CreateAdminUserDto, UpdateAdminUserDto, AssignRoleDto, ChangePasswordDto } from './dto/user.dto';
import { PaginationDto } from '../../common/dto/pagination.dto';
import { AdminJwtGuard } from '../auth/guards/admin-jwt.guard';
import { PermissionsGuard } from '../auth/guards/permissions.guard';
import { RequirePermissions } from '../auth/decorators/require-permissions.decorator';
import { PERMISSIONS } from '@vida/shared';

@ApiTags('users')
@ApiBearerAuth('AdminJWT')
@UseGuards(AdminJwtGuard, PermissionsGuard)
@RequirePermissions(PERMISSIONS.USER_MANAGE)
@Controller('users')
export class UsersController {
  constructor(private readonly service: UsersService) {}

  @Get()
  @ApiOperation({ summary: 'List all admin users (SUPER_ADMIN only)' })
  findAll(@Query() pagination: PaginationDto) {
    return this.service.findAll(pagination);
  }

  @Get(':id')
  @ApiOperation({ summary: 'Get admin user detail' })
  findOne(@Param('id') id: string) {
    return this.service.findOne(id);
  }

  @Post()
  @ApiOperation({ summary: 'Create admin user' })
  create(@Body() dto: CreateAdminUserDto) {
    return this.service.create(dto);
  }

  @Patch(':id')
  @ApiOperation({ summary: 'Update admin user' })
  update(@Param('id') id: string, @Body() dto: UpdateAdminUserDto) {
    return this.service.update(id, dto);
  }

  @Patch(':id/role')
  @ApiOperation({ summary: 'Assign role + branch to admin user' })
  assignRole(@Param('id') id: string, @Body() dto: AssignRoleDto) {
    return this.service.assignRole(id, dto);
  }

  @Patch(':id/password')
  @ApiOperation({ summary: 'Admin reset of another user\'s password' })
  changePassword(@Param('id') id: string, @Body() dto: ChangePasswordDto) {
    return this.service.changePassword(id, dto);
  }

  @Delete(':id')
  @ApiOperation({ summary: 'Deactivate admin user (soft delete)' })
  deactivate(@Param('id') id: string) {
    return this.service.deactivate(id);
  }
}
