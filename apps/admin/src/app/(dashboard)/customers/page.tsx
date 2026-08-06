'use client';

import { useState, useEffect, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { apiGet } from '@/lib/api-client';
import { DataTable, type Column } from '@/components/ui/DataTable';
import { RiskBar } from '@/components/ui/RiskBar';
import { MoneyCents } from '@/components/ui/MoneyCell';
import { useToast } from '@/components/ui/Toast';
import { formatDate } from '@/lib/utils';

interface CustomerRow {
  id: string;
  customerRef: string;
  fullName: string;
  email: string;
  phone: string;
  nricLast4: string;
  activeRentalCount: number;
  outstandingCents: number;
  riskScore: number;
  createdAt: string;
  branchName: string;
}

interface Paginated {
  data: CustomerRow[];
  total: number;
  page: number;
  totalPages: number;
}

export default function CustomersPage() {
  const router = useRouter();
  const { show } = useToast();
  const [customers, setCustomers] = useState<CustomerRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [total, setTotal] = useState(0);
  const [totalPages, setTotalPages] = useState(1);
  const [page, setPage] = useState(1);
  const [search, setSearch] = useState('');

  const load = useCallback(() => {
    setLoading(true);
    apiGet<Paginated>('/customers', { page, pageSize: 50, search: search || undefined })
      .then(res => { setCustomers(res.data); setTotal(res.total); setTotalPages(res.totalPages); })
      .catch(() => show('Failed to load customers', 'error'))
      .finally(() => setLoading(false));
  }, [page, search, show]);

  useEffect(() => { load(); }, [load]);

  const columns: Column<CustomerRow>[] = [
    {
      key: 'customerRef',
      header: 'Ref',
      cell: r => <span className="text-2xs font-mono text-zinc-500">{r.customerRef}</span>,
    },
    {
      key: 'fullName',
      header: 'Name',
      sortable: true,
      cell: r => (
        <div>
          <p className="text-xs font-medium text-zinc-900">{r.fullName}</p>
          <p className="text-2xs text-zinc-400">{r.email}</p>
        </div>
      ),
    },
    {
      key: 'phone',
      header: 'Phone',
      cell: r => <span className="text-xs text-zinc-600">{r.phone}</span>,
    },
    {
      key: 'nricLast4',
      header: 'NRIC',
      cell: r => <span className="text-xs font-mono text-zinc-400">****{r.nricLast4}</span>,
    },
    {
      key: 'activeRentalCount',
      header: 'Rentals',
      align: 'center',
      cell: r => <span className="text-xs tabular-nums">{r.activeRentalCount}</span>,
    },
    {
      key: 'outstandingCents',
      header: 'Outstanding',
      align: 'right',
      sortable: true,
      cell: r => (
        <MoneyCents
          cents={r.outstandingCents}
          className={r.outstandingCents > 0 ? 'text-xs text-orange-600 font-semibold' : 'text-xs'}
        />
      ),
    },
    {
      key: 'riskScore',
      header: 'Risk',
      sortable: true,
      cell: r => <RiskBar score={r.riskScore} showLabel />,
    },
    {
      key: 'branchName',
      header: 'Branch',
      cell: r => <span className="text-xs text-zinc-500">{r.branchName}</span>,
    },
  ];

  return (
    <div className="p-6 space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-base font-semibold text-zinc-900">Customers</h1>
          <p className="text-xs text-zinc-500 mt-0.5">{total.toLocaleString()} customers</p>
        </div>
      </div>

      <input
        type="text"
        placeholder="Search name, email, phone, ref…"
        value={search}
        onChange={e => { setSearch(e.target.value); setPage(1); }}
        className="text-xs border border-zinc-200 rounded-sm px-3 py-1.5 bg-white w-72 focus:outline-none focus:border-teal-500"
      />

      <DataTable
        columns={columns}
        rows={customers}
        rowKey={r => r.id}
        loading={loading}
        emptyMessage="No customers found."
        onRowClick={r => router.push(`/customers/${r.id}`)}
      />

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
