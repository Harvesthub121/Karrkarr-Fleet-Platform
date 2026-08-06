import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import {
  CreateMaintenanceRecordDto, UpdateMaintenanceRecordDto,
  CreateAccidentRecordDto, UpdateAccidentRecordDto,
} from './dto/maintenance.dto';
import { PaginationDto, paginate } from '../../common/dto/pagination.dto';

@Injectable()
export class MaintenanceService {
  constructor(private readonly prisma: PrismaService) {}

  // ---------------------------------------------------------------------------
  // Maintenance records
  // ---------------------------------------------------------------------------

  async findAllMaintenance(vehicleId: string | undefined, pagination: PaginationDto) {
    const where = vehicleId ? { vehicleId } : {};
    const [items, total] = await Promise.all([
      this.prisma.maintenanceRecord.findMany({
        where,
        skip: pagination.skip,
        take: pagination.pageSize,
        orderBy: { serviceDate: 'desc' },
        include: {
          vehicle: { select: { id: true, plateNumber: true, make: true, model: true } },
          documents: true,
        },
      }),
      this.prisma.maintenanceRecord.count({ where }),
    ]);
    return paginate(items, total, pagination);
  }

  async findOneMaintenance(id: string) {
    const record = await this.prisma.maintenanceRecord.findUnique({
      where: { id },
      include: {
        vehicle: { select: { id: true, plateNumber: true, make: true, model: true } },
        documents: true,
      },
    });
    if (!record) throw new NotFoundException(`Maintenance record ${id} not found`);
    return record;
  }

  async createMaintenance(dto: CreateMaintenanceRecordDto, createdBy?: string) {
    const record = await this.prisma.maintenanceRecord.create({
      data: {
        ...dto,
        costCents: dto.costCents ? BigInt(dto.costCents) : 0n,
        createdBy,
      },
    });

    // If the record specifies next service dates, propagate them to the vehicle
    if (dto.nextServiceDate || dto.nextServiceMileageKm) {
      await this.prisma.vehicle.update({
        where: { id: dto.vehicleId },
        data: {
          lastServiceDate: new Date(dto.serviceDate),
          lastServiceMileageKm: dto.mileageKm,
          nextServiceDate: dto.nextServiceDate ? new Date(dto.nextServiceDate) : undefined,
          nextServiceMileageKm: dto.nextServiceMileageKm,
        },
      });
    }

    return record;
  }

  async updateMaintenance(id: string, dto: UpdateMaintenanceRecordDto) {
    await this.findOneMaintenance(id);
    const data = {
      ...dto,
      ...(dto.costCents !== undefined && { costCents: BigInt(dto.costCents) }),
    };
    return this.prisma.maintenanceRecord.update({ where: { id }, data });
  }

  async deleteMaintenance(id: string) {
    await this.findOneMaintenance(id);
    return this.prisma.maintenanceRecord.delete({ where: { id } });
  }

  // ---------------------------------------------------------------------------
  // Accident records
  // ---------------------------------------------------------------------------

  async findAllAccidents(vehicleId: string | undefined, pagination: PaginationDto) {
    const where = vehicleId ? { vehicleId } : {};
    const [items, total] = await Promise.all([
      this.prisma.accidentRecord.findMany({
        where,
        skip: pagination.skip,
        take: pagination.pageSize,
        orderBy: { incidentDate: 'desc' },
        include: {
          vehicle: { select: { id: true, plateNumber: true } },
          documents: true,
        },
      }),
      this.prisma.accidentRecord.count({ where }),
    ]);
    return paginate(items, total, pagination);
  }

  async findOneAccident(id: string) {
    const record = await this.prisma.accidentRecord.findUnique({
      where: { id },
      include: {
        vehicle: { select: { id: true, plateNumber: true } },
        rental: { select: { id: true, agreementNo: true } },
        documents: true,
      },
    });
    if (!record) throw new NotFoundException(`Accident record ${id} not found`);
    return record;
  }

  async createAccident(dto: CreateAccidentRecordDto) {
    return this.prisma.accidentRecord.create({
      data: {
        ...dto,
        excessAmountCents: dto.excessAmountCents ? BigInt(dto.excessAmountCents) : 0n,
        repairCostCents: dto.repairCostCents ? BigInt(dto.repairCostCents) : 0n,
      },
    });
  }

  async updateAccident(id: string, dto: UpdateAccidentRecordDto) {
    await this.findOneAccident(id);
    const data = {
      ...dto,
      ...(dto.excessAmountCents !== undefined && { excessAmountCents: BigInt(dto.excessAmountCents) }),
      ...(dto.repairCostCents !== undefined && { repairCostCents: BigInt(dto.repairCostCents) }),
    };
    return this.prisma.accidentRecord.update({ where: { id }, data });
  }
}
