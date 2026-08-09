'use client';

import { useState, useEffect, useCallback } from 'react';
import { apiGet, apiPost } from '@/lib/api-client';
import { DataTable, type Column } from '@/components/ui/DataTable';
import { MoneyCell } from '@/components/ui/MoneyCell';
import { RiskBar } from '@/components/ui/RiskBar';
import { Can } from '@/lib/permissions';
import { useToast } from '@/components/ui/Toast';
import { Modal } from '@/components/ui/Modal';
import { cn, formatDate } from '@/lib/utils';
import { PERMISSIONS } from '@karrkarr/shared';
import type { CollectionsSummary, CollectionsRow, Paginated, Money } from '@karrkarr/shared';

// ---- Bucket config --------------------------------------------------------

type BucketKey = 'UPCOMING_7' | 'DUE_TODAY' | 'OVERDUE_1_7' | 'OVERDUE_8_PLUS';

const BUCKETS: {
  key: BucketKey | null;
  label: string;
  ring: string;
  bg: string;
  dot: string;
}[] = [
  {
    key: null,
    label: 'All',
    ring: 'border-zinc-300',
    bg: 'bg-white',
    dot: 'bg-zinc-400',
  },
  {
    key: 'UPCOMING_7',
    label: 'Due Next 7 Days',
    ring: 'border-emerald-300',
    bg: 'bg-emerald-50',
    dot: 'bg-emerald-500',
  },
  {
    key: 'DUE_TODAY',
    label: 'Due Today',
    ring: 'border-amber-300',
    bg: 'bg-amber-50',
    dot: 'bg-amber-500',
  },
  {
    key: 'OVERDUE_1_7',
    label: '1–7 Days Overdue',
    ring: 'border-orange-300',
    bg: 'bg-orange-50',
    dot: 'bg-orange-500',
  },
  {
    key: 'OVERDUE_8_PLUS',
    label: '8+ Days Overdue',
    ring: 'border-red-300',
    bg: 'bg-red-50',
    dot: 'bg-red-500',
  },
];

// ---- Audit trail ----------------------------------------------------------

interface AuditEntry {
  id: string;
  date: string;
  type: string;
  amount?: Money;
  note?: string;
  by?: string;
}

function AuditTrail({ customerId }: { customerId: string }) {
  const [entries, setEntries] = useState<AuditEntry[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    interface AuditResponse {
      ledger: Array<{ id: string; date: string; type: string; amount?: { cents: number; currency: string }; note?: string }>;
      submissions: Array<{ id: string; submittedAt: string; status: string; declaredAmountCents: number; transactionRef?: string }>;
      reminders: Array<{ id: string; sentAt: string; channel: string; invoiceNo?: string }>;
      auditLogs: Array<{ id: string; createdAt: string; action: string; adminName?: string; note?: string }>;
    }
    apiGet<AuditResponse>(`/collections/customers/${customerId}/audit-trail`)
      .then(res => {
        const entries: AuditEntry[] = [
          ...(res.ledger ?? []).map(e => ({
            id: e.id,
            date: e.date,
            type: e.type,
            amount: e.amount,
            note: e.note,
          })),
          ...(res.submissions ?? []).map(e => ({
            id: e.id,
            date: e.submittedAt,
            type: `Payment Submission (${e.status})`,
            amount: { cents: e.declaredAmountCents, currency: 'SGD' },
            note: e.transactionRef ? `Ref: ${e.transactionRef}` : undefined,
          })),
          ...(res.reminders ?? []).map(e => ({
            id: e.id,
            date: e.sentAt,
            type: `Reminder (${e.channel})`,
            note: e.invoiceNo ? `Invoice: ${e.invoiceNo}` : undefined,
          })),
          ...(res.auditLogs ?? []).map(e => ({
            id: e.id,
            date: e.createdAt,
            type: e.action,
            note: e.note,
            by: e.adminName,
          })),
        ].sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
        setEntries(entries);
      })
      .catch(() => setEntries([]))
      .finally(() => setLoading(false));
  }, [customerId]);

  if (loading) {
    return (
      <div className="space-y-2 py-2">
        {[1, 2, 3].map(i => (
          <div key={i} className="h-8 bg-zinc-100 rounded animate-pulse" />
        ))}
      </div>
    );
  }

  if (!entries.length) {
    return <p className="text-xs text-zinc-400 py-3">No audit trail entries found.</p>;
  }

  return (
    <div className="space-y-0">
      {entries.map((entry, idx) => (
        <div key={entry.id} className="relative flex gap-3 pb-3">
          {/* Timeline line */}
          {idx < entries.length - 1 && (
            <div className="absolute left-2 top-5 bottom-0 w-px bg-zinc-100" />
          )}
          <div className="w-4 h-4 rounded-full border-2 border-zinc-200 bg-white shrink-0 mt-0.5 relative z-10" />
          <div className="flex-1 min-w-0">
            <div className="flex items-baseline gap-2">
              <p className="text-xs font-medium text-zinc-800">{entry.type}</p>
              {entry.amount && <MoneyCell value={entry.amount} className="text-xs" />}
            </div>
            <div className="flex items-center gap-2 mt-0.5">
              <p className="text-2xs text-zinc-400">{formatDate(entry.date, 'd MMM yyyy HH:mm')}</p>
              {entry.by && <p className="text-2xs text-zinc-400">&bull; {entry.by}</p>}
            </div>
            {entry.note && <p className="text-2xs text-zinc-500 mt-0.5">{entry.note}</p>}
          </div>
        </div>
      ))}
    </div>
  );
}

