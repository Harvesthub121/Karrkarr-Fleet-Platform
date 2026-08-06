# Security

## RBAC Matrix

Permissions are checked at the guard level, not via `if (role === '...')` conditionals in service code. Adding a new role later requires only a change to `packages/shared/src/rbac.ts`.

| Permission            | SUPER_ADMIN | OPERATIONS | ACCOUNTS | BRANCH_MANAGER | VIEWER |
|-----------------------|:-----------:|:----------:|:--------:|:--------------:|:------:|
| vehicle.read          | Y           | Y          | Y        | Y              | Y      |
| vehicle.create        | Y           | Y          |          | Y              |        |
| vehicle.update        | Y           | Y          |          | Y              |        |
| vehicle.delete        | Y           | Y          |          | Y              |        |
| vehicle.status_change | Y           | Y          |          | Y              |        |
| maintenance.read      | Y           | Y          |          | Y              | Y      |
| maintenance.write     | Y           | Y          |          | Y              |        |
| customer.read         | Y           | Y          | Y        | Y              | Y      |
| customer.write        | Y           | Y          |          | Y              |        |
| customer.pii_read     | Y           |            | Y        | Y              |        |
| rental.read           | Y           | Y          | Y        | Y              | Y      |
| rental.write          | Y           | Y          |          | Y              |        |
| rental.terminate      | Y           |            |          | Y              |        |
| invoice.read          | Y           | Y          | Y        | Y              | Y      |
| invoice.create        | Y           |            | Y        | Y              |        |
| invoice.cancel        | Y           |            | Y        | Y              |        |
| invoice.write_off     | Y           |            | Y        | Y              |        |
| payment.verify        | Y           |            | Y        | Y              |        |
| payment.record        | Y           |            | Y        | Y              |        |
| interest.waive        | Y           |            | Y        | Y              |        |
| ledger.read           | Y           |            | Y        | Y              | Y      |
| collections.read      | Y           |            | Y        | Y              | Y      |
| collections.action    | Y           |            | Y        | Y              |        |
| report.read           | Y           | Y          | Y        | Y              | Y      |
| report.export         | Y           |            | Y        | Y              |        |
| user.manage           | Y           |            |          |                |        |
| branch.manage         | Y           |            |          |                |        |
| policy.manage         | Y           |            |          |                |        |
| audit.read            | Y           |            |          |                |        |

**Key separations of duty:**
- OPERATIONS cannot approve money (no `payment.verify`, `invoice.cancel`, `interest.waive`).
- ACCOUNTS cannot mutate fleet or create rentals (no `vehicle.create/update`, `rental.write`).
- VIEWER has no `report.export` — bulk PII cannot be extracted by read-only accounts.
- `customer.pii_read` (unmasked NRIC / licence) is restricted to SUPER_ADMIN, ACCOUNTS, BRANCH_MANAGER.

BRANCH_MANAGER gets the union of OPERATIONS + ACCOUNTS permissions plus `rental.terminate`, but is hard-scoped to their own branch by the PrismaService middleware.

---

## Customer Data Isolation

Every operational model (Vehicle, RentalAgreement, Invoice, Customer, Document, etc.) carries a `branchId` column. PrismaService installs a Prisma middleware that injects a `branchId` filter on all query operations when the request context carries a branch-scoped role.

For customers authenticating on the customer portal, `CustomerScopeGuard` verifies that any resource ID in the URL belongs to the authenticated customer. A customer cannot read another customer's invoices, documents, or ledger by guessing IDs.

Customer IDs are CUIDs (collision-resistant, non-sequential), not sequential integers. Enumerating records by incrementing an ID is not possible.

---

## PDPA Considerations

Karrkarr holds the following personal data subject to the Singapore Personal Data Protection Act 2012:

| Data              | Where stored                   | Access control                        |
|-------------------|--------------------------------|---------------------------------------|
| Full name         | Customer.fullName              | All staff roles                       |
| Email address     | Customer.email                 | All staff roles                       |
| Phone number      | Customer.phone                 | All staff roles                       |
| NRIC              | Customer.nric                  | SUPER_ADMIN, ACCOUNTS, BRANCH_MANAGER only (`customer.pii_read`) |
| Driving licence   | Customer.licenceNumber         | SUPER_ADMIN, ACCOUNTS, BRANCH_MANAGER only |
| Home address      | Customer.address               | SUPER_ADMIN, ACCOUNTS, BRANCH_MANAGER only |
| Identity documents (scanned) | S3 bucket / Document table | Presigned URL — all staff who can view documents |
| IP address / user agent | RefreshToken, AuditLog  | SUPER_ADMIN (audit.read) only         |

**NRIC masking:** The API always masks NRIC in responses (e.g. `S****567A`) unless the caller holds `customer.pii_read`. This masking is applied in the service layer, not the controller, so it applies to all code paths including reports.

**Audit trail:** Every mutating request writes an `AuditLog` row. The before/after diff is redacted of NRIC and other sensitive fields before persistence. This supports the PDPA obligation to be able to account for how personal data was accessed and modified.

**Data retention:** The PDPA requires that personal data is not retained longer than necessary. This system does not implement automated retention/purge schedules. Karrkarr should define a retention policy (e.g. 7 years for financial records, 2 years for inactive customer records) and either implement a purge job or handle deletion manually.

**Access requests (DSAR):** If a customer requests access to or erasure of their data, this must be handled manually by SUPER_ADMIN. The system does not have a self-service DSAR workflow.

