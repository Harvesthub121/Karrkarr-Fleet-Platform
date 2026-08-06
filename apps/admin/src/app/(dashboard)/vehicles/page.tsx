'use client';

import { useState, useEffect, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { apiGet } from '@/lib/api-client';
import { DataTable, type Column } from '@/components/ui/DataTable';
import { VehicleStatusBadge } from '@/components/ui/StatusBadge';
import { DateChip } from '@/components/ui/DateChip';
import { useToast } from '@/components/ui/Toast';
import { cn, daysFromNow } from '@/lib/utils';
import type { VehicleStatusName } from '@vida/shared';

interface VehicleRow {
  id: string;
  plateNumber: string;
  make: string;
  model: string;
  year: number;
  status: VehicleStatusName;
  branchName: string;
  insuranceExpiry: string | null;
  roadTaxExpiry: string | null;
  coeExpiry: string | null;
  nextServicingDate: string | null;
  currentCustomer?: { fullName: string; customerRef: string } | null;
}

interface PaginatedVehicles {
  data: VehicleRow[];
  total: number;
  page: number;
  pageSize: number;
  totalPages: number;
}

const STATUS_OPTIONS: { value: string; label: string }[] = [
  { value: '', label: 'All Statuses' },
  { value: 'AVAILABLE', label: 'Available' },
  { value: 'RENTED_OUT', label: 'Rented Out' },
  { value: 'MAINTENANCE', label: 'Maintenance' },
  { value: 'RESERVED', label: 'Reserved' },
  { value: 'CLEANING', label: 'Cleaning' },
  { value: 'INSPECTION', label: 'Inspection' },
  { value: 'ACCIDENT_REPAIR', label: 'Accident Repair' },
  { value: 'SOLD', label: 'Sold' },
  { value: 'INACTIVE', label: 'Inactive' },
];

function hasExpiryAlert(row: VehicleRow): boolean {
  const fields = [row.insuranceExpiry, row.roadTaxExpiry, row.coeExpiry, row.nextServicingDate];
  return fields.some(f => {
    const d = daysFromNow(f);
    return d !== null && d <= 30;
  });
}

export default function VehiclesPage() {
  const router = useRouter();
  const { show } = useToast();
  const [vehicles, setVehicles] = useState<VehicleRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [total, setTotal] = useState(0);
  const [totalPages, setTotalPages] = useState(1);
  const [page, setPage] = useState(1);
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('');
  const [branchId, setBranchId] = useState('');
  const [expirySoon, setExpirySoon] = useState(false);
  const [branches, setBranches] = useState<{ id: string; name: string }[]>([]);

  useEffect(() => {
    apiGet<{ id: string; name: string }[]>('/branches').then(setBranches).catch(() => {});
  }, []);

  const load = useCallback(() => {
    setLoading(true);
    apiGet<PaginatedVehicles>('/vehicles', {
      page,
      pageSize: 50,
      search: search || undefined,
      status: statusFilter || undefined,
      branchId: branchId || undefined,
      expirySoon: expirySoon || undefined,
    })
      .then(res => {
        setVehicles(res.data);
        setTotal(res.total);
        setTotalPages(res.totalPages);
      })
      .catch(() => show('Failed to load vehicles', 'error'))
      .finally(() => setLoading(false));
  }, [page, search, statusFilter, branchId, expirySoon, show]);

  useEffect(() => { load(); }, [load]);

  const columns: Column<VehicleRow>[] = [
    {
      key: 'plateNumber',
      header: 'Plate',
      sortable: true,
      cell: r => (
        <a
          href={`/vehicles/${r.plateNumber}`}
          onClick={e => { e.preventDefault(); router.push(`/vehicles/${r.plateNumber}`); }}
          className="font-mono font-semibold text-teal-700 hover:underline text-xs"
        >
          {r.plateNumber}
        </a>
      ),
    },
    {
      key: 'make',
      header: 'Vehicle',
      sortable: true,
      cell: r => (
        <div>
          <p className="text-xs font-medium text-zinc-900">{r.make} {r.model}</p>
          <p className="text-2xs text-zinc-400">{r.year}</p>
        </div>
      ),
    },
    {
      key: 'status',
      header: 'Status',
      sortable: true,
      cell: r => <VehicleStatusBadge status={r.status} />,
    },
    {
      key: 'branchName',
      header: 'Branch',
      cell: r => <span className="text-xs text-zinc-600">{r.branchName}</span>,
    },
    {
      key: 'currentCustomer',
      header: 'Customer',
      cell: r => r.currentCustomer ? (
        <div>
          <p className="text-xs text-zinc-800">{r.currentCustomer.fullName}</p>
          <p className="text-2xs text-zinc-400 font-mono">{r.currentCustomer.customerRef}</p>
        </div>
      ) : <span className="text-2xs text-zinc-300">—</span>,
    },
    {
      key: 'insuranceExpiry',
      header: 'Insurance',
      cell: r => <DateChip date={r.insuranceExpiry} />,
    },
    {
      key: 'roadTaxExpiry',
      header: 'Road Tax',
      cell: r => <DateChip date={r.roadTaxExpiry} />,
    },
    {
      key: 'coeExpiry',
      header: 'COE',
      cell: r => <DateChip date={r.coeExpiry} />,
    },
    {
      key: 'nextServicingDate',
      header: 'Servicing',
      cell: r => <DateChip date={r.nextServicingDate} />,
    },
  ];

  return (
    <div className="p-6 space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-base font-semibold text-zinc-900">Vehicles</h1>
          <p className="text-xs text-zinc-500 mt-0.5">{total.toLocaleString()} vehicles total</p>
        </div>
      </div>

      {/* Filters */}
      <div className="flex flex-wrap gap-2 items-center">
        <input
          type="text"
          placeholder="Search plate, make, model…"
          value={search}
          onChange={e => { setSearch(e.target.value); setPage(1); }}
          className="text-xs border border-zinc-200 rounded-sm px-3 py-1.5 bg-white w-56 focus:outline-none focus:border-teal-500"
        />
        <select
          value={statusFilter}
          onChange={e => { setStatusFilter(e.target.value); setPage(1); }}
          className="text-xs border border-zinc-200 rounded-sm px-2 py-1.5 bg-white focus:outline-none focus:border-teal-500"
        >
          {STATUS_OPTIONS.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
        </select>
        <select
          value={branchId}
          onChange={e => { setBranchId(e.target.value); setPage(1); }}
          className="text-xs border border-zinc-200 rounded-sm px-2 py-1.5 bg-white focus:outline-none focus:border-teal-500"
        >
          <option value="">All Branches</option>
          {branches.map(b => <option key={b.id} value={b.id}>{b.name}</option>)}
        </select>
        <label className="flex items-center gap-1.5 text-xs text-zinc-600 cursor-pointer select-none">
          <input
            type="checkbox"
            checked={expirySoon}
            onChange={e => { setExpirySoon(e.target.checked); setPage(1); }}
            className="rounded border-zinc-300"
          />
          Expiry soon
        </label>
      </div>

      <DataTable
        columns={columns}
        rows={vehicles}
        rowKey={r => r.id}
        loading={loading}
        emptyMessage="No vehicles match the current filters."
        onRowClick={r => router.push(`/vehicles/${r.plateNumber}`)}
      />

      {totalPages > 1 && (
        <div className="flex items-center justify-between text-xs text-zinc-500">
          <span>Page {page} of {totalPages} &bull; {total} vehicles</span>
          <div className="flex gap-1">
            <button disabled={page <= 1} onClick={() => setPage(p => p - 1)}
              className="px-2 py-1 border border-zinc-200 rounded-sm disabled:opacity-40 hover:bg-zinc-50">Prev</button>
            <button disabled={page >= totalPages} onClick={() => setPage(p => p + 1)}
              className="px-2 py-1 border border-zinc-200 rounded-sm disabled:opacity-40 hover:bg-zinc-50">Next</button>
          </div>
        </div>
      )}
    </div>
  );
}
