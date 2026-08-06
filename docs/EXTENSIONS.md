# Extensions and Future Enhancements

This document maps each planned future feature to the specific extension seam in the codebase, gives a rough effort estimate, and recommends sequencing. Estimates assume a competent developer familiar with this codebase.

---

## Deposit Refund Handling (Descoped from v1)

**What was descoped:** The end-of-rental workflow that determines the final deposit refund amount and processes a bank transfer back to the customer.

**What exists today:** Deposits are received (`DEPOSIT_RECEIVED` ledger entry), tracked (`RentalAgreement.depositBalanceCents`), and can be applied against charges (`DEPOSIT_APPLIED` ledger entry). The money is in the ledger. What is missing is the disbursement step.

**Extension seam:**
- `LedgerEntryType` enum: add `DEPOSIT_REFUNDED`
- `RentalAgreement`: add `depositRefundedAt`, `depositRefundAmountCents`, `depositRefundRef`
- New service method `LedgerService.processDepositRefund(rentalId, amountCents, adminId, bankRef)`
- New controller endpoint `POST /rentals/:id/deposit-refund`
- Notification template for customer refund confirmation

**Effort:** 2–3 days. The ledger structure already handles it; the gap is the workflow and UI.

**Sequencing:** High priority — this is a real operational gap. Build in the next sprint.

---

## GPS Tracking

**Extension seam:** `Vehicle` model has `currentMileageKm` and `mileageUpdatedAt`. There is no GPS position field today.

**To add:**
- Add `lastKnownLat`, `lastKnownLng`, `lastGpsUpdateAt` to `Vehicle` (nullable migration)
- Create a `GpsTrack` table (vehicleId, lat, lng, speed, timestamp) for history
- New `vehicles/gps.service.ts` that ingests from the GPS provider webhook
- The `VehiclesService.getDashboard()` already returns vehicle detail — add GPS fields there

**Provider options for Singapore:** Queclink, CalAmp, Teltonika (hardware), or a fleet telematics SaaS like GPSWOX or Samsara with a webhook API.

**Effort:** 1–2 weeks for backend + webhook integration. Hardware installation is separate. The map UI in the admin dashboard is a further 1–2 weeks.

**Sequencing:** After deposit refund. Operationally useful but not blocking.

---

## Driver Mobile App

**Extension seam:** The customer portal (`apps/customer`) is a Next.js web app. The auth system (customer JWT, `CustomerJwtGuard`) is already separate from admin auth and ready to serve a mobile client.

**Approach:** Build a React Native (Expo) app that consumes the same REST API endpoints the customer portal uses. No backend changes are needed for a read-only app (view invoices, view PayNow QR, notifications). Payment submission (`POST /payments/submit`) also already works from mobile.

**Additional backend work for a richer app:**
- Push notifications: implement `PushAdapter` (currently a stub) using Expo Push Notifications or Firebase FCM
- The `NotificationChannelAdapter` interface is already defined — only `PushAdapter.send()` needs implementing

**Effort:** Mobile app shell + auth + invoice view: 2–3 weeks. Push notifications: 1 week additional. Full feature parity with web portal: 4–6 weeks.

**Sequencing:** After portal is validated in production. Push notifications require the mobile app to exist first.

---

## OCR Document Scanning

**Extension seam:** `Document` table stores any uploaded file. `DocumentType` enum includes `IDENTITY_DOCUMENT` and `DRIVING_LICENCE`. `Customer` has `nric`, `licenceNumber`, `licenceExpiry` fields.

**Approach:** After a document is uploaded to S3, trigger an async job that calls an OCR API (AWS Textract or Google Document AI) and pre-fills the customer form fields. The admin confirms or corrects before saving.

**Extension seam in jobs:** Add a new BullMQ queue `QUEUE_NAMES.OCR_EXTRACTION` in `jobs.module.ts`. The document upload endpoint enqueues a job. The processor calls Textract and writes back to the `Customer` record.

**Effort:** 1 week for Textract integration + job + UI confirmation step.

