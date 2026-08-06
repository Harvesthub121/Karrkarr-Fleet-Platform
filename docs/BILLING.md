# Billing Rules — Plain English Guide for Karrkarr Operations

This document explains how the billing system works for non-technical staff. It covers invoice generation, late interest, partial payments, and what you can change in the settings without calling a developer.

---

## How Invoices Are Created

Invoices are created automatically by a nightly job (runs at 1:00 AM Singapore time). The job looks at all active rental agreements and creates invoices ahead of the due date.

**Lead time:** By default, invoices are created 7 days before they are due. This gives customers time to see the invoice and pay before the due date.

**Payment terms:** By default, invoices are due 7 days after the issue date.

Both of these are configurable in Settings → Policy without a developer.

### Weekly Billing

For a weekly rental, an invoice is created every 7 days. The billing anchor day (1 = Monday through 7 = Sunday) is set on the rental agreement and determines which day of the week the invoice is due.

Example: Anchor day = Wednesday (3), rent = S$520/week. Every Wednesday, an invoice for S$520 is generated and due on that Wednesday. The customer has until Wednesday to pay before the grace period starts.

### Monthly Billing

For a monthly rental, an invoice is created every calendar month. The billing anchor day (1–28) determines the day of month. It is capped at 28 so no month is ever skipped (February never causes a missed invoice).

Example: Anchor day = 15, rent = S$2,000/month. The 15th of each month an invoice for S$2,000 is generated and due on the 15th.

---

## Invoice Statuses

| Status               | Meaning                                                                       |
|----------------------|-------------------------------------------------------------------------------|
| UPCOMING             | Created ahead of time, not yet due                                            |
| DUE                  | Due date has arrived, no payment yet                                          |
| PENDING_VERIFICATION | Customer has submitted a payment claim; awaiting admin approval               |
| PAID                 | Fully paid and verified                                                       |
| PARTIALLY_PAID       | A payment was approved but did not cover the full amount                      |
| OVERDUE              | Past due date, past grace period, interest is accruing                        |
| REJECTED             | Customer's payment submission was rejected (wrong reference, amount mismatch) |
| WRITTEN_OFF          | Balance abandoned as uncollectable (requires ACCOUNTS role)                   |
| CANCELLED            | Invoice voided before payment (requires ACCOUNTS role)                        |

---

## Late Interest — How It Works

**The rule:** Simple daily interest of 1% per day on the outstanding principal amount. There is no compounding — interest is always calculated on the original unpaid rent, not on previously charged interest.

**Grace period:** 3 days after the due date before any interest starts. This is built in so customers who pay a day or two late are not immediately penalised.

**First interest date:** Due date + grace period + 1 day.

Example with a 10 August due date:
- 10 Aug: Due date
- 11, 12, 13 Aug: Grace period — no interest
- 14 Aug: First day interest is charged

### Worked Numeric Example

**Scenario:** Weekly rental, S$800 due, due date 10 August, grace period 3 days, 1%/day interest rate, customer makes no payment.

| Day | Date   | Outstanding Principal | Daily Interest (1%) | Accrued to Date |
|-----|--------|----------------------|---------------------|-----------------|
| 0   | 10 Aug | S$800.00             | Grace period        | S$0.00          |
| 1   | 11 Aug | S$800.00             | Grace period        | S$0.00          |
| 2   | 12 Aug | S$800.00             | Grace period        | S$0.00          |
| 3   | 13 Aug | S$800.00             | Grace period        | S$0.00          |
| 4   | 14 Aug | S$800.00             | S$8.00              | S$8.00          |
| 5   | 15 Aug | S$800.00             | S$8.00              | S$16.00         |
| 6   | 16 Aug | S$800.00             | S$8.00              | S$24.00         |
| 7   | 17 Aug | S$800.00             | S$8.00              | S$32.00         |
| 10  | 20 Aug | S$800.00             | S$8.00              | S$56.00         |
| 14  | 24 Aug | S$800.00             | S$8.00              | S$88.00         |

After 14 days of actual interest (17 days past due date), the customer owes:
- Principal: S$800.00
- Interest: S$112.00
- **Total: S$912.00**

### What Happens When the Customer Makes a Partial Payment

Partial payment reduces the principal. Tomorrow's interest is calculated on the new lower principal. Previous days' charges are not recalculated.

**Example continued:** On 20 August the customer pays S$300.

- Remaining principal after payment: S$800.00 − S$300.00 = S$500.00
- Interest already accrued (14 Aug–19 Aug, 6 days): S$48.00 — this stays on the account
- New daily interest from 21 Aug onward: S$500.00 × 1% = S$5.00/day (was S$8.00/day)

