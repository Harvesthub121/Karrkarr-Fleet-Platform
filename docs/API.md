# API Reference

Base URL: `https://api.vidapartners.com.sg` (production) / `http://localhost:3000` (local)

All admin endpoints require `Authorization: Bearer <admin_access_token>`.
Customer portal endpoints require `Authorization: Bearer <customer_access_token>`.

Tokens are obtained from the auth endpoints below. Access tokens expire after 15 minutes by default. Use the refresh endpoint to obtain a new access token.

---

## Auth

No authentication required for login endpoints.

### Admin

| Method | Path                   | Description                                    |
|--------|------------------------|------------------------------------------------|
| POST   | /auth/admin/login      | Admin login. Returns access + refresh tokens.  |
| POST   | /auth/admin/refresh    | Rotate admin refresh token.                    |
| POST   | /auth/admin/logout     | Revoke admin refresh token. Requires AdminJWT. |

**POST /auth/admin/login** body:
```json
{ "email": "super@vidapartners.com.sg", "password": "Vida@2026!" }
```

Response:
```json
{ "accessToken": "...", "refreshToken": "...", "expiresIn": 900 }
```

### Customer

| Method | Path                      | Description                                        |
|--------|---------------------------|----------------------------------------------------|
| POST   | /auth/customer/login      | Customer portal login.                             |
| POST   | /auth/customer/refresh    | Rotate customer refresh token.                     |
| POST   | /auth/customer/logout     | Revoke customer refresh token. Requires CustomerJWT. |
| POST   | /auth/customer/activate   | Activate an invited customer account (set password). |

**POST /auth/customer/activate** body:
```json
{ "token": "<invite_token_from_email>", "password": "NewPassword123!" }
```

---

## Vehicles

All endpoints require AdminJWT. Permission noted per route.

| Method | Path                         | Permission             | Description                                             |
|--------|------------------------------|------------------------|---------------------------------------------------------|
| GET    | /vehicles                    | vehicle.read           | List vehicles. Query: `branchId`, `status`, `page`, `pageSize` |
| GET    | /vehicles/:id                | vehicle.read           | Vehicle detail                                          |
| GET    | /vehicles/:id/dashboard      | vehicle.read           | Full vehicle dashboard: compliance, current rental, service history, photos |
| GET    | /vehicles/:id/status-history | vehicle.read           | Status transition audit trail                           |
| POST   | /vehicles                    | vehicle.create         | Add vehicle to fleet                                    |
| PATCH  | /vehicles/:id                | vehicle.update         | Update vehicle details                                  |
| PATCH  | /vehicles/:id/status         | vehicle.status_change  | Change vehicle status (validated by status machine)     |
| PATCH  | /vehicles/:id/mileage        | vehicle.update         | Update current mileage                                  |
| DELETE | /vehicles/:id                | vehicle.delete         | Retire vehicle (soft delete)                            |

**Valid status transitions** (enforced by `VehicleStatusMachine`):

```
AVAILABLE   → RESERVED, MAINTENANCE, CLEANING, INSPECTION, INACTIVE
RESERVED    → AVAILABLE, RENTED_OUT, INACTIVE
RENTED_OUT  → CLEANING, ACCIDENT_REPAIR, MAINTENANCE
CLEANING    → AVAILABLE, INSPECTION
INSPECTION  → AVAILABLE, MAINTENANCE
MAINTENANCE → AVAILABLE, CLEANING
ACCIDENT_REPAIR → AVAILABLE, MAINTENANCE
SOLD / INACTIVE → (terminal)
```

---

## Rentals

All endpoints require AdminJWT.

