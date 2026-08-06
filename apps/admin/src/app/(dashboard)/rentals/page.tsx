'use client';

import { useState, useEffect, useCallback } from 'react';
import { apiGet } from '@/lib/api-client';
import { DataTable, type Column } from '@/components/ui/DataTable';
import { InvoiceStatusBadge } from '@/components/ui/StatusBadge';
import { MoneyCents } from '@/components/ui/MoneyCell';
import { useToast } from '@/components/ui/Toast';
import { formatDate, cn } from '@/lib/utils';

interface RentalRow {
  id: string;
  agreementNo: string;
  status: string;
  customerName: string;
  customerRef: string;
  plateNumber: string;
  startDate: string;
  endDate: string;
  billingFrequency: 'WEEKLY' | 'MONTHLY';
  nextPaymentDate: string | null;
  rentAmountCents: number;
  depositPaidCents: number;
  outstandingCents: number;
  lateChargesCents: number;
  branchName: string;
}

interface Paginated {
  data: RentalRow[];
  total: number;
  page: number;
  pageSize: number;
  totalPages: number;
}

const RENTAL_STATUSES = ['', 'ACTIVE', 'DRAFT', 'ENDING_SOON', 'COMPLETED', 'TERMINATED_EARLY', 'CANCELLED'];

export default function RentalsPage() {
  const { show } = useToast();
  const [rentals, setRentals] = useState<RentalRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [total, setTotal] = useState(0);
  const [totalPages, setTotalPages] = useState(1);
  const [page, setPage] = useState(1);
  const [statusFilter, setStatusFilter] = useState('ACTIVE');
  const [search, setSearch] = useState('');

  const load = useCallback(() => {
    setLoading(true);
    apiGet<Paginated>('/rentals', {
      page, pageSize: 50,
      status: statusFilter || undefined,
      search: search || undefined,
    })
      .then(res => { setRentals(res.data); setTotal(res.total); setTotalPages(res.totalPages); })
      .catch(() => show('Failed to load rentals', 'error'))
      .finally(() => setLoading(false));
  }, [page, statusFilter, search, show]);

  useEffect(() => { load(); }, [load]);

  const columns: Column<RentalRow>[] = [
    {
      key: 'agreementNo',
      header: 'Agreement',
      cell: r => <span className="text-xs font-mono text-zinc-700">{r.agreementNo}</span>,
    },
    {
      key: 'customerName',
      header: 'Customer',
      sortable: true,
      cell: r => (
        <div>
          <p className="text-xs font-medium text-zinc-900">{r.customerName}</p>
          <p className="text-2xs text-zinc-400 font-mono">{r.customerRef}</p>
        </div>
      ),
    },
    {
      key: 'plateNumber',
      header: 'Plate',
      cell: r => (
        <a href={`/vehicles/${r.plateNumber}`} className="text-xs font-mono font-semibold text-teal-700 hover:underline">
          {r.plateNumber}
        </a>
      ),
    },
    {
      key: 'status',
      header: 'Status',
      cell: r => (
        <span className={cn(
          'inline-flex px-1.5 py-0.5 text-2xs font-medium rounded border',
          r.status === 'ACTIVE' ? 'bg-emerald-50 border-emerald-200 text-emerald-700' :
          r.status === 'ENDING_SOON' ? 'bg-amber-50 border-amber-200 text-amber-700' :
          r.status === 'TERMINATED_EARLY' ? 'bg-red-50 border-red-200 text-red-700' :
          'bg-zinc-50 border-zinc-200 text-zinc-600',
        )}>
          {r.status.replace('_', ' ')}
        </span>
      ),
    },
    {
      key: 'dates',
      header: 'Period',
      cell: r => (
        <span className="text-xs text-zinc-600 whitespace-nowrap">
          {formatDate(r.startDate, 'd MMM yy')} – {formatDate(r.endDate, 'd MMM yy')}
        </span>
      ),
    },
    {
      key: 'nextPaymentDate',
      header: 'Next Payment',
      cell: r => r.nextPaymentDate ? (
        <span className="text-xs tabular-nums">{formatDate(r.nextPaymentDate)}</span>
      ) : <span className="text-2xs text-zinc-300">—</span>,
    },
    {
      key: 'billingFrequency',
      header: 'Freq',
      cell: r => <span className="text-2xs text-zinc-500">{r.billingFrequency === 'WEEKLY' ? 'Wkly' : 'Mthly'}</span>,
    },
    {
      key: 'rentAmountCents',
      header: 'Rent',
      align: 'right',
      sortable: true,
      cell: r => <MoneyCents cents={r.rentAmountCents} className="text-xs" />,
    },
    {
      key: 'depositPaidCents',
      header: 'Deposit',
      align: 'right',
      cell: r => <MoneyCents cents={r.depositPaidCents} className="text-xs" dim />,
    },
    {
      key: 'outstandingCents',
      header: 'Outstanding',
      align: 'right',
      sortable: true,
      cell: r => (
        <MoneyCents
          cents={r.outstandingCents}
          className={cn('text-xs', r.outstandingCents > 0 ? 'text-orange-600 font-semibold' : '')}
        />
      ),
    },
    {
      key: 'lateChargesCents',
      header: 'Late Charges',
      align: 'right',
      cell: r => (
        <MoneyCents
          cents={r.lateChargesCents}
          className={cn('text-xs', r.lateChargesCents > 0 ? 'text-red-600' : 'text-zinc-300')}
        />
      ),
    },
  ];

  return (
    <div className="p-6 space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-base font-semibold text-zinc-900">Rentals</h1>
          <p className="text-xs text-zinc-500 mt-0.5">{total.toLocaleString()} agreements</p>
        </div>
      </div>

      <div className="flex flex-wrap gap-2">
        <input
          type="text"
          placeholder="Search customer, plate, agreement…"
          value={search}
          onChange={e => { setSearch(e.target.value); setPage(1); }}
          className="text-xs border border-zinc-200 rounded-sm px-3 py-1.5 bg-white w-60 focus:outline-none focus:border-teal-500"
        />
        <select
          value={statusFilter}
          onChange={e => { setStatusFilter(e.target.value); setPage(1); }}
          className="text-xs border border-zinc-200 rounded-sm px-2 py-1.5 bg-white focus:outline-none focus:border-teal-500"
        >
          {RENTAL_STATUSES.map(s => (
            <option key={s} value={s}>{s || 'All Statuses'}</option>
          ))}
        </select>
      </div>

      <DataTable columns={columns} rows={rentals} rowKey={r => r.id} loading={loading} emptyMessage="No rentals found." />

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
