import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { CreateBranchDto, UpdateBranchDto } from './dto/branch.dto';
import { PaginationDto, paginate } from '../../common/dto/pagination.dto';

@Injectable()
export class BranchesService {
  constructor(private readonly prisma: PrismaService) {}

  async findAll(pagination: PaginationDto) {
    const [items, total] = await Promise.all([
      this.prisma.branch.findMany({
        skip: pagination.skip,
        take: pagination.pageSize,
        orderBy: { code: 'asc' },
        include: {
          manager: { select: { id: true, fullName: true, email: true } },
          _count: {
            select: {
              vehicles: { where: { isActive: true } },
              rentals: { where: { status: { in: ['ACTIVE', 'ENDING_SOON'] } } },
            },
          },
        },
      }),
      this.prisma.branch.count(),
    ]);

    return paginate(items, total, pagination);
  }

  async findOne(id: string) {
    const branch = await this.prisma.branch.findUnique({
      where: { id },
      include: {
        manager: { select: { id: true, fullName: true, email: true } },
        _count: {
          select: {
            vehicles: { where: { isActive: true } },
            rentals: { where: { status: { in: ['ACTIVE', 'ENDING_SOON'] } } },
            customers: { where: { isActive: true } },
          },
        },
      },
    });

    if (!branch) throw new NotFoundException(`Branch ${id} not found`);
    return branch;
  }

  async create(dto: CreateBranchDto) {
    return this.prisma.branch.create({
      data: { ...dto },
    });
  }

  async update(id: string, dto: UpdateBranchDto) {
    await this.findOne(id);
    return this.prisma.branch.update({ where: { id }, data: dto });
  }

  async remove(id: string) {
    await this.findOne(id);
    // Soft-delete: mark inactive rather than deleting so historical data is preserved
    return this.prisma.branch.update({ where: { id }, data: { isActive: false } });
  }
}
