import { ApiProperty, ApiPropertyOptional, PartialType, OmitType } from '@nestjs/swagger';
import {
  IsBoolean, IsDateString, IsEmail, IsOptional, IsString, Length,
} from 'class-validator';

export class CreateCustomerDto {
  @ApiProperty({ example: 'john.doe@example.com' })
  @IsEmail()
  email!: string;

  @ApiProperty({ example: 'John Doe' })
  @IsString()
  @Length(1, 120)
  fullName!: string;

  @ApiProperty({ example: '+65 9123 4567' })
  @IsString()
  phone!: string;

  @ApiPropertyOptional({ example: 'S1234567A', description: 'Singapore NRIC' })
  @IsOptional()
  @IsString()
  nric?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  address?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  licenceNumber?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsDateString()
  licenceExpiry?: string;

  @ApiProperty({ description: 'Branch ID this customer belongs to' })
  @IsString()
  branchId!: string;
}

export class UpdateCustomerDto extends PartialType(OmitType(CreateCustomerDto, ['email', 'branchId'] as const)) {
  @ApiPropertyOptional()
  @IsOptional()
  @IsBoolean()
  isActive?: boolean;
}

export class InviteCustomerDto {
  @ApiProperty({ description: 'Customer ID to send invite email for' })
  @IsString()
  customerId!: string;
}
