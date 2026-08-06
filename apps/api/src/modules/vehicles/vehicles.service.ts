import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { VehicleStatusMachineService } from './vehicle-status-machine.service';
import {
  CreateVehicleDto, UpdateVehicleDto, ChangeVehicleStatusDto,
  UpdateMileageDto, VehicleFilterDto,
} from './dto/vehicle.dto';
import { PaginationDto, paginate } from '../../common/dto/pagination.dto';
import type { AdminJwtPayload } from '../auth/strategies/admin-jwt.strategy';
import { Prisma } from '@prisma/client';

@Injectable()
export class VehiclesService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly statusMachine: VehicleStatusMachineService,
  ) {}

  async findAll(filter: VehicleFilterDto, pagination: PaginationDto) {
    const now = new Date();
    const where: Prisma.VehicleWhereInput = { isActive: true };

    if (filter.status) where.status = filter.status;
    if (filter.branchId) where.branchId = filter.branchId;

    if (filter.coeExpiringWithinDays) {
      const cutoff = new Date(now);
      cutoff.setDate(cutoff.getDate() + filter.coeExpiringWithinDays);
      where.coeExpiry = { lte: cutoff };
    }

    if (filter.insuranceExpiringWithinDays) {
      const cutoff = new Date(now);
      cutoff.setDate(cutoff.getDate() + filter.insuranceExpiringWithinDays);
      where.insuranceExpiry = { lte: cutoff };
    }

    if (filter.roadTaxExpiringWithinDays) {
      const cutoff = new Date(now);
      cutoff.setDate(cutoff.getDate() + filter.roadTaxExpiringWithinDays);
      where.roadTaxExpiry = { lte: cutoff };
    }

    const [items, total] = await Promise.all([
      this.prisma.vehicle.findMany({
        where,
        skip: pagination.skip,
        take: pagination.pageSize,
        orderBy: { plateNumber: 'asc' },
        include: {
          branch: { select: { id: true, code: true, name: true } },
          rentals: {
            where: { status: { in: ['ACTIVE', 'ENDING_SOON'] } },
            take: 1,
            include: { customer: { select: { id: true, customerRef: true, fullName: true } } },
          },
        },
      }),
      this.prisma.vehicle.count({ where }),
    ]);

    return paginate(items, total, pagination);
  }

  /**
   * Vehicle dashboard endpoint — returns everything the brief lists in one
   * aggregated payload so the admin UI can render the full vehicle card
   * without additional round-trips.
   */
  async getDashboard(id: string) {
    const vehicle = await this.prisma.vehicle.findUnique({
      where: { id },
      include: {
        branch: true,
        photos: { orderBy: { sortOrder: 'asc' } },
        statusHistory: { orderBy: { changedAt: 'desc' }, take: 20 },
        maintenance: {
          orderBy: { serviceDate: 'desc' },
          take: 10,
          include: { documents: true },
        },
        accidents: {
          orderBy: { incidentDate: 'desc' },
          take: 10,
          include: { documents: true },
        },
        documents: { orderBy: { createdAt: 'desc' } },
        rentals: {
          where: { status: { in: ['ACTIVE', 'ENDING_SOON', 'DRAFT'] } },
          take: 1,
          include: {
            customer: {
              select: {
                id: true, customerRef: true, fullName: true, phone: true, email: true,
              },
            },
            invoices: {
              where: { status: { notIn: ['PAID', 'CANCELLED', 'WRITTEN_OFF'] } },
              orderBy: { dueDate: 'asc' },
              take: 3,
              select: {
                id: true, invoiceNo: true, status: true, dueDate: true,
                principalCents: true, outstandingCents: true,
              },
            },
          },
        },
      },
    });

    if (!vehicle) throw new NotFoundException(`Vehicle ${id} not found`);

    return {
      ...vehicle,
      allowedStatusTransitions: this.statusMachine.allowedTransitions(vehicle.status),
      currentRental: vehicle.rentals[0] ?? null,
      currentPaymentStatus: vehicle.rentals[0]?.invoices ?? [],
    };
  }

  async findOne(id: string) {
    const v = await this.prisma.vehicle.findUnique({
      where: { id },
      include: { branch: { select: { id: true, code: true, name: true } } },
    });
    if (!v) throw new NotFoundException(`Vehicle ${id} not found`);
    return v;
  }

  async create(dto: CreateVehicleDto, caller: AdminJwtPayload) {
    return this.prisma.vehicle.create({
      data: {
        ...dto,
        accidentExcessCents: dto.accidentExcessCents ? BigInt(dto.accidentExcessCents) : 0n,
        purchasePriceCents: dto.purchasePriceCents ? BigInt(dto.purchasePriceCents) : undefined,
        defaultWeeklyRateCents: dto.defaultWeeklyRateCents ? BigInt(dto.defaultWeeklyRateCents) : undefined,
        defaultMonthlyRateCents: dto.defaultMonthlyRateCents ? BigInt(dto.defaultMonthlyRateCents) : undefined,
      },
    });
  }

  async update(id: string, dto: UpdateVehicleDto) {
    await this.findOne(id);
    const data: Prisma.VehicleUpdateInput = { ...dto };
    if (dto.accidentExcessCents !== undefined) data.accidentExcessCents = BigInt(dto.accidentExcessCents);
    if (dto.purchasePriceCents !== undefined) data.purchasePriceCents = BigInt(dto.purchasePriceCents);
    if (dto.defaultWeeklyRateCents !== undefined) data.defaultWeeklyRateCents = BigInt(dto.defaultWeeklyRateCents);
    if (dto.defaultMonthlyRateCents !== undefined) data.defaultMonthlyRateCents = BigInt(dto.defaultMonthlyRateCents);
    return this.prisma.vehicle.update({ where: { id }, data });
  }

  async changeStatus(id: string, dto: ChangeVehicleStatusDto, caller: AdminJwtPayload) {
    const vehicle = await this.findOne(id);
    this.statusMachine.assertTransitionAllowed(vehicle.status, dto.status);

    return this.prisma.$transaction(async (tx) => {
      const updated = await tx.vehicle.update({
        where: { id },
        data: { status: dto.status },
      });

      await tx.vehicleStatusChange.create({
        data: {
          vehicleId: id,
          fromStatus: vehicle.status,
          toStatus: dto.status,
          reason: dto.reason,
          changedBy: caller.sub,
        },
      });

      return updated;
    });
  }

  async updateMileage(id: string, dto: UpdateMileageDto) {
    await this.findOne(id);
    return this.prisma.vehicle.update({
      where: { id },
      data: { currentMileageKm: dto.currentMileageKm, mileageUpdatedAt: new Date() },
    });
  }

  async getStatusHistory(id: string) {
    await this.findOne(id);
    return this.prisma.vehicleStatusChange.findMany({
      where: { vehicleId: id },
      orderBy: { changedAt: 'desc' },
    });
  }

  async remove(id: string) {
    await this.findOne(id);
    return this.prisma.vehicle.update({ where: { id }, data: { isActive: false } });
  }
}
