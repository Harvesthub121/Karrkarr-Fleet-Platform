import { ApiProperty, ApiPropertyOptional, PartialType, OmitType } from '@nestjs/swagger';
import {
  IsDateString, IsEnum, IsInt, IsNumber, IsOptional, IsString, Max, Min,
} from 'class-validator';
import { BillingFrequency } from '@prisma/client';
import { Type } from 'class-transformer';

export class CreateRentalDto {
  @ApiProperty()
  @IsString()
  customerId!: string;

  @ApiProperty()
  @IsString()
  vehicleId!: string;

  @ApiProperty()
  @IsString()
  branchId!: string;

  @ApiProperty({ type: String, format: 'date' })
  @IsDateString()
  startDate!: string;

  @ApiProperty({ type: String, format: 'date' })
  @IsDateString()
  endDate!: string;

  @ApiProperty({ enum: BillingFrequency })
  @IsEnum(BillingFrequency)
  billingFrequency!: BillingFrequency;

  @ApiProperty({ description: 'Rent amount in cents per billing period' })
  @Type(() => Number)
  @IsNumber()
  @Min(0)
  rentAmountCents!: number;

  @ApiProperty({
    description: 'Day-of-week (1=Mon..7=Sun) for WEEKLY, day-of-month (1-28) for MONTHLY',
  })
  @IsInt()
  @Min(1)
  @Max(28)
  billingAnchorDay!: number;

  @ApiPropertyOptional({ description: 'Required deposit in cents' })
  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  @Min(0)
  depositRequiredCents?: number;

  @ApiPropertyOptional({ description: 'Mileage cap in km' })
  @IsOptional()
  @IsInt()
  @Min(0)
  mileageCapKm?: number;

  @ApiPropertyOptional({ description: 'Excess mileage rate in cents per km' })
  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  @Min(0)
  excessMileageRateCents?: number;

  @ApiPropertyOptional({ description: 'Override interest rate in bps for this contract' })
  @IsOptional()
  @IsInt()
  @Min(0)
  interestRateBpsOverride?: number;

  @ApiPropertyOptional({ description: 'Override grace period days for this contract' })
  @IsOptional()
  @IsInt()
  @Min(0)
  gracePeriodDaysOverride?: number;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  notes?: string;
}

export class UpdateRentalDto extends PartialType(
  OmitType(CreateRentalDto, ['customerId', 'vehicleId', 'branchId'] as const),
) {}

export class ReturnVehicleDto {
  @ApiProperty({ type: String, format: 'date' })
  @IsDateString()
  actualReturnDate!: string;

  @ApiPropertyOptional({ description: 'Odometer reading at return' })
  @IsOptional()
  @IsInt()
  @Min(0)
  mileageAtEnd?: number;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  notes?: string;
}

export class TerminateRentalDto {
  @ApiProperty({ type: String, format: 'date' })
  @IsDateString()
  terminationDate!: string;

  @ApiProperty({ description: 'Reason for early termination' })
  @IsString()
  reason!: string;
}
