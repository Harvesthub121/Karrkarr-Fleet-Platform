import { Suspense } from 'react';
import { getDashboard, getMyInvoices, getPayNowQr } from '@/lib/api';
import { formatDate, centsToDisplay } from '@/lib/utils';
import { CardSkeleton } from '@/components/ui/Skeleton';
import { ErrorState } from '@/components/ui/ErrorState';
import { StatusBadge } from '@/components/ui/StatusBadge';
import { ApiError } from '@/lib/api-client';
import { CopyButton } from '@/components/ui/CopyButton';
import { PaymentModal } from './PaymentModal';
import type { CustomerDashboard } from '@karrkarr/shared';
import type { CustomerInvoice } from '@/lib/api';

export const metadata = { title: 'Payment Centre — Karrkarr Portal' };
export const dynamic = 'force-dynamic';

const BANK_NAME = 'DBS Bank';
const BANK_ACCOUNT = '003-919874-0';
const BANK_UEN = '202312345A';
const PAYNOW_NAME = 'KARRKARR PTE LTD';

async function PaymentsContent() {
  let dashboard: CustomerDashboard;
  let invoicesResult: { data: CustomerInvoice[]; total: number };
  let qrData: { invoiceNo: string; qrDataUri: string } | null = null;

  try {
    [dashboard, invoicesResult] = await Promise.all([
      getDashboard(),
      getMyInvoices(1, 50),
    ]);
  } catch (err) {
    return <ErrorState title="Could not load payment data" message={err instanceof ApiError ? String(err.status) : undefined} />;
  }

  const { financials } = dashboard;

  // Find the current/most overdue invoice to get QR
  const currentInvoice = invoicesResult.data.find(
    inv => inv.status === 'OVERDUE' || inv.status === 'DUE' || inv.status === 'PARTIALLY_PAID',
  );

  if (currentInvoice) {
    try {
      qrData = await getPayNowQr(currentInvoice.id);
    } catch {
      // QR optional — don't fail the whole page
    }
  }

  const hasPendingSubmission = currentInvoice?.submissions.some(s => s.status === 'PENDING_VERIFICATION');

  return (
    <div className="space-y-5">
      {/* Hero: current due */}
      <section aria-labelledby="payment-heading">
        <div className="card">
          <h1 id="payment-heading" className="mb-4 text-xs font-semibold uppercase tracking-widest text-gray-400">
            Payment Centre
          </h1>

          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
            <div>
              <p className="text-xs text-gray-500 mb-1">Current Amount Due</p>
              <p className="text-4xl font-bold tabular text-gray-900">{financials.currentAmountDue.display}</p>
              {financials.nextDueDate && (
                <p className="mt-1 text-sm text-gray-500">
                  Due {formatDate(financials.nextDueDate)}
                </p>
              )}
            </div>

            <div className="flex flex-col gap-2">
              {hasPendingSubmission ? (
                <div className="rounded-lg bg-amber-50 border border-amber-200 px-4 py-3 text-sm text-amber-800 max-w-xs">
                  <p className="font-semibold">Payment under review</p>
                  <p className="text-xs mt-0.5">An admin is verifying your payment. We will update you soon.</p>
                </div>
              ) : (
                currentInvoice && <PaymentModal invoice={currentInvoice} />
              )}
            </div>
          </div>

          {/* Status badge */}
          {currentInvoice && (
            <div className="mt-3 flex items-center gap-2">
              <span className="text-xs text-gray-500">Status:</span>
              <StatusBadge status={currentInvoice.status} />
            </div>
          )}
        </div>
      </section>

      {/* Payment methods */}
      <section aria-labelledby="methods-heading">
        <div className="card space-y-5">
          <h2 id="methods-heading" className="text-xs font-semibold uppercase tracking-widest text-gray-400">
            Payment Methods
          </h2>

          <div className="grid sm:grid-cols-2 gap-5">
            {/* PayNow */}
            <div className="rounded-lg border border-gray-200 p-4">
              <p className="text-sm font-semibold text-gray-900 mb-1">PayNow (UEN)</p>
              {qrData ? (
                /* eslint-disable-next-line @next/next/no-img-element */
                <img src={qrData.qrDataUri} alt="PayNow QR code" className="w-40 h-40 mx-auto my-3" />
              ) : (
                <div className="my-3 h-40 w-40 mx-auto rounded-lg bg-gray-100 flex items-center justify-center text-xs text-gray-400">
                  QR unavailable
                </div>
              )}
              <div className="space-y-1 text-sm">
                <div className="flex items-center justify-between">
                  <span className="text-gray-500">UEN</span>
                  <span className="flex items-center gap-1 font-mono font-medium text-gray-900">
                    {BANK_UEN}
                    <CopyButton text={BANK_UEN} label="UEN" />
                  </span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-gray-500">Name</span>
                  <span className="text-xs text-gray-700">{PAYNOW_NAME}</span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-gray-500">Amount</span>
                  <span className="font-semibold tabular text-gray-900">{financials.currentAmountDue.display}</span>
                </div>
              </div>
            </div>

            {/* Bank Transfer */}
            <div className="rounded-lg border border-gray-200 p-4">
              <p className="text-sm font-semibold text-gray-900 mb-3">Bank Transfer</p>
              <dl className="space-y-2 text-sm">
                {[
                  { label: 'Bank', value: BANK_NAME },
                  { label: 'Account No.', value: BANK_ACCOUNT },
                  { label: 'Account Name', value: PAYNOW_NAME },
                  { label: 'Reference', value: qrData?.invoiceNo ?? 'Your invoice number' },
                ].map(({ label, value }) => (
                  <div key={label} className="flex items-center justify-between gap-2">
                    <dt className="text-gray-500 shrink-0">{label}</dt>
                    <dd className="flex items-center gap-1 font-mono text-xs font-medium text-gray-900 text-right">
                      {value}
                      {(label === 'Account No.' || label === 'Reference') && (
                        <CopyButton text={value} label={label} />
                      )}
                    </dd>
                  </div>
                ))}
              </dl>
              <p className="mt-3 text-xs text-gray-400">
                Please use your invoice number as the payment reference.
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* Late payment interest breakdown */}
      {financials.lateInterest.cents > 0 && (
        <section aria-labelledby="interest-heading">
          <div className="card">
            <h2 id="interest-heading" className="mb-3 text-xs font-semibold uppercase tracking-widest text-gray-400">
              Late Payment Charges
            </h2>
            {currentInvoice ? (
              <InterestBreakdown invoice={currentInvoice} />
            ) : (
              <p className="text-sm text-gray-500">
                Total accrued interest: <span className="font-semibold tabular">{financials.lateInterest.display}</span>
              </p>
            )}
          </div>
        </section>
      )}

      {/* Payment history */}
      <section aria-labelledby="history-heading">
        <div className="card">
          <h2 id="history-heading" className="mb-4 text-xs font-semibold uppercase tracking-widest text-gray-400">
            Payment History
          </h2>
          <PaymentHistoryTable invoices={invoicesResult.data} />
        </div>
      </section>
    </div>
  );
}

