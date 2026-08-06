'use client';

import { useState, useEffect, useCallback } from 'react';
import { apiGet } from '@/lib/api-client';
import { DataTable, type Column } from '@/components/ui/DataTable';
import { DateChip } from '@/components/ui/DateChip';
import { MoneyCents } from '@/components/ui/MoneyCell';
import { useToast } from '@/components/ui/Toast';
import { formatDate, cn } from '@/lib/utils';

interface MaintenanceRecord {
  id: string;
  vehiclePlate: string;
  vehicleMake: string;
  vehicleModel: string;
  serviceDate: string;
  workshopName: string;
  description: string;
  costCents: number;
  mileage: number;
  nextServiceDueDate: string | null;
  branchName: string;
  status: 'SCHEDULED' | 'IN_PROGRESS' | 'COMPLETED' | 'CANCELLED';
}

interface PaginatedMaintenance {
  data: MaintenanceRecord[];
  total: number;
  page: number;
  totalPages: number;
}

const STATUS_COLORS: Record<string, string> = {
  SCHEDULED:   'bg-blue-50 border-blue-200 text-blue-700',
  IN_PROGRESS: 'bg-amber-50 border-amber-200 text-amber-700',
  COMPLETED:   'bg-emerald-50 border-emerald-200 text-emerald-700',
  CANCELLED:   'bg-zinc-50 border-zinc-200 text-zinc-500',
};

export default function MaintenancePage() {
  const { show } = useToast();
  const [records, setRecords] = useState<MaintenanceRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [statusFilter, setStatusFilter] = useState('');
  const [search, setSearch] = useState('');

  const load = useCallback(() => {
    setLoading(true);
    apiGet<PaginatedMaintenance>('/maintenance', {
      page,
      pageSize: 50,
      status: statusFilter || undefined,
      search: search || undefined,
    })
      .then(res => { setRecords(res.data); setTotal(res.total); setTotalPages(res.totalPages); })
      .catch(() => show('Failed to load maintenance records', 'error'))
      .finally(() => setLoading(false));
  }, [page, statusFilter, search, show]);

  useEffect(() => { load(); }, [load]);

  const columns: Column<MaintenanceRecord>[] = [
    {
      key: 'vehiclePlate',
      header: 'Plate',
      cell: r => (
        <a href={`/vehicles/${r.vehiclePlate}`} className="text-xs font-mono font-semibold text-teal-700 hover:underline">
          {r.vehiclePlate}
        </a>
      ),
    },
    {
      key: 'vehicle',
      header: 'Vehicle',
      cell: r => <span className="text-xs text-zinc-700">{r.vehicleMake} {r.vehicleModel}</span>,
    },
    {
      key: 'status',
      header: 'Status',
      cell: r => (
        <span className={cn('text-2xs px-1.5 py-0.5 rounded border font-medium', STATUS_COLORS[r.status] ?? '')}>
          {r.status.replace('_', ' ')}
        </span>
      ),
    },
    {
      key: 'serviceDate',
      header: 'Service Date',
      sortable: true,
      cell: r => <span className="text-xs tabular-nums">{formatDate(r.serviceDate)}</span>,
    },
    {
      key: 'workshopName',
      header: 'Workshop',
      cell: r => <span className="text-xs text-zinc-700">{r.workshopName}</span>,
    },
    {
      key: 'description',
      header: 'Description',
      cell: r => <span className="text-xs text-zinc-600 max-w-xs truncate block">{r.description}</span>,
    },
    {
      key: 'costCents',
      header: 'Cost',
      align: 'right',
      sortable: true,
      cell: r => <MoneyCents cents={r.costCents} className="text-xs" />,
    },
    {
      key: 'mileage',
      header: 'Mileage',
      align: 'right',
      cell: r => <span className="text-xs tabular-nums">{r.mileage.toLocaleString()}</span>,
    },
    {
      key: 'nextServiceDueDate',
      header: 'Next Service',
      cell: r => <DateChip date={r.nextServiceDueDate} />,
    },
    {
      key: 'branchName',
      header: 'Branch',
      cell: r => <span className="text-xs text-zinc-500">{r.branchName}</span>,
    },
  ];

  const totalCost = records.reduce((s, r) => s + r.costCents, 0);

  return (
    <div className="p-6 space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-base font-semibold text-zinc-900">Maintenance</h1>
          <p className="text-xs text-zinc-500 mt-0.5">
            {total.toLocaleString()} records &bull; Page total: <MoneyCents cents={totalCost} className="text-xs" />
          </p>
        </div>
      </div>

      <div className="flex flex-wrap gap-2">
        <input
          type="text"
          placeholder="Search plate, workshop, description…"
          value={search}
          onChange={e => { setSearch(e.target.value); setPage(1); }}
          className="text-xs border border-zinc-200 rounded-sm px-3 py-1.5 bg-white w-60 focus:outline-none focus:border-teal-500"
        />
        <select
          value={statusFilter}
          onChange={e => { setStatusFilter(e.target.value); setPage(1); }}
          className="text-xs border border-zinc-200 rounded-sm px-2 py-1.5 bg-white focus:outline-none focus:border-teal-500"
        >
          <option value="">All Statuses</option>
          <option value="SCHEDULED">Scheduled</option>
          <option value="IN_PROGRESS">In Progress</option>
          <option value="COMPLETED">Completed</option>
          <option value="CANCELLED">Cancelled</option>
        </select>
      </div>

      <DataTable columns={columns} rows={records} rowKey={r => r.id} loading={loading} emptyMessage="No maintenance records." />

      {totalPages > 1 && (
        <div className="flex items-center justify-between text-xs text-zinc-500">
          <span>Page {page} of {totalPages}</span>
          <div className="flex gap-1">
            <button disabled={page <= 1} onClick={() => setPage(p => p - 1)} className="px-2 py-1 border border-zinc-200 rounded-sm disabled:opacity-40">Prev</button>
            <button disabled={page >= totalPages} onClick={() => setPage(p => p + 1)} className="px-2 py-1 border border-zinc-200 rounded-sm disabled:opacity-40">Next</button>
          </div>
        </div>
      )}
    </div>
  );
}
