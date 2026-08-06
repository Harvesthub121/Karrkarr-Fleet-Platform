import { ApiProperty } from '@nestjs/swagger';
import { IsEmail, IsString, Matches, MaxLength, MinLength } from 'class-validator';

/**
 * Password policy for NEW passwords (activation, reset, change).
 *
 * Deliberately NOT applied to login DTOs: rejecting a login because the
 * submitted password is too short leaks the policy to an attacker and breaks
 * legacy accounts. Login just checks the hash.
 *
 * 12 chars + mixed classes, with a 128 cap because bcrypt silently truncates
 * at 72 bytes and we would rather reject than quietly ignore the tail.
 */
export const PASSWORD_MIN_LENGTH = 12;
export const PASSWORD_MAX_LENGTH = 128;
export const PASSWORD_PATTERN =
  /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[^A-Za-z0-9]).{12,128}$/;
export const PASSWORD_MESSAGE =
  'Password must be at least 12 characters and include an uppercase letter, a lowercase letter, a number and a symbol.';

export class AdminLoginDto {
  @ApiProperty({ example: 'ops@vidapartners.com.sg' })
  @IsEmail()
  email!: string;

  @ApiProperty({ example: 'strong-password' })
  @IsString()
  @MinLength(8)
  password!: string;
}

export class CustomerLoginDto {
  @ApiProperty({ example: 'john@example.com' })
  @IsEmail()
  email!: string;

  @ApiProperty()
  @IsString()
  @MinLength(8)
  password!: string;
}

export class RefreshDto {
  @ApiProperty({ description: 'Opaque refresh token from the login response' })
  @IsString()
  refreshToken!: string;
}

export class LogoutDto {
  @ApiProperty()
  @IsString()
  refreshToken!: string;
}

export class ActivateDto {
  @ApiProperty({ description: 'JWT invite token from the invite email' })
  @IsString()
  token!: string;

  @ApiProperty({ description: PASSWORD_MESSAGE })
  @IsString()
  @MinLength(PASSWORD_MIN_LENGTH)
  @MaxLength(PASSWORD_MAX_LENGTH)
  @Matches(PASSWORD_PATTERN, { message: PASSWORD_MESSAGE })
  password!: string;
}

export class ChangePasswordDto {
  @ApiProperty({ description: 'Current password, re-verified before any change' })
  @IsString()
  currentPassword!: string;

  @ApiProperty({ description: PASSWORD_MESSAGE })
  @IsString()
  @MinLength(PASSWORD_MIN_LENGTH)
  @MaxLength(PASSWORD_MAX_LENGTH)
  @Matches(PASSWORD_PATTERN, { message: PASSWORD_MESSAGE })
  newPassword!: string;
}

export class RequestPasswordResetDto {
  @ApiProperty()
  @IsEmail()
  email!: string;
}

export class ResetPasswordDto {
  @ApiProperty({ description: 'Single-use reset token from the email' })
  @IsString()
  token!: string;

  @ApiProperty({ description: PASSWORD_MESSAGE })
  @IsString()
  @MinLength(PASSWORD_MIN_LENGTH)
  @MaxLength(PASSWORD_MAX_LENGTH)
  @Matches(PASSWORD_PATTERN, { message: PASSWORD_MESSAGE })
  newPassword!: string;
}