**Data localisation:** The system is deployed in AWS `ap-southeast-1` (Singapore). All customer personal data remains in Singapore. This should be confirmed in any Data Protection Impact Assessment.

---

## Secrets Management

In production (AWS), all secrets are stored in AWS Secrets Manager and injected as environment variables by ECS at container start. No secrets are committed to the repository.

| Secret                    | Secrets Manager path                    |
|---------------------------|-----------------------------------------|
| DATABASE_URL              | karrkarr-fleet/prod/DATABASE_URL            |
| JWT_ADMIN_SECRET          | karrkarr-fleet/prod/JWT_ADMIN_SECRET        |
| JWT_CUSTOMER_SECRET       | karrkarr-fleet/prod/JWT_CUSTOMER_SECRET     |
| AWS_ACCESS_KEY_ID/SECRET  | Not needed in ECS — use IAM task roles  |
| RESEND_API_KEY            | karrkarr-fleet/prod/RESEND_API_KEY          |
| REDIS_URL                 | karrkarr-fleet/prod/REDIS_URL               |

The API task and worker task use separate IAM task roles with least-privilege policies. The API task role needs S3 read/write on the documents bucket and Secrets Manager read. The worker task role needs the same minus S3 write (workers do not upload documents).

---

## S3 Presigned URL Policy

All documents in S3 are private. There are no public bucket objects or public ACLs.

**Upload flow:** The client requests a presigned PUT URL from the API (`POST /documents/upload-url`). The API generates a URL valid for a short window (default `S3_PRESIGN_TTL_SECONDS` = 3600 seconds). The client uploads directly to S3 using that URL. The API is never a byte-pipe for document uploads, keeping the API container stateless.

**Download flow:** The API generates a presigned GET URL on demand (`GET /documents/:id/download`). The URL expires after `S3_PRESIGN_TTL_SECONDS`. Download URLs are never cached; a new URL is generated on each request.

**Bucket policy:** The bucket should deny all `s3:GetObject` requests that do not originate from a valid presigned URL. The Terraform in `infra/terraform/s3.tf` configures this. Public access block settings should be enabled on the bucket.

**File type restriction:** The presigned PUT URL request should specify a `ContentType` header. The API should validate that the MIME type is one of the permitted types (PDF, JPEG, PNG) before issuing the URL. This is not currently enforced in the code and is a gap to close before go-live.

---

## Audit Logging

`AuditInterceptor` fires after every POST, PATCH, and DELETE request and writes an `AuditLog` row. It captures:
- Actor (admin user ID or customer ID)
- Action (e.g. `payment.approve`, `vehicle.status_change`)
- Entity type and ID
- Before/after diff (with NRIC and password hash stripped)
- IP address and user agent

Money-moving service calls write additional `AuditLog` entries directly (independent of the HTTP layer) with `actorType = SYSTEM` when driven by background jobs.

Audit logs are immutable in the application layer — no DELETE or UPDATE operations are issued against `AuditLog`. They should also be protected at the database level: the application database user should not have DELETE privilege on the `AuditLog` table.

---

## Password and Lockout Policy

| Control                              | Value                                    |
|--------------------------------------|------------------------------------------|
| Password hashing                     | bcrypt, cost factor 10                   |
| Minimum password length              | Not currently enforced — add DTO validation |
| Failed login lockout threshold       | 5 consecutive failures                   |
| Lockout duration                     | 15 minutes (doubles on repeat)           |
| Lockout field                        | AdminUser.lockedUntil / Customer.lockedUntil |
| MFA support                          | TOTP schema exists (mfaSecret, mfaEnabled); enforcement not implemented |

**Gap:** Minimum password complexity (length, character classes) is not currently validated in the DTO layer. Add `@MinLength(12)` and a regex validator to `AdminLoginDto` and `ActivateDto` before go-live.

**Gap:** MFA schema is present but the TOTP verification flow is not implemented. For an admin dashboard holding financial data and personal data, MFA should be enforced at least for SUPER_ADMIN accounts before go-live.

---

## Pre-Go-Live Security Checklist

- [ ] Rotate all seed credentials. The seed password `Karrkarr@2026!` must not exist in production.
- [ ] Set `JWT_ADMIN_SECRET` and `JWT_CUSTOMER_SECRET` to cryptographically random values of at least 64 characters (e.g. `openssl rand -hex 64`). Store in Secrets Manager.
- [ ] Confirm S3 bucket has public access block enabled and no public bucket policy.
- [ ] Add MIME type validation to presigned PUT URL endpoint.
- [ ] Add password complexity validation to auth DTOs (minimum 12 characters, mixed case + digit + symbol).
- [ ] Enforce MFA for SUPER_ADMIN accounts (implement TOTP verification).
- [ ] Restrict database user privileges: revoke DELETE on AuditLog and LedgerEntry.
- [ ] Enable RDS encryption at rest and in transit (enforced in Terraform config).
- [ ] Enable CloudTrail in the AWS account for API-level audit.
- [ ] Set CORS_ORIGINS to production frontend domains only, not `*`.
- [ ] Review CSP headers on Next.js frontends.
- [ ] Conduct penetration testing before accepting real customer data. Minimum scope: authentication flows (token theft, privilege escalation), payment submission manipulation, cross-tenant data access, S3 presigned URL abuse.
- [ ] Define and document PDPA data retention periods.
- [ ] Appoint a Data Protection Officer or designate responsibility per PDPA requirements.
- [ ] Configure WAF (AWS WAF) on the ALB for rate limiting and basic OWASP protections.
