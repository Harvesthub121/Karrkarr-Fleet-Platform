import { Injectable, NestMiddleware } from '@nestjs/common';
import { Request, Response, NextFunction } from 'express';
import { RequestContext } from './request-context';

/**
 * Installed globally in AppModule.configure() (see app.module.ts comment —
 * NestMiddleware is applied at the NestApplication level in main.ts or via
 * MiddlewareConsumer). This middleware bridges the Express request into the
 * AsyncLocalStorage so PrismaService's branch-scoping middleware can read
 * `scopedBranchId` without needing the Express request object.
 *
 * NOTE: The JWT guards run AFTER middleware, so `scopedBranchId` is populated
 * here with whatever the guard later injects via `RequestContext.current()`.
 * We therefore initialise with safe defaults and let the auth guard call
 * `RequestContext.current()!.scopedBranchId = user.branchId` after validating
 * the token. That is safe because the ALS store is a mutable plain object.
 */
@Injectable()
export class RequestContextMiddleware implements NestMiddleware {
  use(req: Request, _res: Response, next: NextFunction): void {
    const ip =
      (req.headers['x-forwarded-for'] as string | undefined)?.split(',')[0]?.trim() ??
      req.socket.remoteAddress ??
      '';

    RequestContext.run(
      {
        // Starts as null — populated by JwtAuthGuard.canActivate() after token validation.
        scopedBranchId: null,
        method: req.method,
        ipAddress: ip,
        userAgent: req.headers['user-agent'],
      },
      next,
    );
  }
}
