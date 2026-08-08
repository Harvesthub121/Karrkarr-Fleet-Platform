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

function toDateStr(d: Date | null | undefined): string | null {
  return d ? d.toISOString().split('T')[0] : null;
}

@Injectable()
export class PortalService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly s3: S3Service,
  ) {}

  async getDashboard(customerId: string): Promise<CustomerDashboard> {
    const customer = await this.prisma.customer.findUnique({
      where: { id: customerId },
      select: { id: true, customerRef: true, email: true, fullName: true },
    });

    if (!customer) throw new NotFoundException('Customer not found');

    const authedCustomer: AuthedCustomer = {
      id: customer.id,
      customerRef: customer.customerRef,
      email: customer.email,
      fullName: customer.fullName,
    };

    // Active/ending-soon rental with vehicle
    const rental = await this.prisma.rentalAgreement.findFirst({
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
            accidentExcessCents: true,
            coeExpiry: true,
            inspectionDue: true,
            roadTaxExpiry: true,
            insuranceExpiry: true,
            nextServiceDate: true,
          },
        },
      },
    });

    // Invoices for financials
    const invoices = await this.prisma.invoice.findMany({
      where: { customerId },
      select: { status: true, outstandingCents: true, dueDate: true },
    });

    const nonPaidCancelled = invoices.filter(
      (inv) => inv.status !== 'PAID' && inv.status !== 'CANCELLED' && inv.status !== 'WRITTEN_OFF',
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
      return !earliest || inv.dueDate < earliest ? inv.dueDate : earliest;
    }, null);

    // Late interest from ledger (LATE_INTEREST entries not offset by a PAYMENT)
    const lateInterestEntries = await this.prisma.ledgerEntry.findMany({
      where: { customerId, type: 'LATE_INTEREST' },
      select: { amountCents: true },
    });
    const lateInterest = toMoney(
      lateInterestEntries.reduce((sum, e) => sum + (e.amountCents ?? BigInt(0)), BigInt(0)),
    );

    const financials = {
      rentAmount: toMoney(rental?.rentAmountCents),
      depositPaid: toMoney(rental?.depositPaidCents),
      depositBalance: toMoney(rental?.depositBalanceCents),
      accidentExcess: toMoney(rental?.vehicle?.accidentExcessCents),
      outstandingBalance,
      lateInterest,
      currentAmountDue,
      nextDueDate: nextDueDateRecord ? toDateStr(nextDueDateRecord) : null,
    };

    const vehicleInfo = {
      nextServicingDate: toDateStr(rental?.vehicle?.nextServiceDate),
      inspectionDate: toDateStr(rental?.vehicle?.inspectionDue),
      roadTaxExpiry: toDateStr(rental?.vehicle?.roadTaxExpiry),
      insuranceExpiry: toDateStr(rental?.vehicle?.insuranceExpiry),
    };

    let rentalData: CustomerDashboard['rental'] = null;
    if (rental) {
      const durationMs = rental.endDate.getTime() - rental.startDate.getTime();
      const durationDays = Math.ceil(durationMs / (1000 * 60 * 60 * 24));
      const remainingMs = rental.endDate.getTime() - Date.now();
      const remainingDays = Math.max(0, Math.ceil(remainingMs / (1000 * 60 * 60 * 24)));

      rentalData = {
        agreementNo: rental.agreementNo,
        status: rental.status,
        vehicle: {
          plateNumber: rental.vehicle.plateNumber,
          make: rental.vehicle.make,
          model: rental.vehicle.model,
          year: rental.vehicle.year,
          photos: [],
        },
        startDate: toDateStr(rental.startDate)!,
        endDate: toDateStr(rental.endDate)!,
        durationDays,
        remainingDays,
        billingFrequency: rental.billingFrequency as 'WEEKLY' | 'MONTHLY',
        rentAmount: toMoney(rental.rentAmountCents),
      };
    }

    return {
      customer: authedCustomer,
      rental: rentalData,
      financials,
      vehicleInfo,
      emergency: {
        roadsideName: 'AA Singapore',
        roadsidePhone: '+65 6748 9911',
        supportEmail: 'support@karrkarr.com.sg',
        supportPhone: '+65 6100 0000',
      },
    };
  }

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

    return { data: items, total, page, pageSize, totalPages: Math.ceil(total / pageSize) };
  }

  async getInvoice(customerId: string, invoiceId: string) {
    const invoice = await this.prisma.invoice.findFirst({
      where: { id: invoiceId, customerId },
      include: { lines: true, submissions: true, payments: true },
    });
    if (!invoice) throw new NotFoundException('Invoice not found');
    return invoice;
  }

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
        ...(dto.address !== undefined && { address: dto.address }),
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
    const valid = await bcrypt.compare(dto.currentPassword, customer.passwordHash ?? '');
    if (!valid) throw new UnauthorizedException('Current password is incorrect');
    const newHash = await bcrypt.hash(dto.newPassword, 12);
    await this.prisma.customer.update({
      where: { id: customerId },
      data: { passwordHash: newHash },
    });
  }

  async getProofUploadUrl(customerId: string, ext: string): Promise<{ url: string; key: string }> {
    const allowedExts = ['jpg', 'jpeg', 'png', 'heic', 'heif', 'webp', 'pdf'];
    const cleanExt = ext.toLowerCase().replace(/^\./, '');
    if (!allowedExts.includes(cleanExt)) {
      throw new BadRequestException(`File extension .${cleanExt} is not allowed`);
    }
    const mimeMap: Record<string, string> = {
      jpg: 'image/jpeg', jpeg: 'image/jpeg', png: 'image/png',
      heic: 'image/heic', heif: 'image/heif', webp: 'image/webp', pdf: 'application/pdf',
    };
    const key = `payment-proof/${customerId}/${Date.now()}.${cleanExt}`;
    const url = await this.s3.presignedPut(key, mimeMap[cleanExt]);
    return { url, key };
  }

  async getRewards(customerId: string) {
    // Get current credit balance
    const credits = await this.prisma.creditReward.findMany({
      where: { customerId },
      orderBy: { earnedAt: 'desc' },
    });

    const totalEarned = credits
      .filter(c => c.type === 'EARNED')
      .reduce((sum, c) => sum + c.amountCents, 0);

    const totalRedeemed = credits
      .filter(c => c.type === 'REDEEMED')
      .reduce((sum, c) => sum + c.amountCents, 0);

    const balance = totalEarned - totalRedeemed;

    // Get upcoming invoice (soonest DUE or UPCOMING)
    const upcomingInvoice = await this.prisma.invoice.findFirst({
      where: {
        customerId,
        status: { in: ['UPCOMING', 'DUE'] },
      },
      orderBy: { dueDate: 'asc' },
      select: {
        id: true,
        invoiceNo: true,
        dueDate: true,
        outstandingCents: true,
        status: true,
        principalCents: true,
      },
    });

    return {
      balance: { cents: balance, display: formatSgd(BigInt(balance)) },
      totalEarned: { cents: totalEarned, display: formatSgd(BigInt(totalEarned)) },
      totalRedeemed: { cents: totalRedeemed, display: formatSgd(BigInt(totalRedeemed)) },
      upcomingInvoice,
      history: credits.map(c => ({
        ...c,
        amountDisplay: formatSgd(BigInt(c.amountCents)),
      })),
    };
  }

  calculateEarlyPaymentCredit(dueDate: Date, paymentDate: Date): { creditCents: number; daysEarly: number; tier: string } {
    const msPerDay = 1000 * 60 * 60 * 24;
    const daysEarly = Math.floor((dueDate.getTime() - paymentDate.getTime()) / msPerDay);

    let creditDollars = 0;
    let tier = 'none';

    if (daysEarly >= 30) {
      creditDollars = 20;
      tier = '30+ days';
    } else if (daysEarly >= 15) {
      creditDollars = 15 + ((daysEarly - 15) / 15) * 5;
      tier = '15-29 days';
    } else if (daysEarly >= 7) {
      creditDollars = 10 + ((daysEarly - 7) / 8) * 5;
      tier = '7-14 days';
    } else {
      creditDollars = 0;
      tier = 'none';
    }

    return {
      creditCents: Math.round(creditDollars * 100),
      daysEarly: Math.max(0, daysEarly),
      tier,
    };
  }
}

