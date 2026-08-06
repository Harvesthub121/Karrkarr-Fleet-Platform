import { Injectable, OnModuleInit, OnModuleDestroy, Logger } from '@nestjs/common';
import { PrismaClient } from '@prisma/client';
import { RequestContext } from '../common/request-context/request-context';

// ---------------------------------------------------------------------------
// PrismaService
//
// Singleton wrapper around PrismaClient with:
//   1. Lifecycle hooks (onModuleInit / onModuleDestroy) for graceful startup/
//      shutdown — critical for K8s SIGTERM handling.
//   2. A query middleware that injects `branchId` into every `findMany`,
//      `findFirst`, `findFirstOrThrow`, `aggregate`, and `count` operation
//      when the active RequestContext carries a `scopedBranchId`.
//
// WHY middleware instead of a $extends query extension?
//   PrismaClient.$extends produces a new type that is not assignable to
//   PrismaClient, breaking the injection token in tests. Middleware achieves
//   the same result without the type incompatibility, at a small runtime cost
//   (an extra `params` copy per query). Accept the tradeoff: tenancy safety is
//   more important than microseconds on the ORM layer.
//
// HOW branch scoping works:
//   - RequestContextMiddleware reads the JWT `branchId` claim and stores it in
//     AsyncLocalStorage via RequestContext.run().
//   - PrismaMiddleware reads `RequestContext.current()?.scopedBranchId`.
//   - If a scoped branchId is present AND the model has a `branchId` column
//     (checked via a static set), the middleware injects `where.branchId`.
//   - SUPER_ADMIN users and head-office OPERATIONS/ACCOUNTS users have
//     branchId === null, so `scopedBranchId` is never set and no filter fires.
//   - The middleware is a SAFETY NET, not a replacement for explicit queries.
//     Every controller should still pass branchId from the authenticated user.
// ---------------------------------------------------------------------------

/**
 * Models that carry a `branchId` column and should therefore be filtered when
 * the caller is branch-scoped. This list must be kept in sync with the schema.
 * It is intentionally a Set<string> (model names as strings) rather than a
 * typed union so it does not need updating when Prisma regenerates its types.
 */
const BRANCH_SCOPED_MODELS = new Set([
  'Vehicle',
  'Customer',
  'RentalAgreement',
  'Invoice',
  'PolicySetting',
  'Notification',
]);

@Injectable()
export class PrismaService extends PrismaClient implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(PrismaService.name);

  constructor() {
    super({
      log: [
        { emit: 'event', level: 'query' },
        { emit: 'event', level: 'error' },
        { emit: 'event', level: 'warn' },
      ],
    });

    this.installBranchScopingMiddleware();
  }

  async onModuleInit(): Promise<void> {
    await this.$connect();
    this.logger.log('Prisma connected');
  }

  async onModuleDestroy(): Promise<void> {
    await this.$disconnect();
    this.logger.log('Prisma disconnected');
  }

  // ---------------------------------------------------------------------------
  // Branch-scoping middleware
  // ---------------------------------------------------------------------------

  private installBranchScopingMiddleware(): void {
    // We only intercept read-path operations. Writes are the controller's
    // responsibility — the guard on the route already ensures branch isolation.
    const readActions = new Set([
      'findMany',
      'findFirst',
      'findFirstOrThrow',
      'aggregate',
      'count',
      'groupBy',
    ]);

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    this.$use(async (params: any, next: (params: any) => Promise<any>) => {
      const ctx = RequestContext.current();
      const scopedBranchId = ctx?.scopedBranchId;

      if (
        scopedBranchId &&
        params.model &&
        BRANCH_SCOPED_MODELS.has(params.model) &&
        readActions.has(params.action)
      ) {
        // Merge rather than overwrite: if the caller already passed `branchId`
        // in the where clause, the injected filter is redundant but harmless.
        // Using `AND` means both conditions must pass.
        params.args ??= {};
        params.args.where = {
          AND: [
            params.args.where ?? {},
            { branchId: scopedBranchId },
          ],
        };
      }

      return next(params);
    });
  }
}
