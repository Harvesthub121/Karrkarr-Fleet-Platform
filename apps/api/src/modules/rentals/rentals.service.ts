import {
  Injectable, NotFoundException, BadRequestException, ConflictException,
} from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { VehicleStatusMachineService } from '../vehicles/vehicle-status-machine.service';
import {
  CreateRentalDto, UpdateRentalDto, ReturnVehicleDto, TerminateRentalDto,
} from './dto/rental.dto';
import { PaginationDto, paginate } from '../../common/dto/pagination.dto';
import { RentalStatus, VehicleStatus } from '@prisma/client';

@Injectable()
export class RentalsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly statusMachine: VehicleStatusMachineService,
  ) {}

  async findAll(pagination: PaginationDto, branchId?: string, status?: RentalStatus) {
    const where = {
      ...(branchId && { branchId }),
      ...(status && { status }),
    };
    const [items, total] = await Promise.all([
      this.prisma.rentalAgreement.findMany({
        where,
        skip: pagination.skip,
        take: pagination.pageSize,
        orderBy: { createdAt: 'desc' },
        include: {
          customer: { select: { id: true, customerRef: true, fullName: true, phone: true } },
          vehicle: { select: { id: true, plateNumber: true, make: true, model: true } },
          branch: { select: { id: true, code: true, name: true } },
        },
      }),
      this.prisma.rentalAgreement.count({ where }),
    ]);
    return paginate(items, total, pagination);
  }

  async findOne(id: string) {
    const rental = await this.prisma.rentalAgreement.findUnique({
      where: { id },
      include: {
        customer: true,
        vehicle: true,
        branch: true,
        invoices: { orderBy: { dueDate: 'asc' } },
        documents: true,
        accidents: true,
      },
    });
    if (!rental) throw new NotFoundException(`Rental agreement ${id} not found`);
    return rental;
  }

  async create(dto: CreateRentalDto, createdBy?: string) {
    // Validate vehicle is available for reservation
    const vehicle = await this.prisma.vehicle.findUnique({ where: { id: dto.vehicleId } });
    if (!vehicle) throw new NotFoundException(`Vehicle ${dto.vehicleId} not found`);
    if (vehicle.status !== VehicleStatus.AVAILABLE) {
      throw new ConflictException(`Vehicle is not available (current status: ${vehicle.status})`);
    }

    // Generate agreement number VP-R-{year}-{seq}
    const year = new Date().getFullYear();
    const count = await this.prisma.rentalAgreement.count({
      where: { agreementNo: { startsWith: `VP-R-${year}-` } },
    });
    const agreementNo = `VP-R-${year}-${String(count + 1).padStart(5, '0')}`;

    return this.prisma.$transaction(async (tx) => {
      const rental = await tx.rentalAgreement.create({
        data: {
          ...dto,
          agreementNo,
          rentAmountCents: BigInt(dto.rentAmountCents),
          depositRequiredCents: dto.depositRequiredCents ? BigInt(dto.depositRequiredCents) : 0n,
          excessMileageRateCents: dto.excessMileageRateCents
            ? BigInt(dto.excessMileageRateCents) : undefined,
          // Snapshot vehicle's current accident excess at signing time
          accidentExcessCents: vehicle.accidentExcessCents,
          mileageAtStart: vehicle.currentMileageKm,
          createdBy,
        },
      });

      // Reserve the vehicle
      await tx.vehicle.update({
        where: { id: dto.vehicleId },
        data: { status: VehicleStatus.RESERVED },
      });
      await tx.vehicleStatusChange.create({
        data: {
          vehicleId: dto.vehicleId,
          fromStatus: VehicleStatus.AVAILABLE,
          toStatus: VehicleStatus.RESERVED,
          reason: `Reserved for rental ${agreementNo}`,
          changedBy: createdBy,
        },
      });

      return rental;
    });
  }

  async update(id: string, dto: UpdateRentalDto) {
    const rental = await this.findOne(id);
    if (rental.status === RentalStatus.COMPLETED || rental.status === RentalStatus.CANCELLED) {
      throw new BadRequestException('Cannot update a completed or cancelled rental');
    }
    return this.prisma.rentalAgreement.update({
      where: { id },
      data: {
        ...dto,
        ...(dto.rentAmountCents !== undefined && { rentAmountCents: BigInt(dto.rentAmountCents) }),
        ...(dto.depositRequiredCents !== undefined && {
          depositRequiredCents: BigInt(dto.depositRequiredCents),
        }),
        ...(dto.excessMileageRateCents !== undefined && {
          excessMileageRateCents: BigInt(dto.excessMileageRateCents),
        }),
      },
    });
  }

  /**
   * Activate a DRAFT rental — transitions vehicle RESERVED -> RENTED_OUT
   * and sets the agreement status to ACTIVE.
   */
  async activate(id: string, activatedBy?: string) {
    const rental = await this.findOne(id);
    if (rental.status !== RentalStatus.DRAFT) {
      throw new BadRequestException(`Can only activate a DRAFT rental (current: ${rental.status})`);
    }

    return this.prisma.$transaction(async (tx) => {
      // The status machine enforces RESERVED -> RENTED_OUT is valid
      this.statusMachine.assertTransitionAllowed(VehicleStatus.RESERVED, VehicleStatus.RENTED_OUT);

      await tx.vehicle.update({
        where: { id: rental.vehicleId },
        data: { status: VehicleStatus.RENTED_OUT },
      });
      await tx.vehicleStatusChange.create({
        data: {
          vehicleId: rental.vehicleId,
          fromStatus: VehicleStatus.RESERVED,
          toStatus: VehicleStatus.RENTED_OUT,
          reason: `Rental ${rental.agreementNo} activated`,
          changedBy: activatedBy,
        },
      });

      return tx.rentalAgreement.update({
        where: { id },
        data: { status: RentalStatus.ACTIVE, signedAt: new Date() },
      });
    });
  }

  /**
   * Return a vehicle — transitions RENTED_OUT -> CLEANING.
   * The vehicle goes through the post-return workflow before becoming AVAILABLE.
   */
  async returnVehicle(id: string, dto: ReturnVehicleDto, returnedBy?: string) {
    const rental = await this.findOne(id);
    if (rental.status !== RentalStatus.ACTIVE && rental.status !== RentalStatus.ENDING_SOON) {
      throw new BadRequestException('Can only return an ACTIVE or ENDING_SOON rental');
    }

    return this.prisma.$transaction(async (tx) => {
      this.statusMachine.assertTransitionAllowed(VehicleStatus.RENTED_OUT, VehicleStatus.CLEANING);

      await tx.vehicle.update({
        where: { id: rental.vehicleId },
        data: {
          status: VehicleStatus.CLEANING,
          ...(dto.mileageAtEnd && {
            currentMileageKm: dto.mileageAtEnd,
            mileageUpdatedAt: new Date(),
          }),
        },
      });
      await tx.vehicleStatusChange.create({
        data: {
          vehicleId: rental.vehicleId,
          fromStatus: VehicleStatus.RENTED_OUT,
          toStatus: VehicleStatus.CLEANING,
          reason: `Vehicle returned, rental ${rental.agreementNo}`,
          changedBy: returnedBy,
        },
      });

      return tx.rentalAgreement.update({
        where: { id },
        data: {
          status: RentalStatus.COMPLETED,
          actualReturnDate: new Date(dto.actualReturnDate),
          mileageAtEnd: dto.mileageAtEnd,
          ...(dto.notes && { notes: dto.notes }),
        },
      });
    });
  }

  async terminate(id: string, dto: TerminateRentalDto, terminatedBy?: string) {
    const rental = await this.findOne(id);
    if (
      rental.status !== RentalStatus.ACTIVE &&
      rental.status !== RentalStatus.ENDING_SOON &&
      rental.status !== RentalStatus.DRAFT
    ) {
      throw new BadRequestException('Cannot terminate a completed or cancelled rental');
    }

    return this.prisma.$transaction(async (tx) => {
      // After early termination the vehicle still needs cleaning
      if (rental.status !== RentalStatus.DRAFT) {
        this.statusMachine.assertTransitionAllowed(
          VehicleStatus.RENTED_OUT,
          VehicleStatus.CLEANING,
        );
        await tx.vehicle.update({
          where: { id: rental.vehicleId },
          data: { status: VehicleStatus.CLEANING },
        });
        await tx.vehicleStatusChange.create({
          data: {
            vehicleId: rental.vehicleId,
            fromStatus: VehicleStatus.RENTED_OUT,
            toStatus: VehicleStatus.CLEANING,
            reason: `Early termination: ${dto.reason}`,
            changedBy: terminatedBy,
          },
        });
      } else {
        // DRAFT was never activated — vehicle was RESERVED, free it back
        await tx.vehicle.update({
          where: { id: rental.vehicleId },
          data: { status: VehicleStatus.AVAILABLE },
        });
        await tx.vehicleStatusChange.create({
          data: {
            vehicleId: rental.vehicleId,
            fromStatus: VehicleStatus.RESERVED,
            toStatus: VehicleStatus.AVAILABLE,
            reason: `Draft rental ${rental.agreementNo} cancelled`,
            changedBy: terminatedBy,
          },
        });
      }

      return tx.rentalAgreement.update({
        where: { id },
        data: {
          status:
            rental.status === RentalStatus.DRAFT
              ? RentalStatus.CANCELLED
              : RentalStatus.TERMINATED_EARLY,
          actualReturnDate: new Date(dto.terminationDate),
          notes: dto.reason,
        },
      });
    });
  }
}
