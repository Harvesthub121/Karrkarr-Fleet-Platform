# Architecture

## System Diagram

```
┌─────────────────────────────────────────────────────────────────────┐
│  Client tier                                                         │
│                                                                      │
│  ┌──────────────────┐         ┌───────────────────────┐             │
│  │  Admin Dashboard  │         │   Customer Portal      │            │
│  │  Next.js (:3001)  │         │   Next.js (:3002)      │            │
│  └────────┬─────────┘         └───────────┬───────────┘             │
└───────────┼───────────────────────────────┼─────────────────────────┘
            │ HTTPS / REST                  │ HTTPS / REST
            ▼                               ▼
┌─────────────────────────────────────────────────────────────────────┐
│  API tier  (NestJS, port 3000)                                       │
│                                                                      │
│  ┌───────────┐  ┌──────────┐  ┌──────────────┐  ┌──────────────┐   │
│  │  Auth     │  │  Fleet   │  │   Billing    │  │  Payments    │   │
│  │  (JWT)    │  │ Vehicles │  │   Invoices   │  │  PayNow QR   │   │
│  │  Guards   │  │ Rentals  │  │   Ledger     │  │  Submissions │   │
│  └───────────┘  └──────────┘  └──────────────┘  └──────────────┘   │
│                                                                      │
│  ┌───────────┐  ┌──────────┐  ┌──────────────┐  ┌──────────────┐   │
│  │Collections│  │Documents │  │ Notifications│  │   Reports    │   │
│  │ Risk Score│  │ S3 Proxy │  │ Channel Abs. │  │ CSV/XLSX/PDF │   │
│  └───────────┘  └──────────┘  └──────────────┘  └──────────────┘   │
│                                                                      │
│  ┌───────────────────────────────────────────────────────────────┐  │
│  │  Jobs (BullMQ workers — separate ECS service in prod)         │  │
│  │  invoice-generation · interest-accrual · payment-reminder     │  │
│  │  expiry-reminder · rental-status · risk-scoring               │  │
│  └───────────────────────────────────────────────────────────────┘  │
└──────────────────────────┬──────────────────────────────────────────┘
                           │
          ┌────────────────┼────────────────┐
          ▼                ▼                ▼
  ┌──────────────┐  ┌──────────┐   ┌──────────────┐
  │  PostgreSQL  │  │  Redis   │   │  S3 / MinIO  │
  │  (Prisma)    │  │ (BullMQ) │   │  (documents) │
  └──────────────┘  └──────────┘   └──────────────┘
                                          │
                                   ┌──────────────┐
                                   │  Resend API  │
                                   │  (email out) │
                                   └──────────────┘
```

## Request Lifecycle

1. Request arrives at NestJS. `RequestContextMiddleware` attaches a correlation ID and the raw `branchId` claim from the JWT if present.
2. `AdminJwtGuard` or `CustomerJwtGuard` validates the access token against the appropriate secret and audience (`vida:admin` or `vida:customer`). Expired tokens are rejected with 401.
3. `PermissionsGuard` reads the `@RequirePermissions()` decorator on the handler and checks `ROLE_PERMISSIONS[role]` from `packages/shared/src/rbac.ts`. Rejected with 403.
4. For branch-scoped roles, `CustomerScopeGuard` (customers) or the PrismaService middleware verifies the requested resource belongs to the caller's branch.
5. The handler executes. Money-moving handlers call services that write to `LedgerEntry` and update denormalised caches in a single Prisma transaction.
6. `AuditInterceptor` fires after the handler returns and writes an `AuditLog` row for every mutating request (POST/PATCH/DELETE). NRIC and other PII fields are stripped from the before/after diff before persisting.
7. `MoneySerializerInterceptor` converts `BigInt` fields to strings in the JSON response (JSON.stringify cannot handle BigInt natively).
8. `GlobalExceptionFilter` catches unhandled errors and returns structured error objects with correlation IDs.

## The Ledger-First Money Model

Every SGD movement is a row in `LedgerEntry`. The table is **append-only**: rows are never updated or deleted. A mistake is corrected by writing a compensating entry, exactly like a double-entry journal.

```
LedgerEntry
├── amountCents   (+) increases what customer owes; (−) decreases it
├── balanceAfterCents   running balance at the time of this entry
├── type          RENTAL_CHARGE | LATE_INTEREST | PAYMENT_RECEIVED | ...
├── idempotencyKey  unique — prevents double-writes on job retry
└── effectiveDate   business date (may differ from createdAt for backdated entries)
```

**Why balances are derived, not stored:**

`Invoice.outstandingCents` and `RentalAgreement.depositBalanceCents` exist only as denormalised caches. They are maintained inside the same database transaction as the ledger write. If they ever disagree with the ledger, the ledger wins and the cache is rebuilt.

The alternative — storing a single running balance — creates a race condition if two payments arrive simultaneously and both read the same prior balance before either commits. With an append-only ledger and optimistic-locking caches, both payments write independent rows and the final balance is always consistent.