| Method | Path                  | Permission       | Description                                                 |
|--------|-----------------------|------------------|-------------------------------------------------------------|
| GET    | /rentals              | rental.read      | List rental agreements. Query: `branchId`, `status`, `page`, `pageSize` |
| GET    | /rentals/:id          | rental.read      | Rental agreement detail                                     |
| POST   | /rentals              | rental.write     | Create rental agreement (DRAFT state)                       |
| PATCH  | /rentals/:id          | rental.write     | Update rental agreement details                             |
| POST   | /rentals/:id/activate | rental.write     | Activate rental — vehicle moves to RENTED_OUT               |
| POST   | /rentals/:id/return   | rental.write     | Return vehicle — rental COMPLETED, vehicle moves to CLEANING |
| POST   | /rentals/:id/terminate | rental.terminate | Early termination                                          |

**POST /rentals** body example:
```json
{
  "customerId": "...",
  "vehicleId": "...",
  "branchId": "...",
  "startDate": "2026-09-01",
  "endDate": "2027-09-01",
  "billingFrequency": "MONTHLY",
  "billingAnchorDay": 1,
  "rentAmountCents": 200000,
  "depositRequiredCents": 400000
}
```

---

## Customers

All endpoints require AdminJWT.

| Method | Path                  | Permission      | Description                                                  |
|--------|-----------------------|-----------------|--------------------------------------------------------------|
| GET    | /customers            | customer.read   | List customers. NRIC masked unless caller has customer.pii_read |
| GET    | /customers/:id        | customer.read   | Customer detail. NRIC masked unless caller has customer.pii_read |
| POST   | /customers            | customer.write  | Create customer account                                      |
| PATCH  | /customers/:id        | customer.write  | Update customer                                              |
| POST   | /customers/invite     | customer.write  | Send portal invitation email to customer                     |
| DELETE | /customers/:id        | customer.write  | Deactivate customer (soft delete)                            |

---

## Billing

All endpoints require AdminJWT.

| Method | Path                               | Permission      | Description                                        |
|--------|------------------------------------|-----------------|----------------------------------------------------|
| GET    | /billing/invoices                  | invoice.read    | List invoices. Query: `customerId`, `status`, `branchId`, `page`, `pageSize` |
| GET    | /billing/invoices/:id              | invoice.read    | Invoice detail with lines, ledger entries, submissions |
| PATCH  | /billing/invoices/:id/cancel       | invoice.cancel  | Cancel an UPCOMING or DUE invoice                  |
| PATCH  | /billing/invoices/:id/write-off    | invoice.write_off | Write off an overdue invoice balance              |
| POST   | /billing/invoices/:id/interest/waive | interest.waive | Waive interest on an invoice                      |
| GET    | /billing/ledger/:customerId        | ledger.read     | Customer ledger entries (paginated)                |

**PATCH /billing/invoices/:id/cancel** body:
```json
{ "reason": "Customer cancelled early" }
```

**POST /billing/invoices/:id/interest/waive** body:
```json
{ "amountCents": 800, "reason": "Goodwill waiver — first-time late payment" }
```

---

## Payments

| Method | Path                                | Auth         | Permission      | Description                                              |
|--------|-------------------------------------|--------------|-----------------|----------------------------------------------------------|
| GET    | /payments/invoices/:invoiceId/paynow-qr | AdminJWT | invoice.read    | Get PayNow QR data-URI PNG for an invoice                |
| POST   | /payments/submit                    | CustomerJWT  | (own invoices)  | Customer submits payment claim (multipart with optional proof file) |
| GET    | /payments/submissions               | AdminJWT     | payment.verify  | List payment submissions. Query: `status`, `page`, `pageSize` |
| POST   | /payments/submissions/:id/approve   | AdminJWT     | payment.verify  | Approve a payment submission                             |
| POST   | /payments/submissions/:id/reject    | AdminJWT     | payment.verify  | Reject a payment submission                              |
| GET    | /payments/receipts/:id/download     | AdminJWT     | invoice.read    | Download receipt PDF (presigned S3 redirect)             |

**POST /payments/submit** (multipart/form-data):
```
invoiceId: <id>
declaredAmountCents: 80000
transactionRef: DBSS20260806XXXXXXXX
paidOnDate: 2026-08-06
customerNote: Paid via PayNow
method: PAYNOW
proof: <file>
```

