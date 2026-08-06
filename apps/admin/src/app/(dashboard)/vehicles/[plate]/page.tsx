'use client';

import { useState, useEffect, use } from 'react';
import { apiGet, apiPatch } from '@/lib/api-client';
import { VehicleStatusBadge } from '@/components/ui/StatusBadge';
import { DateChip } from '@/components/ui/DateChip';
import { MoneyCell } from '@/components/ui/MoneyCell';
import { Can } from '@/lib/permissions';
import { useToast } from '@/components/ui/Toast';
import { Modal } from '@/components/ui/Modal';
import { cn, formatDate, daysFromNow, getExpiryUrgency } from '@/lib/utils';
import { PERMISSIONS } from '@vida/shared';
import type { VehicleStatusName } from '@vida/shared';

// Types
interface VehicleDetail {
  id: string;
  plateNumber: string;
  make: string;
  model: string;
  year: number;
  colour: string;
  engineCapacityCC: number;
  currentMileage: number;
  status: VehicleStatusName;
  branchName: string;
  purchaseDate: string | null;
  purchasePriceCents: number | null;
  insuranceExpiry: string | null;
  roadTaxExpiry: string | null;
  coeExpiry: string | null;
  nextServicingDate: string | null;
  inspectionDate: string | null;
  notes: string | null;
  currentRental: {
    id: string;
    agreementNo: string;
    customer: { id: string; fullName: string; customerRef: string; phone: string };
    startDate: string;
    endDate: string;
    outstandingCents: number;
    invoiceStatus: string;
  } | null;
}

interface ServiceRecord {
  id: string;
  serviceDate: string;
  workshopName: string;
  description: string;
  costCents: number;
  mileage: number;
  nextServiceDueDate: string | null;
}

interface Document {
  id: string;
  docType: string;
  fileName: string;
  uploadedAt: string;
  url: string;
}

type Tab = 'overview' | 'service' | 'documents' | 'payments' | 'notes';

const ALL_STATUSES: VehicleStatusName[] = [
  'AVAILABLE', 'RESERVED', 'RENTED_OUT', 'MAINTENANCE',
  'CLEANING', 'INSPECTION', 'ACCIDENT_REPAIR', 'SOLD', 'INACTIVE',
];

function InfoRow({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div className="flex items-start gap-2 py-1.5 border-b border-zinc-50">
      <span className="text-2xs text-zinc-400 w-32 shrink-0 pt-0.5 uppercase tracking-wide">{label}</span>
      <span className="text-xs text-zinc-800 flex-1">{value ?? '—'}</span>
    </div>
  );
}