**Sign convention:**
- Positive amount = customer owes more (charges, interest, accident excess)
- Negative amount = customer owes less (payments received, credits, write-offs)

## Branch Multi-Tenancy

`Branch` is the tenancy boundary. Nearly every operational model carries a `branchId` column.

PrismaService extends PrismaClient and installs a query middleware that appends `AND "branchId" = $branchId` to all `findMany`, `findFirst`, and `count` operations when a branch-scoped role is active in the request context. This means a forgotten `where` clause on a controller cannot leak cross-branch data — the middleware closes the gap.

SUPER_ADMIN and head-office roles with `branchId = null` on their AdminUser record bypass the filter and see all branches. BRANCH_MANAGER roles have `branchId` set and are hard-scoped.

## Auth Model

### Dual-Audience JWT

Admin and customer tokens are issued with separate JWT secrets and separate `aud` claims (`vida:admin`, `vida:customer`). `AdminJwtGuard` rejects customer tokens and vice versa. The strategies live in:
- `modules/auth/strategies/admin-jwt.strategy.ts`
- `modules/auth/strategies/customer-jwt.strategy.ts`

Access tokens are short-lived (default 15 minutes, configurable via `JWT_ACCESS_TTL_SECONDS`).

### Rotating Refresh Tokens with Reuse Detection

On each successful login, a refresh token is issued. The raw token is never stored — only its SHA-256 hash is persisted in `RefreshToken.tokenHash`.

On refresh:
1. The presented token is hashed and looked up.
2. If found and not revoked, a new refresh token is issued, the old one is marked `revokedAt = now()`, and `replacedById` is set to the new token's ID, forming a chain.
3. If the presented token was already revoked (it was rotated previously), this indicates token theft. The entire chain anchored at that token is revoked immediately.

Refresh tokens expire after `JWT_REFRESH_TTL_DAYS` (default 30 days). `expiresAt` is indexed so expired rows can be purged by a maintenance job.

### Account Lockout

`AdminUser.failedLoginCount` increments on each failed attempt. At 5 consecutive failures, `lockedUntil` is set to `now() + 15 minutes`. The lockout doubles on subsequent failures. After a successful login, the counter resets.

Customers have the same mechanism on their `Customer` record.

## Job / Queue Design

Six BullMQ queues, backed by Redis:

| Queue                | Cron schedule (SGT) | What it does                                              |
|----------------------|---------------------|-----------------------------------------------------------|
| `invoice-generation` | 01:00 daily         | Creates invoices `INVOICE_LEAD_DAYS` ahead of due date    |
| `interest-accrual`   | 02:00 daily         | Accrues daily interest on all OVERDUE invoices            |
| `payment-reminder`   | 09:00 daily         | Sends pre-due and overdue reminder notifications          |
| `rental-status`      | 03:00 daily         | Flips rentals to ENDING_SOON, marks expired as needing review |
| `expiry-reminder`    | 08:00 daily         | Sends compliance expiry alerts (road tax, insurance, COE, inspection) |
| `risk-scoring`       | 04:00 daily         | Recomputes customer risk scores 0–100                     |

**Why every job is idempotent:**

Each job processor checks or sets an `idempotencyKey` before writing. For interest accrual, the key is `interest:{invoiceId}:{date}` — a UNIQUE constraint in PostgreSQL means a duplicate write raises a conflict, which the processor catches and ignores. For reminders, `ReminderLog` has a unique constraint on `(invoiceId, reminderCode, channel)`.

This design means that if a job crashes mid-sweep and restarts, it continues from where it stopped without double-charging any customer. It also means the manual trigger endpoints in `admin/jobs/trigger/*` are safe to call during incident response.

Workers are deployed as a **separate ECS Fargate service** from the web API. They must not auto-scale with HTTP traffic, and their task definition has no inbound port — there is nothing to load-balance. See `docs/DEPLOYMENT.md`.

## Notification Channel Abstraction

All notification dispatch goes through `NotificationService.send()`, which looks up the target channel and calls the appropriate adapter.

```typescript
interface NotificationChannelAdapter {
  send(payload: NotificationPayload): Promise<NotificationResult>;
}
```

Five adapters implement this interface:

| Adapter       | Status in this build                              |
|---------------|---------------------------------------------------|
| EmailAdapter  | Live — uses Resend. Requires `RESEND_API_KEY`.    |
| InAppAdapter  | Live — writes to the `Notification` table.        |
| SmsAdapter    | Seam — logs payload, returns stub success.        |
| WhatsAppAdapter | Seam — logs payload, returns stub success.      |
| PushAdapter   | Seam — logs payload, returns stub success.        |

Wiring a real SMS or WhatsApp provider means implementing `send()` in the relevant adapter file. Nothing else changes. See `docs/EXTENSIONS.md` for provider recommendations.

All sent notifications are persisted to the `Notification` table regardless of channel, enabling the in-app notification bell and providing a dispatch audit trail.
