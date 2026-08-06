import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { AuthService } from '../auth/auth.service';
import { CreateAdminUserDto, UpdateAdminUserDto, AssignRoleDto, ChangePasswordDto } from './dto/user.dto';
import { PaginationDto, paginate } from '../../common/dto/pagination.dto';

// Fields we never return over the wire
const SAFE_SELECT = {
  id: true,
  email: true,
  fullName: true,
  phone: true,
  role: true,
  branchId: true,
  isActive: true,
  lastLoginAt: true,
  mfaEnabled: true,
  createdAt: true,
  updatedAt: true,
  passwordHash: false,
  mfaSecret: false,
} as const;

@Injectable()
export class UsersService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly authService: AuthService,
  ) {}

  async findAll(pagination: PaginationDto) {
    const [items, total] = await Promise.all([
      this.prisma.adminUser.findMany({
        skip: pagination.skip,
        take: pagination.pageSize,
        select: SAFE_SELECT,
        orderBy: { fullName: 'asc' },
      }),
      this.prisma.adminUser.count(),
    ]);
    return paginate(items, total, pagination);
  }

  async findOne(id: string) {
    const user = await this.prisma.adminUser.findUnique({
      where: { id },
      select: { ...SAFE_SELECT, branch: { select: { id: true, code: true, name: true } } },
    });
    if (!user) throw new NotFoundException(`Admin user ${id} not found`);
    return user;
  }

  async create(dto: CreateAdminUserDto) {
    const passwordHash = await this.authService.hashPassword(dto.password);
    const { password: _, ...rest } = dto;
    return this.prisma.adminUser.create({
      data: { ...rest, passwordHash },
      select: SAFE_SELECT,
    });
  }

  async update(id: string, dto: UpdateAdminUserDto) {
    await this.findOne(id);
    return this.prisma.adminUser.update({ where: { id }, data: dto, select: SAFE_SELECT });
  }

  async assignRole(id: string, dto: AssignRoleDto) {
    await this.findOne(id);
    return this.prisma.adminUser.update({
      where: { id },
      data: { role: dto.role, branchId: dto.branchId ?? null },
      select: SAFE_SELECT,
    });
  }

  async changePassword(id: string, dto: ChangePasswordDto) {
    await this.findOne(id);
    const hash = await this.authService.hashPassword(dto.newPassword);
    return this.prisma.adminUser.update({
      where: { id },
      data: { passwordHash: hash, passwordChangedAt: new Date() },
      select: SAFE_SELECT,
    });
  }

  async deactivate(id: string) {
    await this.findOne(id);
    return this.prisma.adminUser.update({ where: { id }, data: { isActive: false }, select: SAFE_SELECT });
  }
}
