import {
  Injectable,
  UnauthorizedException,
  ForbiddenException,
  ConflictException,
} from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import * as bcrypt from 'bcrypt';
import * as crypto from 'crypto';
import { PrismaService } from '../../prisma/prisma.service';
import { ROLE_PERMISSIONS, isBranchScoped } from '@karrkarr/shared';
import type { AdminUser, Customer } from '@prisma/client';
import type { AdminLoginDto, CustomerLoginDto, RefreshDto } from './dto/auth.dto';

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------
const BCRYPT_ROUNDS = 12;
const MAX_FAILED_LOGINS = 5;
// Lock duration after max failures: 15 minutes
const LOCKOUT_MINUTES = 15;
const ACCESS_TTL_SECONDS = parseInt(process.env.JWT_ACCESS_TTL_SECONDS ?? '900', 10);
const REFRESH_TTL_DAYS = parseInt(process.env.JWT_REFRESH_TTL_DAYS ?? '30', 10);

export interface TokenPair {
  accessToken: string;
  refreshToken: string;
  expiresIn: number;
}

// ---------------------------------------------------------------------------
// JWT audiences: keep admin and customer tokens non-interchangeable.
// A customer token presented to an admin endpoint must be rejected even if
// both are signed with valid secrets, because the guard checks `aud`.
// ---------------------------------------------------------------------------
export const ADMIN_JWT_AUDIENCE = 'karrkarr:admin';
export const CUSTOMER_JWT_AUDIENCE = 'karrkarr:customer';