// ---- Reminder button with tooltip -----------------------------------------

type ReminderChannel = 'EMAIL' | 'WHATSAPP' | 'SMS';

function ReminderButton({
  invoiceId,
  channel,
  canAct,
}: {
  invoiceId: string;
  channel: ReminderChannel;
  canAct: boolean;
}) {
  const { show } = useToast();
  const [loading, setLoading] = useState(false);
  const isEnabled = channel === 'EMAIL';
  const isDisabled = !canAct || !isEnabled;

  const label = { EMAIL: 'Email', WHATSAPP: 'WhatsApp', SMS: 'SMS' }[channel];
  const tooltip = !canAct
    ? 'You do not have permission to send reminders'
    : !isEnabled
      ? `${label} adapter not yet wired — coming soon`
      : undefined;

  async function handleClick() {
    if (isDisabled) return;
    setLoading(true);
    try {
      await apiPost(`/collections/invoices/${invoiceId}/remind`, { channel });
      show(`${label} reminder sent`, 'success');
    } catch {
      show(`Failed to send ${label} reminder`, 'error');
    } finally {
      setLoading(false);
    }
  }

  return (
    <span className="relative group inline-block">
      <button
        onClick={handleClick}
        disabled={isDisabled || loading}
        className={cn(
          'px-1.5 py-0.5 text-2xs font-medium border rounded transition-colors',
          isEnabled && canAct
            ? 'border-teal-300 text-teal-700 bg-teal-50 hover:bg-teal-100 active:bg-teal-200'
            : 'border-zinc-200 text-zinc-400 bg-zinc-50 cursor-not-allowed',
          loading && 'opacity-50',
        )}
      >
        {loading ? '…' : label}
      </button>
      {tooltip && (
        <span className="pointer-events-none absolute bottom-full left-1/2 -translate-x-1/2 mb-1 w-40 text-center text-2xs text-white bg-zinc-800 rounded px-2 py-1 opacity-0 group-hover:opacity-100 transition-opacity z-10 whitespace-normal">
          {tooltip}
        </span>
      )}
    </span>
  );
}

// ---- Main component -------------------------------------------------------