**Sequencing:** Nice-to-have. Reduces manual data entry during customer onboarding.

---

## AI Maintenance Prediction

**Extension seam:** `MaintenanceRecord` has full service history with `mileageKm`, `serviceDate`, `type`, `costCents`. `Vehicle` has `currentMileageKm`, `lastServiceDate`, `lastServiceMileageKm`, `nextServiceDate`, `nextServiceMileageKm`.

**Approach:** Export the maintenance history to a data science tool or call an ML inference endpoint. The predicted next service date/mileage writes back to `Vehicle.nextServiceDate` and `Vehicle.nextServiceMileageKm`. These fields are already watched by the `ExpiryReminderJob`.

**Effort:** The data pipeline and model are the main work — 2–4 weeks depending on the approach. The backend integration is trivial once a model exists.

**Sequencing:** Needs at least 12 months of real maintenance data to be meaningful. Plan for this in year 2.

---

## AI Pricing

**Extension seam:** `Vehicle.defaultWeeklyRateCents` and `Vehicle.defaultMonthlyRateCents` are the base rates. `RentalAgreement.rentAmountCents` is the per-contract rate.

**Approach:** A pricing recommendation model that considers vehicle age, mileage, market demand, COE remaining life, and comparable vehicles. The output is a suggested rate that the operations staff accept or override when creating a rental.

**Effort:** Data collection and model: 3–6 weeks. Backend: 1 week (a new `POST /vehicles/:id/suggest-price` endpoint). UI: 1 week.

**Sequencing:** Year 2, after data accumulates.

---

## E-Signature

**Extension seam:** `RentalAgreement.signedAt` and `Document` with `DocumentType.RENTAL_AGREEMENT`. The agreement exists; what is missing is a tamper-evident digital signature.

**Approach:** Integrate a provider like DocuSign, SignNow, or HelloSign. When a rental is activated, the system generates a PDF of the agreement, sends it to the customer via the provider's API, and receives a webhook when signed. The signed document URL is stored as a `Document` record.

**Effort:** 1–2 weeks. The rental lifecycle already has an `activate` endpoint where the signature trigger fits naturally.

**Sequencing:** Useful before going live with a large customer base. Currently agreements are signed physically.

---

## Automated Invoice Generation (PDF)

**Extension seam:** `Invoice` table has all data needed. `Document` with `DocumentType.INVOICE`. `InvoiceGenerationProcessor` already creates the `Invoice` row.

**What is missing:** The actual PDF file. The `InvoiceService` generates the database record but does not render a PDF.

**Approach:** Add a PDF rendering step to the `InvoiceGenerationProcessor` using a library like `pdfkit` or `puppeteer` (headless Chromium rendering an HTML template). Upload to S3, create a `Document` record, and link to the `Invoice`.

**Effort:** 3–5 days. The hardest part is the PDF template design.

**Sequencing:** High priority — customers currently cannot download a properly formatted invoice PDF. Build in the next sprint alongside deposit refund.

---

## Xero Integration

**Extension seam:** `LedgerEntry` is the financial journal. `Invoice` and `Payment` are the source documents.

**Approach:** A nightly or real-time sync job that pushes verified payments and issued invoices to Xero via their API. Map `LedgerEntryType` to Xero account codes.

**Effort:** 2–3 weeks. Xero API is well-documented. The main complexity is initial chart-of-accounts mapping with Karrkarr's accountant.

**Sequencing:** After the first month of live operation, when the accountant needs to reconcile.

---

## QuickBooks Integration

Same approach and effort as Xero. Choose one, not both, unless the accountant switches tools.

---

## Stripe / HitPay Integration

**Extension seam:** `PaymentMethod` enum already has payment method values. `PaymentSubmission` is the current manual claim flow. `PayNowService` generates QR codes.

**What changes:** Instead of (or alongside) manual PayNow verification, integrate a payment gateway that provides automated confirmation.

- **HitPay** is the most relevant choice for Singapore — supports PayNow, credit cards, and provides webhooks for payment confirmation.
- **Stripe** supports cards and some local methods but not direct PayNow.