export default function VehiclePage({ params }: { params: Promise<{ plate: string }> }) {
  const { plate } = use(params);
  const { show } = useToast();
  const [vehicle, setVehicle] = useState<VehicleDetail | null>(null);
  const [serviceRecords, setServiceRecords] = useState<ServiceRecord[]>([]);
  const [documents, setDocuments] = useState<Document[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<Tab>('overview');

  const [statusModal, setStatusModal] = useState(false);
  const [newStatus, setNewStatus] = useState<VehicleStatusName | ''>('');
  const [statusLoading, setStatusLoading] = useState(false);

  useEffect(() => {
    setLoading(true);
    Promise.all([
      apiGet<VehicleDetail>(`/vehicles/${plate}`),
      apiGet<ServiceRecord[]>(`/vehicles/${plate}/service-records`),
      apiGet<Document[]>(`/vehicles/${plate}/documents`),
    ])
      .then(([v, sr, docs]) => {
        setVehicle(v);
        setServiceRecords(sr);
        setDocuments(docs);
      })
      .catch(() => show('Failed to load vehicle', 'error'))
      .finally(() => setLoading(false));
  }, [plate, show]);

  async function handleStatusChange() {
    if (!newStatus || !vehicle) return;
    setStatusLoading(true);
    try {
      await apiPatch(`/vehicles/${vehicle.id}/status`, { status: newStatus });
      setVehicle(prev => prev ? { ...prev, status: newStatus } : prev);
      show('Status updated', 'success');
      setStatusModal(false);
    } catch {
      show('Failed to update status', 'error');
    } finally {
      setStatusLoading(false);
    }
  }

  if (loading) {
    return (
      <div className="p-6 space-y-4">
        <div className="h-6 w-48 bg-zinc-100 rounded animate-pulse" />
        <div className="h-48 bg-zinc-100 rounded animate-pulse" />
      </div>
    );
  }

  if (!vehicle) {
    return (
      <div className="p-6 text-sm text-red-600">Vehicle {plate} not found.</div>
    );
  }

  const TABS: { key: Tab; label: string }[] = [
    { key: 'overview', label: 'Overview' },
    { key: 'service', label: `Service (${serviceRecords.length})` },
    { key: 'documents', label: `Documents (${documents.length})` },
    { key: 'payments', label: 'Payments' },
    { key: 'notes', label: 'Notes' },
  ];

  return (
    <div className="p-6 space-y-4">
      {/* Breadcrumb */}
      <div className="flex items-center gap-1.5 text-xs text-zinc-400">
        <a href="/vehicles" className="hover:text-teal-600">Vehicles</a>
        <span>/</span>
        <span className="text-zinc-700 font-mono">{vehicle.plateNumber}</span>
      </div>

      {/* Header */}
      <div className="flex items-start justify-between gap-4">
        <div>
          <div className="flex items-center gap-3">
            <h1 className="text-base font-semibold font-mono text-zinc-900">{vehicle.plateNumber}</h1>
            <VehicleStatusBadge status={vehicle.status} />
          </div>
          <p className="text-xs text-zinc-500 mt-0.5">{vehicle.year} {vehicle.make} {vehicle.model} &bull; {vehicle.colour}</p>
        </div>
        <Can permission={PERMISSIONS.VEHICLE_STATUS_CHANGE}>
          <button
            onClick={() => { setStatusModal(true); setNewStatus(vehicle.status); }}
            className="text-xs px-3 py-1.5 border border-zinc-200 rounded-sm hover:bg-zinc-50 transition-colors"
          >
            Change Status
          </button>
        </Can>
      </div>

      {/* Expiry chips row */}
      <div className="flex flex-wrap gap-2">
        <DateChip date={vehicle.insuranceExpiry} label="Insurance" />
        <DateChip date={vehicle.roadTaxExpiry} label="Road Tax" />
        <DateChip date={vehicle.coeExpiry} label="COE" />
        <DateChip date={vehicle.nextServicingDate} label="Service" />
        <DateChip date={vehicle.inspectionDate} label="Inspection" />
      </div>

      {/* Current rental banner */}
      {vehicle.currentRental && (
        <div className="bg-teal-50 border border-teal-200 rounded-sm px-4 py-3 flex items-start justify-between gap-4">
          <div>
            <p className="text-xs font-semibold text-teal-800">{vehicle.currentRental.customer.fullName}</p>
            <p className="text-2xs text-teal-600 mt-0.5">
              {vehicle.currentRental.agreementNo} &bull; {formatDate(vehicle.currentRental.startDate)} – {formatDate(vehicle.currentRental.endDate)}
            </p>
          </div>
          <div className="text-right">
            <p className="text-2xs text-teal-600">Outstanding</p>
            <p className="text-xs font-semibold tabular-nums text-teal-800">
              S${(vehicle.currentRental.outstandingCents / 100).toFixed(2)}
            </p>
          </div>
        </div>
      )}

      {/* Tabs */}
      <div className="border-b border-zinc-200">
        <div className="flex gap-0">
          {TABS.map(t => (
            <button
              key={t.key}
              onClick={() => setActiveTab(t.key)}
              className={cn(
                'px-3 py-2 text-xs font-medium border-b-2 transition-colors',
                activeTab === t.key
                  ? 'border-teal-500 text-teal-700'
                  : 'border-transparent text-zinc-500 hover:text-zinc-800',
              )}
            >
              {t.label}
            </button>
          ))}
        </div>
      </div>

      {/* Tab content */}
      <div>
        {activeTab === 'overview' && (
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            <div>
              <p className="text-2xs font-semibold uppercase tracking-widest text-zinc-400 mb-2">Registration</p>
              <div className="bg-white border border-zinc-200 rounded-sm px-4 py-1">
                <InfoRow label="Plate" value={<span className="font-mono">{vehicle.plateNumber}</span>} />
                <InfoRow label="Make / Model" value={`${vehicle.make} ${vehicle.model}`} />
                <InfoRow label="Year" value={vehicle.year} />
                <InfoRow label="Colour" value={vehicle.colour} />
                <InfoRow label="Engine" value={`${vehicle.engineCapacityCC}cc`} />
                <InfoRow label="Branch" value={vehicle.branchName} />
                <InfoRow label="Mileage" value={`${vehicle.currentMileage.toLocaleString()} km`} />
              </div>
            </div>
            <div>
              <p className="text-2xs font-semibold uppercase tracking-widest text-zinc-400 mb-2">Compliance</p>
              <div className="bg-white border border-zinc-200 rounded-sm px-4 py-1">
                <InfoRow label="Insurance" value={<DateChip date={vehicle.insuranceExpiry} />} />
                <InfoRow label="Road Tax" value={<DateChip date={vehicle.roadTaxExpiry} />} />
                <InfoRow label="COE Expiry" value={<DateChip date={vehicle.coeExpiry} />} />
                <InfoRow label="Inspection" value={<DateChip date={vehicle.inspectionDate} />} />
                <InfoRow label="Next Service" value={<DateChip date={vehicle.nextServicingDate} />} />
              </div>
            </div>
          </div>
        )}

        {activeTab === 'service' && (
          <div className="space-y-2">
            {serviceRecords.length === 0 ? (
              <p className="text-sm text-zinc-400 py-6 text-center">No service records.</p>
            ) : (
              serviceRecords.map(sr => (
                <div key={sr.id} className="bg-white border border-zinc-200 rounded-sm px-4 py-3">
                  <div className="flex items-start justify-between gap-4">
                    <div>
                      <p className="text-xs font-semibold text-zinc-900">{sr.description}</p>
                      <p className="text-2xs text-zinc-500 mt-0.5">
                        {sr.workshopName} &bull; {formatDate(sr.serviceDate)} &bull; {sr.mileage.toLocaleString()} km
                      </p>
                    </div>
                    <p className="text-xs font-semibold tabular-nums text-zinc-800">
                      S${(sr.costCents / 100).toFixed(2)}
                    </p>
                  </div>
                  {sr.nextServiceDueDate && (
                    <p className="text-2xs text-zinc-400 mt-1">
                      Next service: <DateChip date={sr.nextServiceDueDate} />
                    </p>
                  )}
                </div>
              ))
            )}
          </div>
        )}

        {activeTab === 'documents' && (
          <div className="space-y-2">
            {documents.length === 0 ? (
              <p className="text-sm text-zinc-400 py-6 text-center">No documents uploaded.</p>
            ) : (
              documents.map(doc => (
                <div key={doc.id} className="bg-white border border-zinc-200 rounded-sm px-4 py-3 flex items-center justify-between">
                  <div>
                    <p className="text-xs font-medium text-zinc-900">{doc.fileName}</p>
                    <p className="text-2xs text-zinc-400 mt-0.5">
                      {doc.docType} &bull; Uploaded {formatDate(doc.uploadedAt)}
                    </p>
                  </div>
                  <a
                    href={doc.url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-xs text-teal-600 hover:underline"
                  >
                    View
                  </a>
                </div>
              ))
            )}
          </div>
        )}

        {activeTab === 'payments' && (
          vehicle.currentRental ? (
            <div className="bg-white border border-zinc-200 rounded-sm px-4 py-3">
              <p className="text-xs text-zinc-500">
                View full payment history for{' '}
                <a href={`/customers/${vehicle.currentRental.customer.id}`} className="text-teal-600 hover:underline">
                  {vehicle.currentRental.customer.fullName}
                </a>
              </p>
            </div>
          ) : (
            <p className="text-sm text-zinc-400 py-6 text-center">No active rental.</p>
          )
        )}

        {activeTab === 'notes' && (
          <div className="bg-white border border-zinc-200 rounded-sm px-4 py-3">
            {vehicle.notes ? (
              <p className="text-xs text-zinc-700 whitespace-pre-line">{vehicle.notes}</p>
            ) : (
              <p className="text-sm text-zinc-400">No notes.</p>
            )}
          </div>
        )}
      </div>

      {/* Status change modal */}
      <Modal
        open={statusModal}
        onClose={() => setStatusModal(false)}
        title="Change Vehicle Status"
        size="sm"
      >
        <div className="space-y-3">
          <div>
            <label className="block text-2xs font-medium text-zinc-500 uppercase tracking-wide mb-2">
              New Status
            </label>
            <div className="grid grid-cols-2 gap-1.5">
              {ALL_STATUSES.map(s => (
                <button
                  key={s}
                  onClick={() => setNewStatus(s)}
                  className={cn(
                    'text-xs px-2 py-1.5 border rounded-sm text-left transition-colors',
                    newStatus === s
                      ? 'border-teal-500 bg-teal-50 text-teal-700'
                      : 'border-zinc-200 hover:bg-zinc-50 text-zinc-700',
                    s === vehicle.status && 'opacity-50 cursor-default',
                  )}
                  disabled={s === vehicle.status}
                >
                  <VehicleStatusBadge status={s} />
                </button>
              ))}
            </div>
          </div>
          <div className="flex gap-2 justify-end">
            <button onClick={() => setStatusModal(false)} className="px-3 py-1.5 text-xs border border-zinc-200 rounded-sm hover:bg-zinc-50">Cancel</button>
            <button
              onClick={handleStatusChange}
              disabled={statusLoading || !newStatus || newStatus === vehicle.status}
              className="px-3 py-1.5 text-xs bg-teal-500 text-white rounded-sm hover:bg-teal-600 disabled:opacity-50"
            >
              {statusLoading ? 'Saving…' : 'Save'}
            </button>
          </div>
        </div>
      </Modal>
    </div>
  );
}
