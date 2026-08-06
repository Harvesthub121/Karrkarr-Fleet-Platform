import { ApiProperty, ApiPropertyOptional, PartialType, OmitType } from '@nestjs/swagger';
import {
  IsBoolean, IsEmail, IsEnum, IsOptional, IsString, Length, MinLength,
} from 'class-validator';
import { AdminRole } from '@prisma/client';

export class CreateAdminUserDto {
  @ApiProperty({ example: 'ops@karrkarr.com.sg' })
  @IsEmail()
  email!: string;

  @ApiProperty({ description: 'Initial password (min 8 chars)' })
  @IsString()
  @MinLength(8)
  password!: string;

  @ApiProperty({ example: 'Jane Tan' })
  @IsString()
  @Length(1, 120)
  fullName!: string;

  @ApiPropertyOptional({ example: '+65 9123 4567' })
  @IsOptional()
  @IsString()
  phone?: string;

  @ApiProperty({ enum: AdminRole })
  @IsEnum(AdminRole)
  role!: AdminRole;

  @ApiPropertyOptional({ description: 'Branch ID — null for head-office/all-branch roles' })
  @IsOptional()
  @IsString()
  branchId?: string;
}

export class UpdateAdminUserDto extends PartialType(
  OmitType(CreateAdminUserDto, ['email', 'password'] as const),
) {
  @ApiPropertyOptional()
  @IsOptional()
  @IsBoolean()
  isActive?: boolean;
}

export class AssignRoleDto {
  @ApiProperty({ enum: AdminRole })
  @IsEnum(AdminRole)
  role!: AdminRole;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  branchId?: string;
}

export class ChangePasswordDto {
  @ApiProperty()
  @IsString()
  @MinLength(8)
  newPassword!: string;
}
