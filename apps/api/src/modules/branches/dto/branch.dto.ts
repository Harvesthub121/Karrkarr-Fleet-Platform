import { ApiProperty, ApiPropertyOptional, PartialType } from '@nestjs/swagger';
import { IsBoolean, IsOptional, IsString, Length } from 'class-validator';

export class CreateBranchDto {
  @ApiProperty({ example: 'UBI', description: 'Short branch code used in references' })
  @IsString()
  @Length(2, 10)
  code!: string;

  @ApiProperty({ example: 'Ubi Hub Branch' })
  @IsString()
  @Length(1, 120)
  name!: string;

  @ApiProperty({ example: '10 Ubi Crescent, #05-88, Singapore' })
  @IsString()
  address!: string;

  @ApiPropertyOptional({ example: '408564' })
  @IsOptional()
  @IsString()
  postal?: string;

  @ApiPropertyOptional({ example: '+65 6100 1234' })
  @IsOptional()
  @IsString()
  phone?: string;

  @ApiPropertyOptional({ description: 'Admin user ID of the branch manager' })
  @IsOptional()
  @IsString()
  managerId?: string;
}

export class UpdateBranchDto extends PartialType(CreateBranchDto) {
  @ApiPropertyOptional()
  @IsOptional()
  @IsBoolean()
  isActive?: boolean;
}