export default function CollectionsPage() {
  const { show } = useToast();
  const [summary, setSummary] = useState<CollectionsSummary | null>(null);
  const [rows, setRows] = useState<CollectionsRow[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [loading, setLoading] = useState(true);
  const [summaryLoading, setSummaryLoading] = useState(true);
  const [bucket, setBucket] = useState<BucketKey | null>(null);
  const [search, setSearch] = useState('');
  const [branchId, setBranchId] = useState<string | undefined>(undefined);
  const [branches, setBranches] = useState<{ id: string; name: string }[]>([]);

  // Permission check
  const [canAct, setCanAct] = useState(false);

  useEffect(() => {
    try {
      const raw = sessionStorage.getItem('karrkarr_admin_session');
      if (raw) {
        const u = JSON.parse(raw);
        const { ROLE_PERMISSIONS } = require('@karrkarr/shared');
        const perms: string[] = ROLE_PERMISSIONS[u.role] ?? [];
        setCanAct(perms.includes(PERMISSIONS.COLLECTIONS_ACTION));
      }
    } catch {}
  }, []);

  useEffect(() => {
    apiGet<{ data: { id: string; name: string }[]; total: number }>('/branches').then(res => setBranches(res.data ?? [])).catch(() => {});
  }, []);

  const loadSummary = useCallback(() => {
    setSummaryLoading(true);
    apiGet<CollectionsSummary>('/collections/summary', branchId ? { branchId } : undefined)
      .then(setSummary)
      .catch(() => show('Failed to load summary', 'error'))
      .finally(() => setSummaryLoading(false));
  }, [branchId, show]);

  const loadRows = useCallback(() => {
    setLoading(true);
    apiGet<Paginated<CollectionsRow>>('/collections/rows', {
      page,
      pageSize: 50,
      ...(branchId ? { branchId } : {}),
      ...(bucket ? { bucket } : {}),
    })
      .then(res => {
        setRows(res.data);
        setTotal(res.total);
      })
      .catch(() => show('Failed to load collections rows', 'error'))
      .finally(() => setLoading(false));
  }, [page, branchId, bucket, show]);

  useEffect(() => { loadSummary(); }, [loadSummary]);
  useEffect(() => { loadRows(); }, [loadRows]);

  const filteredRows = search
    ? rows.filter(r =>
        r.customerName.toLowerCase().includes(search.toLowerCase()) ||
        r.plateNumber.toLowerCase().includes(search.toLowerCase()) ||
        r.invoiceNo.toLowerCase().includes(search.toLowerCase()),
      )
    : rows;

  const columns: Column<CollectionsRow>[] = [
    {
      key: 'customerName',
      header: 'Customer',
      sortable: true,
      cell: r => (
        <div>
          <p className="text-xs font-medium text-zinc-900">{r.customerName}</p>
          <p className="text-2xs text-zinc-400">{r.customerRef}</p>
        </div>
      ),
    },
    {
      key: 'plateNumber',
      header: 'Plate',
      sortable: true,
      cell: r => (
        <a href={`/vehicles/${r.plateNumber}`} className="text-xs font-mono font-semibold text-teal-700 hover:underline">
          {r.plateNumber}
        </a>
      ),
    },
    {
      key: 'invoiceNo',
      header: 'Invoice',
      sortable: true,
      cell: r => <span className="text-xs font-mono text-zinc-600">{r.invoiceNo}</span>,
    },
    {
      key: 'dueDate',
      header: 'Due Date',
      sortable: true,
      cell: r => <span className="text-xs tabular-nums">{formatDate(r.dueDate)}</span>,
    },
    {
      key: 'daysOverdue',
      header: 'Days OD',
      sortable: true,
      align: 'right',
      cell: r => (
        <span
          className={cn(
            'text-xs tabular-nums font-semibold',
            r.daysOverdue >= 8 ? 'text-red-600' :
            r.daysOverdue >= 1 ? 'text-orange-600' :
            r.daysOverdue === 0 ? 'text-amber-600' :
            'text-emerald-600',
          )}
        >
          {r.daysOverdue > 0 ? `+${r.daysOverdue}` : r.daysOverdue === 0 ? 'Today' : `${r.daysOverdue}d`}
        </span>
      ),
    },
    {
      key: 'principal',
      header: 'Principal',
      align: 'right',
      sortable: true,
      cell: r => <MoneyCell value={r.principal} className="text-xs" />,
    },
    {
      key: 'interest',
      header: 'Interest',
      align: 'right',
      cell: r => (
        <MoneyCell
          value={r.interest}
          dim={r.interest.cents === 0}
          className="text-xs"
        />
      ),
    },
    {
      key: 'totalDue',
      header: 'Total Due',
      align: 'right',
      sortable: true,
      cell: r => <MoneyCell value={r.totalDue} className="text-xs font-semibold" />,
    },
    {
      key: 'riskScore',
      header: 'Risk',
      sortable: true,
      cell: r => <RiskBar score={r.riskScore} />,
    },
    {
      key: 'remindersSent',
      header: 'Reminded',
      align: 'center',
      cell: r => (
        <div className="text-center">
          <span className="text-xs tabular-nums text-zinc-500">{r.remindersSent}</span>
          {r.lastReminderAt && (
            <p className="text-2xs text-zinc-400">{formatDate(r.lastReminderAt, 'd MMM')}</p>
          )}
        </div>
      ),
    },
    {
      key: 'actions',
      header: 'Remind',
      cell: r => (
        <div className="flex items-center gap-1">
          <ReminderButton invoiceId={r.invoiceId} channel="EMAIL" canAct={canAct} />
          <ReminderButton invoiceId={r.invoiceId} channel="WHATSAPP" canAct={canAct} />
          <ReminderButton invoiceId={r.invoiceId} channel="SMS" canAct={canAct} />
        </div>
      ),
    },
  ];

  return (
    <div className="p-6 space-y-5">
      {/* Header */}
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-base font-semibold text-zinc-900">Collections</h1>
          <p className="text-xs text-zinc-500 mt-0.5">
            {total.toLocaleString()} invoices outstanding
          </p>
        </div>
        <div className="flex items-center gap-2">
          <select
            className="text-xs border border-zinc-200 rounded-sm px-2 py-1 bg-white text-zinc-700 focus:outline-none focus:border-teal-500"
            value={branchId ?? ''}
            onChange={e => setBranchId(e.target.value || undefined)}
          >
            <option value="">All Branches</option>
            {branches.map(b => <option key={b.id} value={b.id}>{b.name}</option>)}
          </select>
        </div>
      </div>

      {/* Summary tiles */}
      {summaryLoading ? (
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-2">
          {[1, 2, 3, 4].map(i => <div key={i} className="h-20 bg-zinc-100 rounded animate-pulse" />)}
        </div>
      ) : summary ? (
        <>
          {/* Totals row */}
          <div className="grid grid-cols-2 gap-2">
            <div className="bg-white border border-zinc-200 rounded-sm px-4 py-3">
              <p className="text-2xs font-semibold uppercase tracking-wide text-zinc-400">Total Outstanding</p>
              <p className="mt-1 text-xl font-semibold tabular-nums"><MoneyCell value={summary.totalReceivables} /></p>
            </div>
            <div className="bg-white border border-zinc-200 rounded-sm px-4 py-3">
              <p className="text-2xs font-semibold uppercase tracking-wide text-zinc-400">Interest Accrued</p>
              <p className="mt-1 text-xl font-semibold tabular-nums text-orange-600"><MoneyCell value={summary.interestAccrued} /></p>
            </div>
          </div>

          {/* Traffic-light buckets */}
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-2">
            {(
              [
                { key: 'dueNext7Days' as const, cfg: BUCKETS[1] },
                { key: 'dueToday' as const, cfg: BUCKETS[2] },
                { key: 'overdue1to7' as const, cfg: BUCKETS[3] },
                { key: 'overdue8Plus' as const, cfg: BUCKETS[4] },
              ] as const
            ).map(({ key, cfg }) => {
              const s = summary[key];
              const isActive = bucket === cfg.key;
              return (
                <button
                  key={key}
                  onClick={() => setBucket(isActive ? null : (cfg.key as BucketKey))}
                  className={cn(
                    'text-left p-3 border rounded-sm transition-all',
                    cfg.bg,
                    isActive ? `${cfg.ring} ring-1 ring-offset-0` : 'border-zinc-200 hover:border-zinc-300',
                  )}
                >
                  <div className="flex items-center gap-1.5 mb-1">
                    <span className={cn('w-2 h-2 rounded-full', cfg.dot)} />
                    <span className="text-2xs font-medium text-zinc-600">{cfg.label}</span>
                  </div>
                  <p className="text-lg font-semibold tabular-nums text-zinc-900">{s.count}</p>
                  <p className="text-xs tabular-nums text-zinc-500 mt-0.5"><MoneyCell value={s.total} /></p>
                </button>
              );
            })}
          </div>
        </>
      ) : null}

      {/* Search + table */}
      <div className="space-y-2">
        <div className="flex items-center gap-2">
          <input
            type="text"
            placeholder="Search customer, plate, invoice…"
            className="text-xs border border-zinc-200 rounded-sm px-3 py-1.5 bg-white w-72 focus:outline-none focus:border-teal-500"
            value={search}
            onChange={e => setSearch(e.target.value)}
          />
          {bucket && (
            <button
              onClick={() => setBucket(null)}
              className="text-xs text-zinc-500 hover:text-zinc-800 border border-zinc-200 rounded-sm px-2 py-1"
            >
              Clear filter
            </button>
          )}
        </div>

        <DataTable
          columns={columns}
          rows={filteredRows}
          rowKey={r => r.invoiceId}
          loading={loading}
          emptyMessage="No collections found for the selected filters."
          expandRow={r => <AuditTrail customerId={r.customerId} />}
        />

        {/* Pagination */}
        {total > 50 && (
          <div className="flex items-center justify-between text-xs text-zinc-500">
            <span>Page {page} of {Math.ceil(total / 50)}</span>
            <div className="flex gap-1">
              <button
                disabled={page <= 1}
                onClick={() => setPage(p => p - 1)}
                className="px-2 py-1 border border-zinc-200 rounded-sm disabled:opacity-40 hover:bg-zinc-50"
              >
                Prev
              </button>
              <button
                disabled={page >= Math.ceil(total / 50)}
                onClick={() => setPage(p => p + 1)}
                className="px-2 py-1 border border-zinc-200 rounded-sm disabled:opacity-40 hover:bg-zinc-50"
              >
                Next
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