@Injectable()
export class AuthService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly jwt: JwtService,
  ) {}

  // ---------------------------------------------------------------------------
  // Admin login
  // ---------------------------------------------------------------------------

  async adminLogin(dto: AdminLoginDto, ip?: string, ua?: string): Promise<TokenPair> {
    const user = await this.prisma.adminUser.findUnique({
      where: { email: dto.email.toLowerCase() },
    });

    if (!user || !user.isActive) {
      // Constant-time response to avoid user enumeration
      await bcrypt.hash('timing-equaliser', BCRYPT_ROUNDS);
      throw new UnauthorizedException('Invalid credentials');
    }

    await this.assertNotLocked(user);

    const valid = await bcrypt.compare(dto.password, user.passwordHash);
    if (!valid) {
      await this.recordFailedLogin('admin', user.id);
      throw new UnauthorizedException('Invalid credentials');
    }

    await this.resetFailedLogins('admin', user.id);
    await this.prisma.adminUser.update({
      where: { id: user.id },
      data: { lastLoginAt: new Date() },
    });

    return this.issueAdminTokens(user, ip, ua);
  }

  // ---------------------------------------------------------------------------
  // Customer login
  // ---------------------------------------------------------------------------

  async customerLogin(dto: CustomerLoginDto, ip?: string, ua?: string): Promise<TokenPair> {
    const customer = await this.prisma.customer.findUnique({
      where: { email: dto.email.toLowerCase() },
    });

    if (!customer || !customer.isActive || !customer.activatedAt || !customer.passwordHash) {
      await bcrypt.hash('timing-equaliser', BCRYPT_ROUNDS);
      throw new UnauthorizedException('Invalid credentials');
    }

    await this.assertNotLockedCustomer(customer);

    const valid = await bcrypt.compare(dto.password, customer.passwordHash);
    if (!valid) {
      await this.recordFailedLogin('customer', customer.id);
      throw new UnauthorizedException('Invalid credentials');
    }

    await this.resetFailedLogins('customer', customer.id);
    await this.prisma.customer.update({
      where: { id: customer.id },
      data: { lastLoginAt: new Date() },
    });

    return this.issueCustomerTokens(customer, ip, ua);
  }

  // ---------------------------------------------------------------------------
  // Refresh — rotating refresh tokens with reuse-detection
  // ---------------------------------------------------------------------------

  async refreshAdmin(dto: RefreshDto, ip?: string, ua?: string): Promise<TokenPair> {
    const hash = hashToken(dto.refreshToken);
    const stored = await this.prisma.refreshToken.findUnique({ where: { tokenHash: hash } });

    if (!stored || !stored.adminUserId) {
      throw new UnauthorizedException('Invalid refresh token');
    }

    // Reuse detection: if this token was already rotated (replacedById is set),
    // it means someone is replaying a stolen token. Revoke the whole chain.
    // We err on the side of session termination — a legitimate user can re-login;
    // a token thief with a rotated token cannot.
    if (stored.replacedById !== null) {
      await this.revokeChain(stored.id);
      throw new ForbiddenException('Refresh token reuse detected — all sessions revoked');
    }

    if (stored.revokedAt || stored.expiresAt < new Date()) {
      throw new UnauthorizedException('Refresh token expired or revoked');
    }

    const user = await this.prisma.adminUser.findUnique({
      where: { id: stored.adminUserId },
    });
    if (!user || !user.isActive) throw new UnauthorizedException('Account inactive');

    // Rotate: revoke old, issue new
    const newTokenPair = await this.issueAdminTokens(user, ip, ua);
    const newHash = hashToken(newTokenPair.refreshToken);
    const newStored = await this.prisma.refreshToken.findUnique({ where: { tokenHash: newHash } });

    await this.prisma.refreshToken.update({
      where: { id: stored.id },
      data: { replacedById: newStored?.id, revokedAt: new Date() },
    });

    return newTokenPair;
  }

  async refreshCustomer(dto: RefreshDto, ip?: string, ua?: string): Promise<TokenPair> {
    const hash = hashToken(dto.refreshToken);
    const stored = await this.prisma.refreshToken.findUnique({ where: { tokenHash: hash } });

    if (!stored || !stored.customerId) {
      throw new UnauthorizedException('Invalid refresh token');
    }

    if (stored.replacedById !== null) {
      await this.revokeChain(stored.id);
      throw new ForbiddenException('Refresh token reuse detected — all sessions revoked');
    }

    if (stored.revokedAt || stored.expiresAt < new Date()) {
      throw new UnauthorizedException('Refresh token expired or revoked');
    }

    const customer = await this.prisma.customer.findUnique({ where: { id: stored.customerId } });
    if (!customer || !customer.isActive) throw new UnauthorizedException('Account inactive');

    const newTokenPair = await this.issueCustomerTokens(customer, ip, ua);
    const newHash = hashToken(newTokenPair.refreshToken);
    const newStored = await this.prisma.refreshToken.findUnique({ where: { tokenHash: newHash } });

    await this.prisma.refreshToken.update({
      where: { id: stored.id },
      data: { replacedById: newStored?.id, revokedAt: new Date() },
    });

    return newTokenPair;
  }

  // ---------------------------------------------------------------------------
  // Logout — revoke a single refresh token
  // ---------------------------------------------------------------------------

  async logout(refreshToken: string): Promise<void> {
    const hash = hashToken(refreshToken);
    await this.prisma.refreshToken.updateMany({
      where: { tokenHash: hash, revokedAt: null },
      data: { revokedAt: new Date() },
    });
  }

  // ---------------------------------------------------------------------------
  // Customer invite & activation
  // ---------------------------------------------------------------------------

  async activateCustomer(token: string, password: string): Promise<void> {
    // The invitation token is a signed JWT carrying customerId; verify it here
    let payload: { sub: string; aud: string };
    try {
      payload = this.jwt.verify(token, {
        secret: process.env.JWT_CUSTOMER_SECRET,
        audience: 'karrkarr:invite',
      }) as { sub: string; aud: string };
    } catch {
      throw new UnauthorizedException('Invalid or expired invitation link');
    }

    const customer = await this.prisma.customer.findUnique({ where: { id: payload.sub } });
    if (!customer || customer.activatedAt) {
      throw new ConflictException('Account already activated or not found');
    }

    const hash = await bcrypt.hash(password, BCRYPT_ROUNDS);
    await this.prisma.customer.update({
      where: { id: customer.id },
      data: { passwordHash: hash, activatedAt: new Date(), isActive: true },
    });
  }

  /** Generate an invite token (JWT, short-lived, invite audience). */
  generateInviteToken(customerId: string): string {
    return this.jwt.sign(
      { sub: customerId },
      {
        secret: process.env.JWT_CUSTOMER_SECRET,
        audience: 'karrkarr:invite',
        expiresIn: '7d',
      },
    );
  }

  async hashPassword(plain: string): Promise<string> {
    return bcrypt.hash(plain, BCRYPT_ROUNDS);
  }

  // ---------------------------------------------------------------------------
  // Internal helpers
  // ---------------------------------------------------------------------------

  private async issueAdminTokens(
    user: AdminUser,
    ip?: string,
    ua?: string,
  ): Promise<TokenPair> {
    const permissions = ROLE_PERMISSIONS[user.role] ?? [];

    const accessToken = this.jwt.sign(
      {
        sub: user.id,
        email: user.email,
        role: user.role,
        branchId: user.branchId,
        permissions,
        aud: ADMIN_JWT_AUDIENCE,
      },
      {
        secret: process.env.JWT_ADMIN_SECRET,
        expiresIn: ACCESS_TTL_SECONDS,
      },
    );

    const rawRefresh = crypto.randomBytes(64).toString('hex');
    const hash = hashToken(rawRefresh);
    const expiresAt = new Date();
    expiresAt.setDate(expiresAt.getDate() + REFRESH_TTL_DAYS);

    await this.prisma.refreshToken.create({
      data: { tokenHash: hash, adminUserId: user.id, expiresAt, ipAddress: ip, userAgent: ua },
    });

    return { accessToken, refreshToken: rawRefresh, expiresIn: ACCESS_TTL_SECONDS };
  }

  private async issueCustomerTokens(
    customer: Customer,
    ip?: string,
    ua?: string,
  ): Promise<TokenPair> {
    const accessToken = this.jwt.sign(
      {
        sub: customer.id,
        email: customer.email,
        customerRef: customer.customerRef,
        branchId: customer.branchId,
        aud: CUSTOMER_JWT_AUDIENCE,
      },
      {
        secret: process.env.JWT_CUSTOMER_SECRET,
        expiresIn: ACCESS_TTL_SECONDS,
      },
    );

    const rawRefresh = crypto.randomBytes(64).toString('hex');
    const hash = hashToken(rawRefresh);
    const expiresAt = new Date();
    expiresAt.setDate(expiresAt.getDate() + REFRESH_TTL_DAYS);

    await this.prisma.refreshToken.create({
      data: { tokenHash: hash, customerId: customer.id, expiresAt, ipAddress: ip, userAgent: ua },
    });

    return { accessToken, refreshToken: rawRefresh, expiresIn: ACCESS_TTL_SECONDS };
  }

  private async assertNotLocked(user: AdminUser): Promise<void> {
    if (user.lockedUntil && user.lockedUntil > new Date()) {
      const seconds = Math.ceil((user.lockedUntil.getTime() - Date.now()) / 1000);
      throw new ForbiddenException(`Account locked. Try again in ${seconds} seconds.`);
    }
  }

  private async assertNotLockedCustomer(customer: Customer): Promise<void> {
    if (customer.lockedUntil && customer.lockedUntil > new Date()) {
      const seconds = Math.ceil((customer.lockedUntil.getTime() - Date.now()) / 1000);
      throw new ForbiddenException(`Account locked. Try again in ${seconds} seconds.`);
    }
  }

  private async recordFailedLogin(type: 'admin' | 'customer', id: string): Promise<void> {
    if (type === 'admin') {
      const user = await this.prisma.adminUser.findUnique({ where: { id } });
      if (!user) return;
      const count = user.failedLoginCount + 1;
      await this.prisma.adminUser.update({
        where: { id },
        data: {
          failedLoginCount: count,
          lockedUntil: count >= MAX_FAILED_LOGINS
            ? new Date(Date.now() + LOCKOUT_MINUTES * 60_000)
            : null,
        },
      });
    } else {
      const c = await this.prisma.customer.findUnique({ where: { id } });
      if (!c) return;
      const count = c.failedLoginCount + 1;
      await this.prisma.customer.update({
        where: { id },
        data: {
          failedLoginCount: count,
          lockedUntil: count >= MAX_FAILED_LOGINS
            ? new Date(Date.now() + LOCKOUT_MINUTES * 60_000)
            : null,
        },
      });
    }
  }

  private async resetFailedLogins(type: 'admin' | 'customer', id: string): Promise<void> {
    if (type === 'admin') {
      await this.prisma.adminUser.update({
        where: { id },
        data: { failedLoginCount: 0, lockedUntil: null },
      });
    } else {
      await this.prisma.customer.update({
        where: { id },
        data: { failedLoginCount: 0, lockedUntil: null },
      });
    }
  }

  /**
   * Walk the replacedById chain upward and revoke every token in it.
   * Called when token reuse is detected — the attacker has a token we already
   * rotated, so both the original legitimate user and the attacker must be
   * logged out. This is the standard "refresh token rotation with family revocation"
   * pattern (RFC best practice for silent refresh).
   */
  private async revokeChain(startId: string): Promise<void> {
    // Find the root of the chain by walking replacedById backwards would be complex.
    // Instead we find the adminUserId / customerId from this token and revoke ALL
    // their tokens — simpler and equally secure.
    const token = await this.prisma.refreshToken.findUnique({ where: { id: startId } });
    if (!token) return;

    if (token.adminUserId) {
      await this.prisma.refreshToken.updateMany({
        where: { adminUserId: token.adminUserId, revokedAt: null },
        data: { revokedAt: new Date() },
      });
    } else if (token.customerId) {
      await this.prisma.refreshToken.updateMany({
        where: { customerId: token.customerId, revokedAt: null },
        data: { revokedAt: new Date() },
      });
    }
  }
}

/** SHA-256 hash of a raw refresh token. We store the hash, never the token. */
function hashToken(token: string): string {
  return crypto.createHash('sha256').update(token).digest('hex');
}

// Export for use in guards that need to check branch scoping
export { isBranchScoped };
