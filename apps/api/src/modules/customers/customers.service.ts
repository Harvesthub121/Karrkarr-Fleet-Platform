import { Injectable, NotFoundException, ConflictException } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { AuthService } from '../auth/auth.service';
import { CreateCustomerDto, UpdateCustomerDto } from './dto/customer.dto';
import { PaginationDto, paginate } from '../../common/dto/pagination.dto';
import type { AdminJwtPayload } from '../auth/strategies/admin-jwt.strategy';
import { PERMISSIONS } from '@karrkarr/shared';

/**
 * Mask NRIC to format "SXXXX567A" — show only the last 3 alphanumeric chars.
 * This follows MAS/PDPA guidance: the last 3 chars + check digit are sufficient
 * for identity confirmation without exposing the full number.
 */
function maskNric(nric: string | null): string | null {
  if (!nric) return null;
  if (nric.length <= 4) return '****';
  return nric.slice(0, 1) + 'X'.repeat(nric.length - 4) + nric.slice(-3);
}

function mayReadPii(caller: AdminJwtPayload): boolean {
  return caller.permissions.includes(PERMISSIONS.CUSTOMER_PII_READ);
}

@Injectable()
export class CustomersService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly authService: AuthService,
  ) {}

  async findAll(pagination: PaginationDto, caller: AdminJwtPayload) {
    const [items, total] = await Promise.all([
      this.prisma.customer.findMany({
        skip: pagination.skip,
        take: pagination.pageSize,
        orderBy: { createdAt: 'desc' },
        include: {
          branch: { select: { id: true, code: true, name: true } },
          _count: { select: { rentals: true } },
        },
      }),
      this.prisma.customer.count(),
    ]);

    const piiAllowed = mayReadPii(caller);
    return paginate(
      items.map((c) => ({
        ...c,
        nric: piiAllowed ? c.nric : maskNric(c.nric),
        passwordHash: undefined,
      })),
      total,
      pagination,
    );
  }

  async findOne(id: string, caller: AdminJwtPayload) {
    const customer = await this.prisma.customer.findUnique({
      where: { id },
      include: {
        branch: { select: { id: true, code: true, name: true } },
        rentals: {
          orderBy: { createdAt: 'desc' },
          take: 5,
          select: {
            id: true, agreementNo: true, status: true, startDate: true, endDate: true,
            vehicle: { select: { plateNumber: true, make: true, model: true } },
          },
        },
      },
    });

    if (!customer) throw new NotFoundException(`Customer ${id} not found`);

    const piiAllowed = mayReadPii(caller);
    return {
      ...customer,
      nric: piiAllowed ? customer.nric : maskNric(customer.nric),
      passwordHash: undefined,
    };
  }

  async create(dto: CreateCustomerDto) {
    const existing = await this.prisma.customer.findUnique({ where: { email: dto.email } });
    if (existing) throw new ConflictException('Email already registered');

    // Generate human-readable customer reference KR-C-XXXXX
    const count = await this.prisma.customer.count();
    const customerRef = `KR-C-${String(count + 1).padStart(5, '0')}`;

    return this.prisma.customer.create({
      data: { ...dto, customerRef },
      select: {
        id: true, customerRef: true, email: true, fullName: true,
        phone: true, branchId: true, isActive: true, createdAt: true,
      },
    });
  }

  async update(id: string, dto: UpdateCustomerDto, caller: AdminJwtPayload) {
    await this.findOne(id, caller);
    return this.prisma.customer.update({
      where: { id },
      data: dto,
      select: {
        id: true, customerRef: true, email: true, fullName: true,
        phone: true, branchId: true, isActive: true, updatedAt: true,
      },
    });
  }

  async invite(customerId: string): Promise<{ inviteToken: string }> {
    const customer = await this.prisma.customer.findUnique({ where: { id: customerId } });
    if (!customer) throw new NotFoundException(`Customer ${customerId} not found`);
    if (customer.activatedAt) throw new ConflictException('Customer already activated');

    const inviteToken = this.authService.generateInviteToken(customerId);
    await this.prisma.customer.update({
      where: { id: customerId },
      data: { invitedAt: new Date() },
    });

    // The Notifications module sends the actual email — we just return the token
    // so the caller (or a job) can embed it in the email link.
    return { inviteToken };
  }

  async remove(id: string) {
    const exists = await this.prisma.customer.findUnique({ where: { id } });
    if (!exists) throw new NotFoundException(`Customer ${id} not found`);
    return this.prisma.customer.update({
      where: { id },
      data: { isActive: false },
    });
  }
}
