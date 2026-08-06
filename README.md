# Vida Partners Fleet Leasing Platform

Fleet management system for Vida Partners Pte Ltd, a Singapore car leasing company operating out of three branches (Ubi, Tuas, Woodlands). Manages ~500 vehicles, customer accounts, rental agreements, billing, collections, and fleet compliance.

## Quickstart

```bash
# 1. Install dependencies (requires Node >= 20.11, pnpm 9)
pnpm install

# 2. Start Postgres, Redis, MinIO (local S3 stand-in)
docker compose -f infra/docker-compose.yml up -d

# 3. Run database migrations
pnpm db:migrate

# 4. Seed demo data (3 branches, 5 admin users, 40 vehicles, 25 customers, 12 rentals)
pnpm db:seed

# 5. Start all apps in parallel (API on :3000, admin on :3001, customer portal on :3002)
pnpm dev
```

Or as a single command: `pnpm bootstrap && pnpm dev`

## Demo Login Credentials

All seed passwords are `Vida@2026!`. Change before any external access.

| Role            | Email                              | Scope         |
|-----------------|------------------------------------|---------------|
| SUPER_ADMIN     | super@vidapartners.com.sg          | All branches  |
| OPERATIONS      | ops@vidapartners.com.sg            | Ubi branch    |
| ACCOUNTS        | accounts@vidapartners.com.sg       | All branches  |
| BRANCH_MANAGER  | branch@vidapartners.com.sg         | Ubi branch    |
| VIEWER          | viewer@vidapartners.com.sg         | All branches  |

Customer accounts in the seed do not have passwords set (they are in the pre-activation state). Invite one from the admin dashboard to test the portal flow.

## Repo Layout

```
vida-fleet/
├── apps/
│   ├── api/                   NestJS REST API (port 3000)
│   │   ├── prisma/            schema.prisma, seed.ts, migrations/
│   │   └── src/
│   │       ├── common/        pagination, audit interceptor, money serialiser, logger
│   │       ├── modules/
│   │       │   ├── auth/      dual-audience JWT, refresh rotation, account lockout
│   │       │   ├── billing/   invoice creation, interest accrual, ledger writes
│   │       │   ├── branches/  branch CRUD
│   │       │   ├── collections/ ageing dashboard, risk scoring, manual reminders
│   │       │   ├── customers/ customer CRUD, invite flow, NRIC masking
│   │       │   ├── documents/ S3 presigned upload/download
│   │       │   ├── jobs/      BullMQ queues + manual trigger endpoints
│   │       │   ├── maintenance/ service records, accident records
│   │       │   ├── notifications/ channel adapters (email live; SMS/WA/push seams)
│   │       │   ├── payments/  PayNow QR generation, submission flow, admin approval
│   │       │   ├── policy/    versioned business-rule settings
│   │       │   ├── rentals/   agreement lifecycle
│   │       │   ├── reports/   8 report types, CSV/Excel/PDF export
│   │       │   ├── users/     admin user management
│   │       │   └── vehicles/  fleet CRUD, status machine, compliance tracking
│   │       └── prisma/        PrismaService with branch-scoped middleware
│   ├── admin/                 Next.js admin dashboard (port 3001)
│   └── customer/              Next.js customer portal (port 3002)
├── packages/
│   └── shared/src/
│       ├── interest.ts        Pure-function interest engine (unit tested)
│       ├── money.ts           BigInt cents primitives
│       ├── paynow.ts          PayNow QR payload builder (EMVCo/SGQR spec)
│       ├── policy-defaults.ts All configurable business constants
│       ├── rbac.ts            Permission definitions + role maps
│       └── types.ts           Cross-package TypeScript types
├── infra/
│   ├── docker-compose.yml     Postgres 16 + Redis 7 + MinIO for local dev
│   └── terraform/             AWS infrastructure (see docs/DEPLOYMENT.md)
└── docs/
    ├── ARCHITECTURE.md
    ├── BILLING.md
    ├── SECURITY.md
    ├── DEPLOYMENT.md
    ├── EXTENSIONS.md
    └── API.md
```

## Module Map

| Module         | What it owns                                                             |
|----------------|--------------------------------------------------------------------------|
| auth           | Login, token issue/rotation, lockout, customer account activation        |
| vehicles       | Fleet CRUD, 9-state status machine, compliance dates, mileage            |
| rentals        | Agreement lifecycle DRAFT→ACTIVE→COMPLETED/TERMINATED                   |
| billing        | Invoice creation, interest accrual, ledger writes, write-off             |
| payments       | PayNow QR, customer payment submission, admin verify/reject              |
| collections    | Ageing buckets, risk scores, manual reminder trigger                     |
| maintenance    | Service records, accident records, recharge flag                         |
| documents      | S3 presigned upload/download, metadata registry                          |
| notifications  | Channel-abstracted dispatch (email wired; SMS/WA/push are seams)         |
| jobs           | 6 BullMQ queues on cron; manual-trigger endpoints for ops                |
| policy         | Versioned, branch-overridable business rules — no hardcoded constants    |
| reports        | 8 report types with CSV/Excel/PDF export                                 |
| branches       | Branch CRUD (tenancy boundary for all operational data)                  |
| users          | Admin user CRUD, role assignment                                         |

