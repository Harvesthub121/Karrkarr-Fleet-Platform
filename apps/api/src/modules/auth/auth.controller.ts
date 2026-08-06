import {
  Body,
  Controller,
  HttpCode,
  HttpStatus,
  Post,
  Req,
  UseGuards,
} from '@nestjs/common';
import { ApiOperation, ApiTags, ApiBearerAuth } from '@nestjs/swagger';
import { Request } from 'express';
import { AuthService } from './auth.service';
import {
  AdminLoginDto,
  CustomerLoginDto,
  RefreshDto,
  LogoutDto,
  ActivateDto,
} from './dto/auth.dto';
import { AdminJwtGuard } from './guards/admin-jwt.guard';
import { CustomerJwtGuard } from './guards/customer-jwt.guard';

@ApiTags('auth')
@Controller('auth')
export class AuthController {
  constructor(private readonly auth: AuthService) {}

  @Post('admin/login')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Admin login — returns access + refresh tokens' })
  adminLogin(@Body() dto: AdminLoginDto, @Req() req: Request) {
    return this.auth.adminLogin(dto, req.ip, req.headers['user-agent']);
  }

  @Post('admin/refresh')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Rotate admin refresh token' })
  adminRefresh(@Body() dto: RefreshDto, @Req() req: Request) {
    return this.auth.refreshAdmin(dto, req.ip, req.headers['user-agent']);
  }

  @Post('admin/logout')
  @HttpCode(HttpStatus.NO_CONTENT)
  @UseGuards(AdminJwtGuard)
  @ApiBearerAuth('AdminJWT')
  @ApiOperation({ summary: 'Revoke admin refresh token' })
  async adminLogout(@Body() dto: LogoutDto) {
    await this.auth.logout(dto.refreshToken);
  }

  @Post('customer/login')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Customer portal login' })
  customerLogin(@Body() dto: CustomerLoginDto, @Req() req: Request) {
    return this.auth.customerLogin(dto, req.ip, req.headers['user-agent']);
  }

  @Post('customer/refresh')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Rotate customer refresh token' })
  customerRefresh(@Body() dto: RefreshDto, @Req() req: Request) {
    return this.auth.refreshCustomer(dto, req.ip, req.headers['user-agent']);
  }

  @Post('customer/logout')
  @HttpCode(HttpStatus.NO_CONTENT)
  @UseGuards(CustomerJwtGuard)
  @ApiBearerAuth('CustomerJWT')
  @ApiOperation({ summary: 'Revoke customer refresh token' })
  async customerLogout(@Body() dto: LogoutDto) {
    await this.auth.logout(dto.refreshToken);
  }

  @Post('customer/activate')
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({ summary: 'Activate a customer account from invite email link' })
  async activate(@Body() dto: ActivateDto) {
    await this.auth.activateCustomer(dto.token, dto.password);
  }
}
