import { Injectable } from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';
import { CUSTOMER_JWT_STRATEGY } from '../strategies/customer-jwt.strategy';

@Injectable()
export class CustomerJwtGuard extends AuthGuard(CUSTOMER_JWT_STRATEGY) {}