function InterestBreakdown({ invoice }: { invoice: CustomerInvoice }) {
  const rateDisplay = `${(invoice.appliedInterestRateBps / 100).toFixed(2)}%`;
  return (
    <div className="space-y-3">
      <div className="rounded-lg bg-amber-50 border border-amber-200 px-4 py-3 text-sm">
        <p className="text-amber-800">
          Interest is charged daily at <strong>{rateDisplay} per annum</strong> on the outstanding principal only,
          starting from the day after the due date.
        </p>
      </div>
      <dl className="grid grid-cols-2 gap-2 text-sm sm:grid-cols-3">
        <div>
          <dt className="text-xs text-gray-500">Principal Outstanding</dt>
          <dd className="font-semibold tabular text-gray-900">{centsToDisplay(invoice.outstandingCents)}</dd>
        </div>
        <div>
          <dt className="text-xs text-gray-500">Interest Accrued</dt>
          <dd className="font-semibold tabular text-amber-700">{centsToDisplay(invoice.interestAccruedCents)}</dd>
        </div>
        <div>
          <dt className="text-xs text-gray-500">Interest Waived</dt>
          <dd className="font-semibold tabular text-gray-900">{centsToDisplay(invoice.interestWaivedCents)}</dd>
        </div>
      </dl>
    </div>
  );
}

function PaymentHistoryTable({ invoices }: { invoices: CustomerInvoice[] }) {
  const allPayments = invoices
    .flatMap(inv =>
      inv.payments.map(p => ({ ...p, invoiceNo: inv.invoiceNo }))
    )
    .sort((a, b) => new Date(b.receivedOn).getTime() - new Date(a.receivedOn).getTime());

  if (allPayments.length === 0) {
    return <p className="text-sm text-gray-500 py-4 text-center">No payment records found.</p>;
  }

  return (
    <div className="overflow-x-auto -mx-6">
      <table className="min-w-full text-sm" aria-label="Payment history">
        <thead>
          <tr className="border-b border-gray-100">
            <th className="px-6 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wide">Date</th>
            <th className="px-6 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wide">Invoice</th>
            <th className="px-6 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wide">Method</th>
            <th className="px-6 py-3 text-right text-xs font-semibold text-gray-500 uppercase tracking-wide">Amount</th>
            <th className="px-6 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wide">Receipt</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-gray-100">
          {allPayments.map(p => (
            <tr key={p.id} className="hover:bg-gray-50">
              <td className="px-6 py-3 whitespace-nowrap text-gray-900">{formatDate(p.receivedOn)}</td>
              <td className="px-6 py-3 text-gray-600 font-mono text-xs">{p.invoiceNo}</td>
              <td className="px-6 py-3 text-gray-600 capitalize">{p.method.toLowerCase().replace(/_/g, ' ')}</td>
              <td className="px-6 py-3 text-right font-semibold tabular text-gray-900">{centsToDisplay(p.amountCents)}</td>
              <td className="px-6 py-3">
                {p.receiptS3Key ? (
                  <a
                    href={`/api/proxy/payments/receipts/${p.id}/download`}
                    className="text-xs text-teal-600 hover:underline focus-visible:outline focus-visible:outline-2 focus-visible:outline-teal-600 rounded"
                    target="_blank"
                    rel="noopener noreferrer"
                    aria-label={`Download receipt ${p.receiptNo}`}
                  >
                    Download
                  </a>
                ) : (
                  <span className="text-xs text-gray-400">—</span>
                )}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

export default function PaymentsPage() {
  return (
    <Suspense fallback={<div className="space-y-5"><CardSkeleton /><CardSkeleton /></div>}>
      <PaymentsContent />
    </Suspense>
  );
}
