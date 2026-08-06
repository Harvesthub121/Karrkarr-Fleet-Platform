import { ApiProperty, ApiPropertyOptional, PartialType } from '@nestjs/swagger';
import {
  IsBoolean, IsDateString, IsEnum, IsInt, IsNumber, IsOptional,
  IsString, Min,
} from 'class-validator';
import { MaintenanceType } from '@prisma/client';
import { Type } from 'class-transformer';

export class CreateMaintenanceRecordDto {
  @ApiProperty()
  @IsString()
  vehicleId!: string;

  @ApiProperty({ enum: MaintenanceType })
  @IsEnum(MaintenanceType)
  type!: MaintenanceType;

  @ApiProperty()
  @IsString()
  description!: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  workshopName?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  workshopContact?: string;

  @ApiProperty({ type: String, format: 'date' })
  @IsDateString()
  serviceDate!: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsInt()
  @Min(0)
  mileageKm?: number;

  @ApiPropertyOptional({ description: 'Cost in cents' })
  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  @Min(0)
  costCents?: number;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  invoiceNumber?: string;

  @ApiPropertyOptional({ type: String, format: 'date' })
  @IsOptional()
  @IsDateString()
  nextServiceDate?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsInt()
  @Min(0)
  nextServiceMileageKm?: number;

  @ApiPropertyOptional({ default: false })
  @IsOptional()
  @IsBoolean()
  rechargedToCustomer?: boolean;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  notes?: string;
}

export class UpdateMaintenanceRecordDto extends PartialType(CreateMaintenanceRecordDto) {}

export class CreateAccidentRecordDto {
  @ApiProperty()
  @IsString()
  vehicleId!: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  rentalAgreementId?: string;

  @ApiProperty({ type: String, format: 'date' })
  @IsDateString()
  incidentDate!: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  location?: string;

  @ApiProperty()
  @IsString()
  description!: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  policeReportNumber?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  insuranceClaimNumber?: string;

  @ApiPropertyOptional({ default: false })
  @IsOptional()
  @IsBoolean()
  atFault?: boolean;

  @ApiPropertyOptional({ description: 'Excess amount in cents' })
  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  @Min(0)
  excessAmountCents?: number;

  @ApiPropertyOptional({ description: 'Repair cost in cents' })
  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  @Min(0)
  repairCostCents?: number;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  notes?: string;
}

export class UpdateAccidentRecordDto extends PartialType(CreateAccidentRecordDto) {
  @ApiPropertyOptional()
  @IsOptional()
  @IsBoolean()
  excessCharged?: boolean;

  @ApiPropertyOptional({ type: String, format: 'date-time' })
  @IsOptional()
  @IsDateString()
  resolvedAt?: string;
}