**Approach:** HitPay integration replaces or supplements the manual submission flow. On payment success, HitPay calls a webhook (`POST /webhooks/hitpay`). The webhook handler calls `PaymentSubmissionService.approvePayment()` with `approvedAmountCents` from the HitPay payload.

**Effort:** 1–2 weeks. The payment approval logic already exists; the webhook is the only new piece.

**Sequencing:** High value — removes the manual verification bottleneck. Build after deposit refund and invoice PDF.

---

## Customer Self-Booking

**Extension seam:** `RentalAgreement` is currently created by admins only (OPERATIONS or BRANCH_MANAGER). The `CustomerJwtGuard` and customer scope guard exist for the customer portal.

**Approach:** Add customer-facing rental endpoints that accept a vehicle selection and dates, check availability (vehicle status must be AVAILABLE), and create a DRAFT rental. Admin approval step converts DRAFT to ACTIVE.

**Effort:** 1–2 weeks for backend (availability query, draft creation, approval flow). 2–3 weeks for the customer portal booking UI.

**Sequencing:** A meaningful feature uplift but not needed for the initial go-live with existing customers.

---

## QR Vehicle Handover

**Extension seam:** `VehicleStatusChange` records state transitions. `RentalAgreement` has `startDate`, `signedAt`, `mileageAtStart`, `mileageAtEnd`.

**Approach:** Generate a QR code per vehicle (static — encodes vehicle ID or plate). Scanning on handover opens a mobile-friendly form to record mileage, photos, and condition notes. Triggers the `POST /rentals/:id/activate` endpoint.

**Effort:** 1 week for backend (QR code generation endpoint + deeplink format). 1–2 weeks for the mobile-optimised handover form.

**Sequencing:** Nice-to-have operational improvement. After GPS tracking.

---

## Digital Inspection Checklists

**Extension seam:** `VehiclePhoto` stores photos. `Document` with `DocumentType.VEHICLE_INSPECTION_FORM` stores PDFs. `AccidentRecord` and `MaintenanceRecord` capture damage.

**Approach:** A structured checklist model (checklist template + line items + pass/fail/note per item + photos). Linked to `RentalAgreement` for pre/post rental inspections.

**New tables needed:**
- `InspectionTemplate` (items list)
- `InspectionResult` (rentalAgreementId, completedAt, completedBy)
- `InspectionResultItem` (itemId, result, note, photoS3Key)

**Effort:** 1 week for schema + API. 2–3 weeks for the mobile-optimised form UI.

**Sequencing:** After QR handover — they go together.

---

## SMS / WhatsApp Reminders

**Extension seam:** `SmsAdapter` and `WhatsAppAdapter` in `apps/api/src/modules/notifications/adapters/` both implement `NotificationChannelAdapter`. They currently log and return a stub result.

**To wire up:**

SMS — Use Twilio (`twilio` npm package) or AWS SNS. Implement `SmsAdapter.send()`:
```typescript
// In sms.adapter.ts
async send(payload: NotificationPayload): Promise<NotificationResult> {
  await twilioClient.messages.create({
    body: payload.body,
    to: payload.recipientPhone,
    from: process.env.TWILIO_FROM_NUMBER,
  });
  return { success: true };
}
```

WhatsApp — Use Twilio's WhatsApp sandbox, 360dialog, or Vonage. Same pattern.

Add `TWILIO_ACCOUNT_SID`, `TWILIO_AUTH_TOKEN`, `TWILIO_FROM_NUMBER` (or equivalent) to the environment and Secrets Manager.

**Effort per channel:** 1–2 days each once a provider account is set up. The adapter interface is ready.

**Cost consideration:** SMS and WhatsApp have per-message costs. Implement rate limiting and opt-out tracking before going live at scale.

**Sequencing:** SMS can go live immediately after the initial deployment — it is 1–2 days of work. WhatsApp requires WhatsApp Business API approval (days to weeks depending on provider).
