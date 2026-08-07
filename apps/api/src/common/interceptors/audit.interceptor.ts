import {
  CallHandler,
  ExecutionContext,
  Injectable,
  NestInterceptor,
} from '@nestjs/common';
import { Observable, tap } from 'rxjs';
import { Request } from 'express';
import { PrismaService } from '../../prisma/prisma.service';
import { RequestContext } from '../request-context/request-context';

/**
 * Audit interceptor — writes an AuditLog row for every mutating HTTP request
 * (POST, PUT, PATCH, DELETE) that completes without throwing.
 *
 * Design decisions:
 *   - We write AFTER the handler succeeds (tap on the response stream) so we
 *     never log an operation that was rolled back.
 *   - Sensitive fields are redacted before persistence. We never store raw
 *     passwords, NRIC, or the refresh token itself — only a "[REDACTED]"
 *     placeholder. The list is conservative: when in doubt, redact.
 *   - `before` / `after` are left null here because interceptors don't
 *     have access to the DB row. Services that need before/after diffs
 *     call PrismaService directly inside their transaction and write their own
 *     AuditLog entry with the diff. This interceptor is the safety net for
 *     cases where a service author forgets.
 */

const MUTATING_METHODS = new Set(['POST', 'PUT', 'PATCH', 'DELETE']);

/** Fields that must never appear in audit storage, even as part of a DTO. */
const REDACTED_KEYS = new Set([
  'password',
  'passwordHash',
  'passwordConfirm',
  'nric',
  'mfaSecret',
  'tokenHash',
  'refreshToken',
  'accessToken',
]);

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function redact(obj: unknown): unknown {
  if (obj === null || obj === undefined) return obj;
  if (typeof obj !== 'object') return obj;
  if (Array.isArray(obj)) return obj.map(redact);

  const result: Record<string, unknown> = {};
  for (const [k, v] of Object.entries(obj as Record<string, unknown>)) {
    result[k] = REDACTED_KEYS.has(k) ? '[REDACTED]' : redact(v);
  }
  return result;
}

@Injectable()
export class AuditInterceptor implements NestInterceptor {
  // PrismaService is not injected here because this interceptor is registered
  // as a global interceptor in main.ts (outside the DI container). Instead,
  // the interceptor needs access to Prisma. We work around this by making
  // AuditInterceptor a provider in AppModule and letting NestJS wire it.
  // For the global registration we retrieve it from the app instance in main.ts.
  // This is a chicken-and-egg: we register it globally but need DI.
  //
  // Resolution: AuditInterceptor IS registered via app.useGlobalInterceptors()
  // in main.ts using app.get(AuditInterceptor). It therefore participates in DI.
  constructor(private readonly prisma: PrismaService) {}

  intercept(context: ExecutionContext, next: CallHandler): Observable<unknown> {
    const req = context.switchToHttp().getRequest<Request>();

    if (!MUTATING_METHODS.has(req.method)) {
      return next.handle();
    }

    const ctx = RequestContext.current();

    // Capture the request body snapshot before the handler modifies it.
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const bodySnapshot = redact(req.body as unknown) as any;

    return next.handle().pipe(
      tap({
        next: () => {
          // Fire-and-forget: audit failures must not break the primary flow
          void this.writeAuditLog(req, ctx, bodySnapshot);
        },
      }),
    );
  }

  private async writeAuditLog(
    req: Request,
    ctx: ReturnType<typeof RequestContext.current>,
    body: unknown,
  ): Promise<void> {
    try {
      // Derive entity type and id from the URL: /api/vehicles/abc123 → Vehicle / abc123
      const segments = req.path.replace(/^\/+/, '').split('/');
      const entityType = segments[1] ?? segments[0] ?? 'unknown';
      const entityId = segments[2] ?? 'unknown';

      await this.prisma.auditLog.create({
        data: {
          actorAdminId: ctx?.adminUserId ?? null,
          actorCustomerId: ctx?.customerId ?? null,
          actorType: ctx?.adminUserId ? 'ADMIN' : ctx?.customerId ? 'CUSTOMER' : 'SYSTEM',
          action: `${req.method.toLowerCase()}.${entityType}`,
          entityType,
          entityId,
          after: body as unknown as Record<string, unknown>,
          ipAddress: ctx?.ipAddress,
          userAgent: ctx?.userAgent,
        },
      });
    } catch {
      // Audit log failures are non-fatal; emit to stderr for alerting
      console.error('[AuditInterceptor] Failed to write audit log');
    }
  }
}
