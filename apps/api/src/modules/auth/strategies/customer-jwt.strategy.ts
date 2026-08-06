import { Injectable, UnauthorizedException } from '@nestjs/common';
import { PassportStrategy } from '@nestjs/passport';
import { ExtractJwt, Strategy } from 'passport-jwt';
import { PrismaService } from '../../../prisma/prisma.service';
import { RequestContext } from '../../../common/request-context/request-context';

export interface CustomerJwtPayload {
  sub: string;
  email: string;
  customerRef: string;
  branchId: string;
  aud: string;
  iat: number;
  exp: number;
}

export const CUSTOMER_JWT_STRATEGY = 'customer-jwt';

@Injectable()
export class CustomerJwtStrategy extends PassportStrategy(Strategy, CUSTOMER_JWT_STRATEGY) {
  constructor(private readonly prisma: PrismaService) {
    super({
      jwtFromRequest: ExtractJwt.fromAuthHeaderAsBearerToken(),
      ignoreExpiration: false,
      secretOrKey: process.env.JWT_CUSTOMER_SECRET ?? 'fallback-change-me',
      audience: 'vida:customer',
    });
  }

  async validate(payload: CustomerJwtPayload): Promise<CustomerJwtPayload> {
    const customer = await this.prisma.customer.findUnique({
      where: { id: payload.sub },
      select: { id: true, isActive: true, activatedAt: true, branchId: true },
    });

    if (!customer || !customer.isActive || !customer.activatedAt) {
      throw new UnauthorizedException('Customer account inactive or not activated');
    }

    const ctx = RequestContext.current();
    if (ctx) {
      ctx.customerId = payload.sub;
      // Customers are always scoped to their own branch
      ctx.scopedBranchId = customer.branchId;
    }

    return payload;
  }
}
