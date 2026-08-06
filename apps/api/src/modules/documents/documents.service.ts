import { ForbiddenException, Injectable, NotFoundException } from '@nestjs/common';
import { randomUUID } from 'crypto';
import { PrismaService } from '../../prisma/prisma.service';
import { S3Service } from './s3.service';
import { CreateDocumentDto, UpdateDocumentDto, RequestUploadDto } from './dto/document.dto';
import { PaginationDto, paginate } from '../../common/dto/pagination.dto';
import type { CustomerJwtPayload } from '../auth/strategies/customer-jwt.strategy';

@Injectable()
export class DocumentsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly s3: S3Service,
  ) {}

  /**
   * Issue a presigned PUT URL so the client can upload directly to S3.
   * The key embeds a UUID so two uploads of the same filename never collide.
   */
  async requestUpload(dto: RequestUploadDto, uploaderId?: string): Promise<{ uploadUrl: string; s3Key: string }> {
    const scope = dto.vehicleId
      ? `vehicles/${dto.vehicleId}`
      : dto.customerId
      ? `customers/${dto.customerId}`
      : 'general';

    const s3Key = `${scope}/${randomUUID()}-${dto.filename}`;
    const uploadUrl = await this.s3.presignedPut(s3Key, dto.mimeType);
    return { uploadUrl, s3Key };
  }

  async findAll(filters: {
    vehicleId?: string;
    customerId?: string;
    rentalAgreementId?: string;
  }, pagination: PaginationDto) {
    const where = {
      ...(filters.vehicleId && { vehicleId: filters.vehicleId }),
      ...(filters.customerId && { customerId: filters.customerId }),
      ...(filters.rentalAgreementId && { rentalAgreementId: filters.rentalAgreementId }),
    };
    const [items, total] = await Promise.all([
      this.prisma.document.findMany({
        where,
        skip: pagination.skip,
        take: pagination.pageSize,
        orderBy: { createdAt: 'desc' },
      }),
      this.prisma.document.count({ where }),
    ]);
    return paginate(items, total, pagination);
  }

  async findOne(id: string, caller?: CustomerJwtPayload) {
    const doc = await this.prisma.document.findUnique({ where: { id } });
    if (!doc) throw new NotFoundException(`Document ${id} not found`);

    // Customers may only download documents marked visible to them
    if (caller && !doc.visibleToCustomer) {
      throw new ForbiddenException('This document is not available in the customer portal');
    }

    return doc;
  }

  async getDownloadUrl(id: string, caller?: CustomerJwtPayload): Promise<{ downloadUrl: string }> {
    const doc = await this.findOne(id, caller);
    const downloadUrl = await this.s3.presignedGet(doc.s3Key);
    return { downloadUrl };
  }

  async create(dto: CreateDocumentDto, uploadedById?: string, uploadedByCustomer = false) {
    return this.prisma.document.create({
      data: { ...dto, uploadedById, uploadedByCustomer },
    });
  }

  async update(id: string, dto: UpdateDocumentDto) {
    await this.findOne(id);
    return this.prisma.document.update({ where: { id }, data: dto });
  }

  async remove(id: string) {
    const doc = await this.findOne(id);
    // Delete from S3 first; if this fails, we'd rather have an orphaned DB row
    // than an unreachable reference. S3 lifecycle rules can clean orphaned keys.
    await this.s3.delete(doc.s3Key);
    return this.prisma.document.delete({ where: { id } });
  }
}