## Key Architectural Decisions

**Money is BigInt cents.** All monetary values are stored as integer cents in PostgreSQL `BIGINT` columns. Floating point never touches a billing path. See `packages/shared/src/money.ts`.

**Balances are derived, not stored.** `LedgerEntry` is the single source of truth. `Invoice.outstandingCents` and `RentalAgreement.depositBalanceCents` are denormalised caches updated in the same database transaction as the ledger write. If they ever disagree with the ledger, the ledger wins. A reconcile command exists: `pnpm --filter @vida/api ledger:reconcile`.

**Branch is the tenancy boundary.** PrismaService installs middleware that injects a `branchId` filter for scoped roles. A forgotten `where` clause cannot leak cross-branch data.

**Interest is simple, on principal, idempotent per day.** Each daily accrual is a separate `LedgerEntry` with a unique `idempotencyKey` of the form `interest:{invoiceId}:{date}`. Re-running the nightly job is a safe no-op.

**Dual-audience JWT.** Admins and customers authenticate against separate secrets with separate audiences. A customer token cannot be presented to an admin endpoint.

**Refresh tokens rotate with reuse detection.** The SHA-256 hash of the refresh token is stored, never the token itself. Each refresh produces a new token and chains via `replacedById`. Presenting a rotated (already-used) token revokes the entire chain — this is the token-theft response.

**Policy settings are versioned and never hardcoded.** Every business number (interest rate, grace period, reminder cadence, COE reminder ladder) lives in `PolicySetting` with an `effectiveFrom` timestamp. Changing a rate does not retroactively rewrite issued invoices.

**Notification adapters are behind an interface.** `NotificationChannelAdapter` is implemented by five adapters. Email (via Resend) is wired. SMS, WhatsApp, push, and in-app adapters have the interface implemented but no live transport — they log and return a stub result. See `docs/EXTENSIONS.md`.

## What Is Production-Ready

- PostgreSQL schema with all indexes and constraints
- Full billing engine: invoice generation, daily interest accrual, payment verification workflow
- PayNow QR generation (EMVCo SGQR spec, CRC-16 verified, dynamic amount + reference)
- JWT auth with refresh rotation and reuse detection
- RBAC with permission-level guards (not role-switch conditionals)
- Branch multi-tenancy enforcement at the ORM middleware layer
- 6 BullMQ background jobs with idempotency keys
- Collections ageing dashboard and risk scoring
- Document storage via S3 presigned URLs
- 8 report types with CSV/Excel/PDF export
- Full audit trail on all mutating requests and money movements
- Seed data covering all invoice statuses and interest scenarios

## What Requires Client Credentials Before Go-Live

| Item                          | Where to configure                                      |
|-------------------------------|---------------------------------------------------------|
| Resend API key + sending domain | `RESEND_API_KEY` env var + DNS verification in Resend  |
| Real PayNow UEN               | `paynow.uen` policy setting (Settings → Policy)         |
| Real bank account details     | `bank.*` policy settings                                |
| AWS account + S3 bucket       | See `docs/DEPLOYMENT.md`                                |
| Production JWT secrets        | AWS Secrets Manager, see `docs/DEPLOYMENT.md`           |
| DNS cutover                   | Client's registrar, see go-live checklist               |
| Customer portal domain        | Vercel/Amplify project settings                         |

Vida Partners is **not GST-registered**. There are no tax lines anywhere in the billing engine. The schema has a `tax.rateBps` policy key set to `0` as a placeholder so GST registration later requires only a settings change and an invoice template update, not a migration.

Deposit refund/disbursement is **out of scope**. Deposits are received and tracked. The end-of-rental refund workflow does not exist. See `docs/EXTENSIONS.md`.

## Verifying the billing logic without installing anything

The money-critical logic (interest accrual, rounding, PayNow CRC, RBAC matrix) has a
dependency-free test harness that runs on Node's built-in test runner:

```bash
./scripts/verify.sh
```

29 tests, no `pnpm install` required. Use this during a security or finance review of the
billing rules — it proves the grace-period boundary, that interest never compounds, that a
partial payment reduces only future accrual, that a re-run writes nothing, and that the
PayNow checksum is a correct CRC-16/CCITT-FALSE.

## Clickable UI preview

`preview/index.html` is a single self-contained file showing the Admin Dashboard (fleet
overview, collections, vehicle dashboard, payment verification, policy settings) and the
Customer Portal (dashboard, payment centre, documents) with the same seed data the API
produces. Open it in any browser — no build step, no server.
