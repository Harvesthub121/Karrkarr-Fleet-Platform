import { AsyncLocalStorage } from 'async_hooks';

export interface RequestContextData {
  /**
   * Branch ID to inject into Prisma queries for branch-scoped roles.
   * NULL means the caller is allowed to see all branches (SUPER_ADMIN or
   * head-office users). Set by RequestContextMiddleware after JWT validation.
   */
  scopedBranchId: string | null;

  /** Admin user ID if the request comes from an admin JWT. */
  adminUserId?: string;

  /** Customer ID if the request comes from a customer JWT. */
  customerId?: string;

  /** Original HTTP method (GET, POST, …). Used by AuditInterceptor. */
  method?: string;

  /** Parsed IP address for audit logging. */
  ipAddress?: string;

  /** Raw User-Agent string for audit logging. */
  userAgent?: string;
}

// One ALS per process; shared by all requests in flight simultaneously.
const storage = new AsyncLocalStorage<RequestContextData>();

export class RequestContext {
  /** Returns the current request context, or undefined outside a request. */
  static current(): RequestContextData | undefined {
    return storage.getStore();
  }

  /**
   * Run `callback` inside a new context carrying `data`. Called by the
   * middleware once per incoming HTTP request.
   */
  static run<T>(data: RequestContextData, callback: () => T): T {
    return storage.run(data, callback);
  }
}
