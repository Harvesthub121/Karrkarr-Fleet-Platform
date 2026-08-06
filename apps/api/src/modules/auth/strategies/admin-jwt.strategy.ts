import { Injectable, UnauthorizedException } from '@nestjs/common';
import { PassportStrategy } from '@nestjs/passport';
import { ExtractJwt, Strategy } from 'passport-jwt';
import { PrismaService } from '../../../prisma/prisma.service';
import { RequestContext } from '../../../common/request-context/request-context';
import { isBranchScoped } from '@karrkarr/shared';

export interface AdminJwtPayload {
  sub: string;
  email: string;
  role: string;
  branchId: string | null;
  permissions: string[];
  aud: string;
  iat: number;
  exp: number;
}

export const ADMIN_JWT_STRATEGY = 'admin-jwt';

@Injectable()
export class AdminJwtStrategy extends PassportStrategy(Strategy, ADMIN_JWT_STRATEGY) {
  constructor(private readonly prisma: PrismaService) {
    super({
      jwtFromRequest: ExtractJwt.fromAuthHeaderAsBearerToken(),
      ignoreExpiration: false,
      secretOrKey: process.env.JWT_ADMIN_SECRET ?? 'fallback-change-me',
      audience: 'karrkarr:admin',
    });
  }

  async validate(payload: AdminJwtPayload): Promise<AdminJwtPayload> {
    // Verify the user still exists and is active on every request.
    // This adds one DB query per request but ensures we honour deactivations
    // and role changes immediately rather than waiting for the token to expire.
    const user = await this.prisma.adminUser.findUnique({
      where: { id: payload.sub },
      select: { id: true, isActive: true, role: true, branchId: true },
    });

    if (!user || !user.isActive) {
      throw new UnauthorizedException('Admin account inactive or not found');
    }

    // Populate the AsyncLocalStorage context so PrismaService's branch
    // middleware can filter queries for branch-scoped roles.
    const ctx = RequestContext.current();
    if (ctx) {
      ctx.adminUserId = payload.sub;
      // isBranchScoped returns true when the role + branchId combination means
      // the user should only see their own branch's data.
      ctx.scopedBranchId = isBranchScoped(user.role, user.branchId) ? user.branchId : null;
    }

    return payload;
  }
}