**POST /payments/submissions/:id/approve** body:
```json
{ "approvedAmountCents": 80000, "notes": "Confirmed in DBS statement" }
```

---

## Collections

All endpoints require AdminJWT.

| Method | Path                                    | Permission           | Description                                 |
|--------|-----------------------------------------|----------------------|---------------------------------------------|
| GET    | /collections/summary                    | collections.read     | Ageing summary by bucket (UPCOMING, DUE, OVERDUE_1_7, OVERDUE_8_PLUS) |
| GET    | /collections/rows                       | collections.read     | Collections dashboard rows with risk scores |
| GET    | /collections/customers/:customerId/audit-trail | collections.read | Full payment audit trail for a customer   |
| POST   | /collections/invoices/:invoiceId/remind | collections.action   | Trigger manual reminder for an invoice      |

**POST /collections/invoices/:invoiceId/remind** body:
```json
{ "channel": "EMAIL" }
```

---

## Maintenance

All endpoints require AdminJWT.

| Method | Path                              | Permission        | Description                                        |
|--------|-----------------------------------|-------------------|----------------------------------------------------|
| GET    | /maintenance/service-records      | maintenance.read  | List service records. Query: `vehicleId`, pagination |
| GET    | /maintenance/service-records/:id  | maintenance.read  | Get service record                                 |
| POST   | /maintenance/service-records      | maintenance.write | Create service record                              |
| PATCH  | /maintenance/service-records/:id  | maintenance.write | Update service record                              |
| DELETE | /maintenance/service-records/:id  | maintenance.write | Delete service record                              |
| GET    | /maintenance/accident-records     | maintenance.read  | List accident records. Query: `vehicleId`, pagination |
| GET    | /maintenance/accident-records/:id | maintenance.read  | Get accident record                                |
| POST   | /maintenance/accident-records     | maintenance.write | Record accident                                    |
| PATCH  | /maintenance/accident-records/:id | maintenance.write | Update accident record                             |

---

## Documents

All endpoints require AdminJWT.

| Method | Path                    | Permission      | Description                                          |
|--------|-------------------------|-----------------|------------------------------------------------------|
| POST   | /documents/upload-url   | vehicle.update  | Request presigned PUT URL for direct S3 upload       |
| GET    | /documents              | vehicle.read    | List documents. Query: `vehicleId`, `customerId`, `rentalAgreementId` |
| GET    | /documents/:id          | vehicle.read    | Get document metadata                                |
| GET    | /documents/:id/download | vehicle.read    | Get presigned GET URL for download                   |
| POST   | /documents              | vehicle.update  | Register a document after uploading to S3            |
| PATCH  | /documents/:id          | vehicle.update  | Update document metadata                             |
| DELETE | /documents/:id          | vehicle.delete  | Delete document and remove from S3                   |

---

## Reports

All endpoints require AdminJWT. Export formats: `json` (default), `csv`, `excel`, `pdf`. The `csv`, `excel`, and `pdf` formats require `report.export` permission.

| Method | Path                        | Permission   | Description                        |
|--------|-----------------------------|--------------|------------------------------------|
| GET    | /reports/revenue            | report.read  | Revenue report. Query: `from`, `to`, `branchId`, `format` |
| GET    | /reports/outstanding-payments | report.read | Outstanding payments report        |
| GET    | /reports/late-payments      | report.read  | Late payments report               |
| GET    | /reports/vehicle-utilisation | report.read  | Vehicle utilisation by date range  |
| GET    | /reports/maintenance-costs  | report.read  | Maintenance costs report           |
| GET    | /reports/revenue-per-vehicle | report.read  | Revenue breakdown per vehicle      |
| GET    | /reports/revenue-per-customer | report.read | Revenue breakdown per customer     |
| GET    | /reports/upcoming-expiries  | report.read  | Upcoming compliance expiries       |
| GET    | /reports/branch-performance | report.read  | Branch performance summary         |

