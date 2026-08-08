import {
  Injectable,
  NotFoundException,
  UnauthorizedException,
  BadRequestException,
} from '@nestjs/common';
import * as bcrypt from 'bcrypt';
import { formatSgd } from '@karrkarr/shared';
import { PrismaService } from '../../prisma/prisma.service';
import { S3Service } from '../documents/s3.service';
import { UpdateProfileDto, ChangePasswordDto } from './dto/portal.dto';
import type { CustomerDashboard, AuthedCustomer, Money } from '@karrkarr/shared';

function toMoney(cents: bigint | null | undefined): Money {
  const val = cents ?? BigInt(0);
  return { cents: Number(val), display: formatSgd(val) };
}

@Injectable()
export class PortalService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly s3: S3Service,
  ) {}

  // ---------------------------------------------------------------------------
  // Dashboard
  // ---------------------------------------------------------------------------
  async getDashboard(customerId: string): Promise<CustomerDashboard> {
    const customer = await this.prisma.customer.findUnique({
      where: { id: customerId },
      select: {
        id: true,
        customerRef: true,
        email: true,
        fullName: true,
      },
    });

    if (!customer) throw new NotFoundException('Customer not found');

    const authedCustomer: AuthedCustomer = {
      id: customer.id,
      customerRef: customer.customerRef,
      email: customer.email,
      fullName: customer.fullName,
    };

    // Active/ending-soon rental with vehicle
    const rental = await this.prisma.rental.findFirst({
      where: {
        customerId,
        status: { in: ['ACTIVE', 'ENDING_SOON'] },
      },
      include: {
        vehicle: {
          select: {
            plateNumber: true,
            make: true,
            model: true,
            year: true,
            photos: true,
            accidentExcessCents: true,
            coeExpiry: true,
            inspectionDate: true,
            roadTaxExpiry: true,
            nextServicingDate: true,
          },
        },
      },
    });

    // Invoices for financials
    const invoices = await this.prisma.invoice.findMany({
      where: { customerId },
      select: {
        status: true,
        outstandingCents: true,
        dueDate: true,
      },
    });

    const nonPaidCancelled = invoices.filter(
      (inv) => inv.status !== 'PAID' && inv.status !== 'CANCELLED',
    );
    const dueOrOverdue = invoices.filter(
      (inv) => inv.status === 'DUE' || inv.status === 'OVERDUE',
    );

    const outstandingBalance = toMoney(
      nonPaidCancelled.reduce((sum, inv) => sum + (inv.outstandingCents ?? BigInt(0)), BigInt(0)),
    );

    const currentAmountDue = toMoney(
      dueOrOverdue.reduce((sum, inv) => sum + (inv.outstandingCents ?? BigInt(0)), BigInt(0)),
    );

    const nextDueDateRecord = dueOrOverdue.reduce<Date | null>((earliest, inv) => {
      if (!inv.dueDate) return earliest;
      if (!earliest || inv.dueDate < earliest) return inv.dueDate;
      return earliest;
    }, null);

    // Late interest from ledger
    const lateInterestEntries = await this.prisma.ledgerEntry.findMany({
      where: {
        customerId,
        type: 'LATE_INTEREST',
        isPaid: false,
      },
      select: { amountCents: true },
    });

    const lateInterest = toMoney(
      lateInterestEntries.reduce((sum, e) => sum + (e.amountCents ?? BigInt(0)), BigInt(0)),
    );

    const financials = {
      rentAmount: toMoney(rental?.rentCents),
      depositPaid: toMoney(rental?.depositPaidCents),
      depositBalance: toMoney(rental?.depositBalanceCents),
      accidentExcess: toMoney(rental?.vehicle?.accidentExcessCents),
      outstandingBalance,
      lateInterest,
      currentAmountDue,
      nextDueDate: nextDueDateRecord ? nextDueDateRecord.toISOString().split('T')[0] : null,
    };

    const vehicleInfo = {
      nextServicingDate: rental?.vehicle?.nextServicingDate
        ? rental.vehicle.nextServicingDate.toISOString().split('T')[0]
        : null,
      inspectionDate: rental?.vehicle?.inspectionDate
        ? rental.vehicle.inspectionDate.toISOString().split('T')[0]
        : null,
      roadTaxExpiry: rental?.vehicle?.roadTaxExpiry
        ? rental.vehicle.roadTaxExpiry.toISOString().split('T')[0]
        : null,
      insuranceExpiry: rental?.vehicle?.coeExpiry
        ? rental.vehicle.coeExpiry.toISOString().split('T')[0]
        : null,
    };

    let rentalData: CustomerDashboard['rental'] = null;
    if (rental) {
      const startDate = rental.startDate.toISOString().split('T')[0];
      const endDate = rental.endDate.toISOString().split('T')[0];
      const now = new Date();
      const end = rental.endDate;
      const durationMs = end.getTime() - rental.startDate.getTime();
      const durationDays = Math.ceil(durationMs / (1000 * 60 * 60 * 24));
      const remainingMs = end.getTime() - now.getTime();
      const remainingDays = Math.max(0, Math.ceil(remainingMs / (1000 * 60 * 60 * 24)));

      rentalData = {
        agreementNo: rental.agreementNo,
        status: rental.status,
        vehicle: {
          plateNumber: rental.vehicle.plateNumber,
          make: rental.vehicle.make,
          model: rental.vehicle.model,
          year: rental.vehicle.year,
          photos: rental.vehicle.photos ?? [],
        },
        startDate,
        endDate,
        durationDays,
        remainingDays,
        billingFrequency: rental.billingFrequency as 'WEEKLY' | 'MONTHLY',
        rentAmount: toMoney(rental.rentCents),
      };
    }

    const emergency = {
      roadsideName: 'AA Singapore',
      roadsidePhone: '+65 6748 9911',
      supportEmail: 'support@karrkarr.com.sg',
      supportPhone: '+65 6100 0000',
    };

    return {
      customer: authedCustomer,
      rental: rentalData,
      financials,
      vehicleInfo,
      emergency,
    };
  }

  // ---------------------------------------------------------------------------
  // Invoices
  // ---------------------------------------------------------------------------
  async getInvoices(customerId: string, page = 1, pageSize = 20) {
    const skip = (page - 1) * pageSize;
    const [total, items] = await Promise.all([
      this.prisma.invoice.count({ where: { customerId } }),
      this.prisma.invoice.findMany({
        where: { customerId },
        orderBy: { dueDate: 'desc' },
        skip,
        take: pageSize,
        include: {
          lines: true,
          submissions: true,
          payments: true,
        },
      }),
    ]);

    return {
      items,
      total,
      page,
      pageSize,
      totalPages: Math.ceil(total / pageSize),
    };
  }

  async getInvoice(customerId: string, invoiceId: string) {
    const invoice = await this.prisma.invoice.findFirst({
      where: { id: invoiceId, customerId },
      include: {
        lines: true,
        submissions: true,
        payments: true,
      },
    });

    if (!invoice) throw new NotFoundException('Invoice not found');
    return invoice;
  }

  // ---------------------------------------------------------------------------
  // Documents
  // ---------------------------------------------------------------------------
  async getDocuments(customerId: string) {
    const docs = await this.prisma.document.findMany({
      where: { customerId },
      orderBy: { createdAt: 'desc' },
    });

    return Promise.all(
      docs.map(async (doc) => ({
        ...doc,
        downloadUrl: await this.s3.presignedGet(doc.s3Key),
      })),
    );
  }

  // ---------------------------------------------------------------------------
  // Profile
  // ---------------------------------------------------------------------------
  async getProfile(customerId: string): Promise<AuthedCustomer> {
    const customer = await this.prisma.customer.findUnique({
      where: { id: customerId },
      select: { id: true, customerRef: true, email: true, fullName: true },
    });
    if (!customer) throw new NotFoundException('Customer not found');
    return customer;
  }

  async updateProfile(customerId: string, dto: UpdateProfileDto) {
    return this.prisma.customer.update({
      where: { id: customerId },
      data: {
        ...(dto.phone !== undefined && { phone: dto.phone }),
        ...(dto.addressLine1 !== undefined && { addressLine1: dto.addressLine1 }),
        ...(dto.addressLine2 !== undefined && { addressLine2: dto.addressLine2 }),
        ...(dto.city !== undefined && { city: dto.city }),
        ...(dto.postalCode !== undefined && { postalCode: dto.postalCode }),
        ...(dto.licenceNumber !== undefined && { licenceNumber: dto.licenceNumber }),
        ...(dto.licenceExpiry !== undefined && { licenceExpiry: new Date(dto.licenceExpiry) }),
      },
      select: { id: true, customerRef: true, email: true, fullName: true },
    });
  }

  async changePassword(customerId: string, dto: ChangePasswordDto): Promise<void> {
    const customer = await this.prisma.customer.findUnique({
      where: { id: customerId },
      select: { passwordHash: true },
    });

    if (!customer) throw new NotFoundException('Customer not found');

    const valid = await bcrypt.compare(dto.currentPassword, customer.passwordHash);
    if (!valid) throw new UnauthorizedException('Current password is incorrect');

    const newHash = await bcrypt.hash(dto.newPassword, 12);
    await this.prisma.customer.update({
      where: { id: customerId },
      data: { passwordHash: newHash },
    });
  }

  // ---------------------------------------------------------------------------
  // Proof upload URL
  // ---------------------------------------------------------------------------
  async getProofUploadUrl(
    customerId: string,
    ext: string,
  ): Promise<{ url: string; key: string }> {
    const allowedExts = ['jpg', 'jpeg', 'png', 'heic', 'heif', 'webp', 'pdf'];
    const cleanExt = ext.toLowerCase().replace(/^\./, '');
    if (!allowedExts.includes(cleanExt)) {
      throw new BadRequestException(`File extension .${cleanExt} is not allowed`);
    }

    const mimeMap: Record<string, string> = {
      jpg: 'image/jpeg',
      jpeg: 'image/jpeg',
      png: 'image/png',
      heic: 'image/heic',
      heif: 'image/heif',
      webp: 'image/webp',
      pdf: 'application/pdf',
    };

    const key = `payment-proof/${customerId}/${Date.now()}.${cleanExt}`;
    const mimeType = mimeMap[cleanExt];
    const url = await this.s3.presignedPut(key, mimeType);
    return { url, key };
  }
}
