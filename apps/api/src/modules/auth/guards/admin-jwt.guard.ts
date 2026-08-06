import { Injectable } from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';
import { ADMIN_JWT_STRATEGY } from '../strategies/admin-jwt.strategy';

@Injectable()
export class AdminJwtGuard extends AuthGuard(ADMIN_JWT_STRATEGY) {}