The payment is applied to the invoice. The invoice status becomes PARTIALLY_PAID. Interest continues to accrue on the S$500.00 remaining principal.

**Important:** A payment does not wipe out accrued interest. The S$48.00 of interest charged before the payment date remains on the account. It can only be removed by an admin with the ACCOUNTS role using the interest waiver function.

---

## The Payment Verification Workflow

Karrkarr does not have an automated payment gateway. Payments are verified manually. This is the sequence:

1. **Customer submits a payment claim** via the customer portal. They enter:
   - The invoice they are paying
   - The amount they paid
   - The bank transaction reference from their bank app
   - The date they paid
   - Optionally, a screenshot of the payment confirmation

2. **Invoice status changes to PENDING_VERIFICATION.** An email notification is sent to accounts staff.

3. **Accounts staff (ACCOUNTS or BRANCH_MANAGER role) logs in to the admin dashboard.** They go to Payments → Pending Verification. They cross-check the claimed amount and transaction reference against the company's bank statement.

4. **Approve or Reject:**
   - **Approve:** Staff enters the amount confirmed by the bank (this may differ slightly from what the customer declared, e.g. if the bank deducted a fee). The system writes a PAYMENT_RECEIVED ledger entry, updates the invoice outstanding balance, and sends the customer a receipt.
   - **Reject:** Staff enters a rejection reason (e.g. "Transaction reference not found in bank statement"). The customer is notified and can resubmit.

5. **If the approved amount is less than the full invoice outstanding, the invoice becomes PARTIALLY_PAID.** Interest continues to accrue on the remaining principal.

### Key points for accounts staff:
- The system uses the **admin-entered approved amount**, not the customer's declared amount, as the actual payment. This handles short payments and bank fee deductions correctly.
- A payment submission is a **claim**, not real money. Clicking Approve is the action that moves money in the ledger.
- PayNow QR codes embedded in invoices lock the amount and reference to that specific invoice. Customers who scan the QR and pay via their banking app have the reference pre-filled, reducing reconciliation errors.

---

## What Admins Can Configure Without a Developer

All of the following are in Settings → Policy in the admin dashboard. Only SUPER_ADMIN can change these.

| Setting                          | Policy key                         | Default        |
|----------------------------------|------------------------------------|----------------|
| Daily interest rate              | billing.interestRateBps            | 100 (= 1%/day) |
| Grace period before interest     | billing.gracePeriodDays            | 3 days         |
| Interest cap (% of principal)    | billing.interestCapBps             | 0 (no cap)     |
| Flat late fee                    | billing.lateFeeFlatCents           | 0              |
| Invoice lead time                | billing.invoiceLeadDays            | 7 days         |
| Payment terms (issue to due)     | billing.paymentTermDays            | 7 days         |
| Pre-due reminder days            | reminders.daysBefore               | 3,1            |
| Reminder on due date             | reminders.onDueDate                | true           |
| Overdue reminder interval        | reminders.overdueIntervalDays      | 3 days         |
| Stop chasing after N days overdue| reminders.overdueMaxDays           | 90 days        |
| PayNow UEN                       | paynow.uen                         | (placeholder)  |
| PayNow merchant name             | paynow.merchantName                | (placeholder)  |
| Bank name / account number       | bank.*                             | (placeholder)  |
| COE expiry reminder ladder       | expiry.coeDaysBefore               | 90,60,30,7     |
| Road tax reminder ladder         | expiry.roadTaxDaysBefore           | 30,14,7        |

Changes take effect for invoices generated **after** the change. Already-issued invoices retain the rate that was in effect when they were created. This is a deliberate design choice — customers cannot be retroactively charged a higher rate that was not in effect when their invoice was issued.

To apply a different rate to an individual contract, set `interestRateBpsOverride` on the rental agreement. This overrides the branch and global policy for that contract only.

---

## GST

**Karrkarr Pte Ltd is not GST-registered.** There are no tax lines on any invoice. If Karrkarr becomes GST-registered in the future, this will require a settings change (`tax.rateBps`) and an update to the invoice template. It will not require a database migration.

---

## Deposit Refunds

Deposit handling is **out of scope** in this version of the system. Deposits are received and tracked in the ledger. Deposits can be applied against outstanding charges (accident excess, etc.) by an ACCOUNTS admin. The end-of-rental refund disbursement process — determining the final refund amount and processing the bank transfer back to the customer — must be handled manually outside the system. A future extension is described in `docs/EXTENSIONS.md`.