Example: `GET /reports/revenue?from=2026-08-01&to=2026-08-31&format=excel`

---

## Notifications

| Method | Path                       | Auth                | Description                        |
|--------|----------------------------|---------------------|------------------------------------|
| GET    | /notifications             | AdminJWT or CustomerJWT | List notifications for current user |
| GET    | /notifications/unread-count | AdminJWT or CustomerJWT | Unread notification count         |
| PATCH  | /notifications/:id/read    | AdminJWT or CustomerJWT | Mark notification as read         |

---

## Policy Settings

All endpoints require AdminJWT and `policy.manage` permission (SUPER_ADMIN only).

| Method | Path                    | Description                                         |
|--------|-------------------------|-----------------------------------------------------|
| GET    | /policy                 | Get all resolved policy settings. Query: `branchId` |
| GET    | /policy/defaults        | Get compiled default values for all policy keys     |
| GET    | /policy/:key/history    | Change history for a specific policy key            |
| POST   | /policy                 | Set a policy value (creates a versioned entry)      |

**POST /policy** body:
```json
{
  "key": "billing.interestRateBps",
  "value": "100",
  "branchId": null,
  "description": "1% per day simple interest on outstanding principal"
}
```

---

## Admin Users

All endpoints require AdminJWT and `user.manage` permission (SUPER_ADMIN only).

| Method | Path                  | Description                          |
|--------|-----------------------|--------------------------------------|
| GET    | /users                | List admin users                     |
| GET    | /users/:id            | Get admin user detail                |
| POST   | /users                | Create admin user                    |
| PATCH  | /users/:id            | Update admin user                    |
| PATCH  | /users/:id/role       | Assign role and branch               |
| PATCH  | /users/:id/password   | Admin reset of another user's password |
| DELETE | /users/:id            | Deactivate admin user                |

---

## Branches

All endpoints require AdminJWT and `branch.manage` permission (SUPER_ADMIN only).

| Method | Path          | Description                               |
|--------|---------------|-------------------------------------------|
| GET    | /branches     | List all branches with vehicle/rental counts |
| GET    | /branches/:id | Get a single branch                       |
| POST   | /branches     | Create a new branch                       |
| PATCH  | /branches/:id | Update a branch                           |
| DELETE | /branches/:id | Deactivate a branch (soft delete)         |

---

## Jobs (SUPER_ADMIN Only)

All endpoints require AdminJWT and `policy.manage` permission.

| Method | Path                               | Description                              |
|--------|------------------------------------|------------------------------------------|
| GET    | /admin/jobs/stats                  | Queue statistics for all 6 queues        |
| POST   | /admin/jobs/trigger/payment-reminder | Manually trigger payment reminder sweep |
| POST   | /admin/jobs/trigger/interest-accrual | Manually trigger interest accrual sweep |
| POST   | /admin/jobs/trigger/expiry-reminder  | Manually trigger expiry reminder sweep  |
| POST   | /admin/jobs/trigger/rental-status    | Manually trigger rental status update   |
| POST   | /admin/jobs/trigger/risk-scoring     | Manually trigger risk scoring sweep     |
| POST   | /admin/jobs/trigger/invoice-generation | Manually trigger invoice generation   |

---

## Error Responses

All errors follow a consistent shape:

```json
{
  "statusCode": 400,
  "message": "rentAmountCents must be a positive integer",
  "error": "Bad Request",
  "correlationId": "clxxxxx"
}
```

Common HTTP status codes:
- `400` — Validation error (invalid body or query parameters)
- `401` — Missing or expired access token
- `403` — Valid token but insufficient permissions
- `404` — Resource not found
- `409` — Conflict (e.g. duplicate invoice, vehicle already in target state)
- `422` — Business rule violation (e.g. cannot activate rental while vehicle is in MAINTENANCE)
- `500` — Internal server error (correlationId provided for log lookup)
