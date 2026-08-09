import { ApiProperty, ApiPropertyOptional, PartialType } from '@nestjs/swagger';
import {
  IsBoolean, IsDateString, IsEnum, IsInt, IsNumber, IsOptional,
  IsString, Length, Min,
} from 'class-validator';
import { VehicleStatus } from '@prisma/client';
import { Type } from 'class-transformer';

export class CreateVehicleDto {
  @ApiProperty({ example: 'SMR1337G' })
  @IsString()
  @Length(3, 10)
  plateNumber!: string;

  @ApiProperty({ example: 'Toyota' })
  @IsString()
  make!: string;

  @ApiProperty({ example: 'Corolla Altis' })
  @IsString()
  model!: string;

  @ApiPropertyOptional({ example: '1.6 G' })
  @IsOptional()
  @IsString()
  variant?: string;

  @ApiProperty({ example: 2022 })
  @IsInt()
  @Min(1990)
  year!: number;

  @ApiPropertyOptional({ example: 'Pearl White' })
  @IsOptional()
  @IsString()
  colour?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  chassisNumber?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  engineNumber?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsInt()
  seatingCapacity?: number;

  @ApiPropertyOptional({ example: 'Petrol' })
  @IsOptional()
  @IsString()
  fuelType?: string;

  @ApiPropertyOptional({ example: 'Automatic' })
  @IsOptional()
  @IsString()
  transmission?: string;

  @ApiProperty({ description: 'Branch ID' })
  @IsString()
  branchId!: string;

  @ApiPropertyOptional({ type: String, format: 'date' })
  @IsOptional()
  @IsDateString()
  coeExpiry?: string;

  @ApiPropertyOptional({ type: String, format: 'date' })
  @IsOptional()
  @IsDateString()
  roadTaxExpiry?: string;

  @ApiPropertyOptional({ type: String, format: 'date' })
  @IsOptional()
  @IsDateString()
  insuranceExpiry?: string;

  @ApiPropertyOptional({ type: String, format: 'date' })
  @IsOptional()
  @IsDateString()
  inspectionDue?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  insurerName?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  policyNumber?: string;

  @ApiPropertyOptional({ description: 'Accident excess in cents', example: 150000 })
  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  @Min(0)
  accidentExcessCents?: number;

  @ApiPropertyOptional({ description: 'Purchase price in cents' })
  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  @Min(0)
  purchasePriceCents?: number;

  @ApiPropertyOptional({ type: String, format: 'date' })
  @IsOptional()
  @IsDateString()
  purchaseDate?: string;

  @ApiPropertyOptional({ description: 'Default weekly rental rate in cents' })
  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  @Min(0)
  defaultWeeklyRateCents?: number;

  @ApiPropertyOptional({ description: 'Default monthly rental rate in cents' })
  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  @Min(0)
  defaultMonthlyRateCents?: number;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  notes?: string;
}

export class UpdateVehicleDto extends PartialType(CreateVehicleDto) {
  @ApiPropertyOptional()
  @IsOptional()
  @IsBoolean()
  isActive?: boolean;
}

export class ChangeVehicleStatusDto {
  @ApiProperty({ enum: VehicleStatus })
  @IsEnum(VehicleStatus)
  status!: VehicleStatus;

  @ApiPropertyOptional({ description: 'Reason for status change' })
  @IsOptional()
  @IsString()
  reason?: string;
}

export class UpdateMileageDto {
  @ApiProperty({ description: 'Current odometer reading in km' })
  @IsInt()
  @Min(0)
  currentMileageKm!: number;
}

export class VehicleFilterDto {
  @ApiPropertyOptional({ enum: VehicleStatus })
  @IsOptional()
  @IsEnum(VehicleStatus)
  status?: VehicleStatus;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  branchId?: string;

  @ApiPropertyOptional({ description: 'Filter vehicles with COE expiring within N days' })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  coeExpiringWithinDays?: number;

  @ApiPropertyOptional({ description: 'Filter vehicles with insurance expiring within N days' })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  insuranceExpiringWithinDays?: number;

  @ApiPropertyOptional({ description: 'Filter vehicles with road tax expiring within N days' })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  roadTaxExpiringWithinDays?: number;

  @ApiPropertyOptional({ description: 'Search by plate number, make, or model' })
  @IsOptional()
  @IsString()
  search?: string;

  @ApiPropertyOptional({ description: 'Filter vehicles with any document expiring within 30 days', type: Boolean })
  @IsOptional()
  @Type(() => Boolean)
  @IsBoolean()
  expirySoon?: boolean;
}
