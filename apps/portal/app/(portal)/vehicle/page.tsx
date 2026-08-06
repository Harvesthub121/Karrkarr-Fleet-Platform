import { Suspense } from 'react';
import { getDashboard } from '@/lib/api';
import { formatDate, daysUntil } from '@/lib/utils';
import { CardSkeleton } from '@/components/ui/Skeleton';
import { ErrorState } from '@/components/ui/ErrorState';
import { ApiError } from '@/lib/api-client';
import type { CustomerDashboard } from '@vida/shared';

export const metadata = { title: 'Vehicle — Vida Partners Portal' };
export const dynamic = 'force-dynamic';

async function VehicleContent() {
  let data: CustomerDashboard;
  try {
    data = await getDashboard();
  } catch (err) {
    return <ErrorState title="Could not load vehicle data" message={err instanceof ApiError ? String(err.status) : undefined} />;
  }

  const { rental, vehicleInfo, emergency } = data;

  return (
    <div className="space-y-5">
      <h1 className="text-lg font-bold text-gray-900">Vehicle</h1>

      {/* Vehicle identity */}
      {rental && (
        <section aria-labelledby="vehicle-id-heading">
          <div className="card">
            <h2 id="vehicle-id-heading" className="mb-4 text-xs font-semibold uppercase tracking-widest text-gray-400">
              Your Vehicle
            </h2>
            <p className="text-2xl font-bold text-gray-900">{rental.vehicle.plateNumber}</p>
            <p className="text-sm text-gray-600 mt-0.5">
              {rental.vehicle.year} {rental.vehicle.make} {rental.vehicle.model}
            </p>
          </div>
        </section>
      )}

      {/* Compliance dates */}
      <section aria-labelledby="compliance-heading">
        <div className="card">
          <h2 id="compliance-heading" className="mb-4 text-xs font-semibold uppercase tracking-widest text-gray-400">
            Compliance & Servicing Dates
          </h2>
          <dl className="space-y-3">
            {[
              { label: 'Next Servicing', value: vehicleInfo.nextServicingDate, threshold: 30 },
              { label: 'Inspection Due', value: vehicleInfo.inspectionDate, threshold: 30 },
              { label: 'Road Tax Expiry', value: vehicleInfo.roadTaxExpiry, threshold: 30 },
              { label: 'Insurance Expiry', value: vehicleInfo.insuranceExpiry, threshold: 30 },
            ].map(({ label, value, threshold }) => {
              const days = daysUntil(value);
              const urgent = days !== null && days <= threshold && days >= 0;
              const expired = days !== null && days < 0;
              return (
                <div key={label} className="flex items-center justify-between py-2 border-b border-gray-100 last:border-0">
                  <dt className="text-sm text-gray-600">{label}</dt>
                  <dd className="flex items-center gap-2">
                    <span className={`text-sm font-medium ${expired ? 'text-red-600' : urgent ? 'text-amber-700' : 'text-gray-900'}`}>
                      {formatDate(value)}
                    </span>
                    {expired && (
                      <span className="badge-overdue">Expired</span>
                    )}
                    {urgent && !expired && (
                      <span className="badge-pending">{days}d</span>
                    )}
                  </dd>
                </div>
              );
            })}
          </dl>
        </div>
      </section>

      {/* Emergency & Roadside */}
      <section aria-labelledby="emergency-heading">
        <div className="card">
          <h2 id="emergency-heading" className="mb-4 text-xs font-semibold uppercase tracking-widest text-gray-400">
            Emergency Contacts
          </h2>

          {/* Roadside assistance — prominent card */}
          <div className="rounded-xl border-2 border-teal-200 bg-teal-50 p-4 mb-4">
            <div className="flex items-center gap-3">
              <div className="flex h-10 w-10 flex-none items-center justify-center rounded-full bg-teal-600">
                <svg className="h-5 w-5 text-white" viewBox="0 0 20 20" fill="currentColor" aria-hidden="true">
                  <path d="M2 3a1 1 0 011-1h2.153a1 1 0 01.986.836l.74 4.435a1 1 0 01-.54 1.06l-1.548.773a11.037 11.037 0 006.105 6.105l.774-1.548a1 1 0 011.059-.54l4.435.74a1 1 0 01.836.986V17a1 1 0 01-1 1h-2C7.82 18 2 12.18 2 5V3z" />
                </svg>
              </div>
              <div>
                <p className="text-sm font-semibold text-teal-900">{emergency.roadsideName}</p>
                <p className="text-xs text-teal-700">24/7 Roadside Assistance</p>
              </div>
            </div>
            <a
              href={`tel:${emergency.roadsidePhone}`}
              className="mt-3 flex items-center justify-center gap-2 rounded-lg bg-teal-600 px-4 py-3 text-sm font-semibold text-white hover:bg-teal-700 transition focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-teal-700"
              aria-label={`Call roadside assistance: ${emergency.roadsidePhone}`}
            >
              <svg className="h-4 w-4" viewBox="0 0 20 20" fill="currentColor" aria-hidden="true">
                <path d="M2 3a1 1 0 011-1h2.153a1 1 0 01.986.836l.74 4.435a1 1 0 01-.54 1.06l-1.548.773a11.037 11.037 0 006.105 6.105l.774-1.548a1 1 0 011.059-.54l4.435.74a1 1 0 01.836.986V17a1 1 0 01-1 1h-2C7.82 18 2 12.18 2 5V3z" />
              </svg>
              Call {emergency.roadsidePhone}
            </a>
          </div>

          <dl className="space-y-3">
            <div className="flex items-center justify-between py-2 border-b border-gray-100">
              <dt className="text-sm text-gray-600">Support Email</dt>
              <dd>
                <a
                  href={`mailto:${emergency.supportEmail}`}
                  className="text-sm text-teal-600 hover:underline focus-visible:outline focus-visible:outline-2 focus-visible:outline-teal-600 rounded"
                >
                  {emergency.supportEmail}
                </a>
              </dd>
            </div>
            <div className="flex items-center justify-between py-2">
              <dt className="text-sm text-gray-600">Support Phone</dt>
              <dd>
                <a
                  href={`tel:${emergency.supportPhone}`}
                  className="text-sm font-medium text-teal-600 hover:underline focus-visible:outline focus-visible:outline-2 focus-visible:outline-teal-600 rounded"
                  aria-label={`Call support: ${emergency.supportPhone}`}
                >
                  {emergency.supportPhone}
                </a>
              </dd>
            </div>
          </dl>
        </div>
      </section>
    </div>
  );
}

export default function VehiclePage() {
  return (
    <Suspense fallback={<div className="space-y-5"><CardSkeleton /><CardSkeleton /></div>}>
      <VehicleContent />
    </Suspense>
  );
}
