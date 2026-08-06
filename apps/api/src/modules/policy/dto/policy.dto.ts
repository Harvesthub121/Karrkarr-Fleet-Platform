import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsOptional, IsString } from 'class-validator';
import type { PolicyKey } from '@karrkarr/shared';

export class SetPolicyDto {
  @ApiProperty({ description: 'Policy key, e.g. "billing.interestRateBps"' })
  @IsString()
  key!: PolicyKey;

  @ApiProperty({ description: 'String value (parsed by the typed accessor)' })
  @IsString()
  value!: string;

  @ApiPropertyOptional({ description: 'Branch ID for branch-level override; omit for global' })
  @IsOptional()
  @IsString()
  branchId?: string;

  @ApiPropertyOptional({ description: 'Human-readable description of this setting' })
  @IsOptional()
  @IsString()
  description?: string;
}
