import { Suspense } from 'react';
import { getDashboard } from '@/lib/api';
import { formatDate, daysUntil } from '@/lib/utils';
import { CardSkeleton } from '@/components/ui/Skeleton';
import { ErrorState } from '@/components/ui/ErrorState';
import { ApiError } from '@/lib/api-client';
import type { CustomerDashboard } from '@karrkarr/shared';
import { VehicleGallery } from './VehicleGallery';
import Link from 'next/link';

export const metadata = { title: 'Dashboard — Karrkarr Portal' };
export const dynamic = 'force-dynamic';

async function DashboardContent() {
  let data: CustomerDashboard;
  try {
    data = await getDashboard();
  } catch (err) {
    const msg = err instanceof ApiError ? JSON.stringify(err.body) : 'Unable to load dashboard data.';
    return <ErrorState title="Could not load dashboard" message={msg} />;
  }

  const { rental, financials, vehicleInfo } = data;
  const isOverdue = financials.outstandingBalance.cents > 0 || financials.lateInterest.cents > 0;
  const dueDays = daysUntil(financials.nextDueDate);

  return (
    <div className="space-y-5">
      {/* Overdue alert */}
      {isOverdue && (
        <div role="alert" className="flex items-start gap-3 rounded-xl border border-red-200 bg-red-50 px-4 py-3">
          <svg className="mt-0.5 h-5 w-5 flex-none text-red-500" viewBox="0 0 20 20" fill="currentColor" aria-hidden="true">
            <path fillRule="evenodd" d="M8.485 2.495c.673-1.167 2.357-1.167 3.03 0l6.28 10.875c.673 1.167-.17 2.625-1.516 2.625H3.72c-1.347 0-2.189-1.458-1.515-2.625L8.485 2.495zM10 5a.75.75 0 01.75.75v3.5a.75.75 0 01-1.5 0v-3.5A.75.75 0 0110 5zm0 9a1 1 0 100-2 1 1 0 000 2z" clipRule="evenodd" />
          </svg>
          <div className="flex-1">
            <p className="text-sm font-semibold text-red-800">Payment overdue</p>
            <p className="text-sm text-red-700 mt-0.5">
              You have an outstanding balance of{' '}
              <span className="font-semibold tabular">{financials.outstandingBalance.display}</span>.{' '}
              <Link href="/payments" className="underline underline-offset-2">Make payment</Link>
            </p>
          </div>
        </div>
      )}

      {/* Financial Summary — hero card */}
      <section aria-labelledby="financial-heading">
        <div className="card">
          <h2 id="financial-heading" className="mb-4 text-xs font-semibold uppercase tracking-widest text-gray-400">
            Financial Summary
          </h2>

          {/* Current amount due — dominant */}
          <div className="mb-5 rounded-lg bg-teal-600 px-5 py-4 text-white">
            <p className="text-xs font-medium opacity-80 mb-1">Current Amount Due</p>
            <p className="text-4xl font-bold tabular tracking-tight">{financials.currentAmountDue.display}</p>
            {financials.nextDueDate && (
              <p className="mt-1 text-xs opacity-70">
                Due {formatDate(financials.nextDueDate)}
                {dueDays !== null && dueDays >= 0 && ` · ${dueDays} day${dueDays === 1 ? '' : 's'} remaining`}
                {dueDays !== null && dueDays < 0 && ` · ${Math.abs(dueDays)} day${Math.abs(dueDays) === 1 ? '' : 's'} overdue`}
              </p>
            )}
          </div>

          <dl className="grid grid-cols-2 gap-x-4 gap-y-3 sm:grid-cols-3">
            {[
              { label: 'Rental Amount', value: financials.rentAmount.display },
              { label: 'Deposit Paid', value: financials.depositPaid.display },
              { label: 'Deposit Balance', value: financials.depositBalance.display },
              { label: 'Accident Excess', value: financials.accidentExcess.display },
              { label: 'Outstanding Balance', value: financials.outstandingBalance.display },
              { label: 'Late Interest', value: financials.lateInterest.display },
            ].map(({ label, value }) => (
              <div key={label}>
                <dt className="text-xs text-gray-500">{label}</dt>
                <dd className="mt-0.5 text-sm font-semibold text-gray-900 tabular">{value}</dd>
              </div>
            ))}
          </dl>

          <div className="mt-4 pt-4 border-t border-gray-100">
            <Link href="/payments" className="btn-primary w-full text-center sm:w-auto">
              Go to Payment Centre
            </Link>
          </div>
        </div>
      </section>

      {/* Rental Information */}
      {rental ? (
        <section aria-labelledby="rental-heading">
          <div className="card space-y-5">
            <h2 id="rental-heading" className="text-xs font-semibold uppercase tracking-widest text-gray-400">
              Rental Information
            </h2>

            <div className="flex items-start gap-4">
              <div className="min-w-0 flex-1">
                <p className="text-xl font-bold text-gray-900">{rental.vehicle.plateNumber}</p>
                <p className="text-sm text-gray-600">
                  {rental.vehicle.year} {rental.vehicle.make} {rental.vehicle.model}
                </p>
                <p className="mt-1 text-xs text-gray-400">Agreement {rental.agreementNo}</p>
              </div>
              <span className="rounded-full bg-teal-50 px-2.5 py-0.5 text-xs font-semibold text-teal-700">
                {rental.status}
              </span>
            </div>

            {/* Date range & duration */}
            <dl className="grid grid-cols-2 gap-3 sm:grid-cols-4 text-sm">
              <div>
                <dt className="text-xs text-gray-500">Start</dt>
                <dd className="font-medium text-gray-900">{formatDate(rental.startDate)}</dd>
              </div>
              <div>
                <dt className="text-xs text-gray-500">End</dt>
                <dd className="font-medium text-gray-900">{formatDate(rental.endDate)}</dd>
              </div>
              <div>
                <dt className="text-xs text-gray-500">Duration</dt>
                <dd className="font-medium text-gray-900">{rental.durationDays} days</dd>
              </div>
              <div>
                <dt className="text-xs text-gray-500">Billing</dt>
                <dd className="font-medium text-gray-900 capitalize">{rental.billingFrequency.toLowerCase()}</dd>
              </div>
            </dl>

            {/* Progress bar */}
            <div>
              <div className="flex justify-between text-xs text-gray-500 mb-1.5">
                <span>{rental.durationDays - rental.remainingDays} days elapsed</span>
                <span>{rental.remainingDays} days remaining</span>
              </div>
              <div className="h-2 rounded-full bg-gray-100 overflow-hidden" role="progressbar"
                aria-valuenow={rental.durationDays - rental.remainingDays}
                aria-valuemin={0}
                aria-valuemax={rental.durationDays}
                aria-label="Rental period progress"
              >
                <div
                  className="h-full rounded-full bg-teal-500 transition-all"
                  style={{
                    width: `${Math.min(100, ((rental.durationDays - rental.remainingDays) / rental.durationDays) * 100).toFixed(1)}%`,
                  }}
                />
              </div>
            </div>

            {/* Vehicle gallery */}
            {rental.vehicle.photos.length > 0 && (
              <VehicleGallery photos={rental.vehicle.photos} />
            )}
          </div>
        </section>
      ) : (
        <div className="card text-center py-10">
          <p className="text-sm text-gray-500">No active rental found.</p>
        </div>
      )}

      {/* Vehicle info quick peek */}
      {(vehicleInfo.nextServicingDate || vehicleInfo.insuranceExpiry || vehicleInfo.roadTaxExpiry || vehicleInfo.inspectionDate) && (
        <section aria-labelledby="vehicle-dates-heading">
          <div className="card">
            <h2 id="vehicle-dates-heading" className="mb-4 text-xs font-semibold uppercase tracking-widest text-gray-400">
              Key Dates
            </h2>
            <dl className="grid grid-cols-2 gap-3 sm:grid-cols-4">
              {[
                { label: 'Next Service', value: vehicleInfo.nextServicingDate },
                { label: 'Inspection', value: vehicleInfo.inspectionDate },
                { label: 'Road Tax Expiry', value: vehicleInfo.roadTaxExpiry },
                { label: 'Insurance Expiry', value: vehicleInfo.insuranceExpiry },
              ].map(({ label, value }) => {
                const days = daysUntil(value);
                const urgent = days !== null && days <= 30 && days >= 0;
                return (
                  <div key={label}>
                    <dt className="text-xs text-gray-500">{label}</dt>
                    <dd className={`mt-0.5 text-sm font-medium ${urgent ? 'text-amber-700' : 'text-gray-900'}`}>
                      {formatDate(value)}
                    </dd>
                  </div>
                );
              })}
            </dl>
            <div className="mt-3">
              <Link href="/vehicle" className="text-xs text-teal-600 hover:underline">
                View full vehicle details
              </Link>
            </div>
          </div>
        </section>
      )}
    </div>
  );
}

export default function DashboardPage() {
  return (
    <Suspense fallback={
      <div className="space-y-5">
        <CardSkeleton />
        <CardSkeleton />
      </div>
    }>
      <DashboardContent />
    </Suspense>
  );
}
