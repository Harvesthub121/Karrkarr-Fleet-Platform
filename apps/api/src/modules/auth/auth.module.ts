import { Module } from '@nestjs/common';
import { JwtModule } from '@nestjs/jwt';
import { PassportModule } from '@nestjs/passport';

import { AuthController } from './auth.controller';
import { AuthService } from './auth.service';
import { AdminJwtStrategy } from './strategies/admin-jwt.strategy';
import { CustomerJwtStrategy } from './strategies/customer-jwt.strategy';
import { PermissionsGuard } from './guards/permissions.guard';
import { CustomerScopeGuard } from './guards/customer-scope.guard';

// JWT configuration is loaded from environment by each strategy individually
// rather than via JwtModule.registerAsync so each strategy can use a different
// secret. JwtModule is registered here for the AuthService to use for signing.
@Module({
  imports: [
    PassportModule,
    // We register JwtModule without a default secret; AuthService calls
    // jwtService.sign() with the correct secret per call.
    JwtModule.register({}),
  ],
  controllers: [AuthController],
  providers: [
    AuthService,
    AdminJwtStrategy,
    CustomerJwtStrategy,
    PermissionsGuard,
    CustomerScopeGuard,
  ],
  exports: [AuthService, PermissionsGuard, CustomerScopeGuard],
})
export class AuthModule {}
