import {
  Controller,
  Get,
  Patch,
  Post,
  Body,
  Param,
  Query,
  UseGuards,
  HttpCode,
  HttpStatus,
} from '@nestjs/common';
import { CustomerJwtGuard } from '../auth/guards/customer-jwt.guard';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import { PortalService } from './portal.service';
import { UpdateProfileDto, ChangePasswordDto, ProofUploadUrlDto } from './dto/portal.dto';

interface CustomerJwtPayload {
  sub: string;
  email: string;
  customerRef: string;
  branchId: string;
  aud: string;
}

@UseGuards(CustomerJwtGuard)
@Controller('portal')
export class PortalController {
  constructor(private readonly portalService: PortalService) {}

  // GET /portal/dashboard
  @Get('dashboard')
  getDashboard(@CurrentUser() user: CustomerJwtPayload) {
    return this.portalService.getDashboard(user.sub);
  }

  // GET /portal/invoices?page=&pageSize=
  @Get('invoices')
  getInvoices(
    @CurrentUser() user: CustomerJwtPayload,
    @Query('page') page?: string,
    @Query('pageSize') pageSize?: string,
  ) {
    return this.portalService.getInvoices(
      user.sub,
      page ? parseInt(page, 10) : 1,
      pageSize ? parseInt(pageSize, 10) : 20,
    );
  }

  // GET /portal/invoices/:id
  @Get('invoices/:id')
  getInvoice(@CurrentUser() user: CustomerJwtPayload, @Param('id') id: string) {
    return this.portalService.getInvoice(user.sub, id);
  }

  // GET /portal/documents
  @Get('documents')
  getDocuments(@CurrentUser() user: CustomerJwtPayload) {
    return this.portalService.getDocuments(user.sub);
  }

  // GET /portal/profile
  @Get('profile')
  getProfile(@CurrentUser() user: CustomerJwtPayload) {
    return this.portalService.getProfile(user.sub);
  }

  // PATCH /portal/profile
  @Patch('profile')
  updateProfile(@CurrentUser() user: CustomerJwtPayload, @Body() dto: UpdateProfileDto) {
    return this.portalService.updateProfile(user.sub, dto);
  }

  // POST /portal/profile/password
  @Post('profile/password')
  @HttpCode(HttpStatus.NO_CONTENT)
  async changePassword(
    @CurrentUser() user: CustomerJwtPayload,
    @Body() dto: ChangePasswordDto,
  ): Promise<void> {
    await this.portalService.changePassword(user.sub, dto);
  }

  // POST /portal/proof-upload-url
  @Post('proof-upload-url')
  getProofUploadUrl(@CurrentUser() user: CustomerJwtPayload, @Body() dto: ProofUploadUrlDto) {
    return this.portalService.getProofUploadUrl(user.sub, dto.ext);
  }
}
