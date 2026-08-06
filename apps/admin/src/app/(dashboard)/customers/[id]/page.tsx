'use client';

import { useState, useEffect, use } from 'react';
import { apiGet } from '@/lib/api-client';
import { InvoiceStatusBadge } from '@/components/ui/StatusBadge';
import { RiskBar } from '@/components/ui/RiskBar';
import { MoneyCents } from '@/components/ui/MoneyCell';
import { Can } from '@/lib/permissions';
import { useToast } from '@/components/ui/Toast';
import { formatDate, cn } from '@/lib/utils';
import { PERMISSIONS } from '@karrkarr/shared';

interface CustomerDetail {
  id: string;
  customerRef: string;
  fullName: string;
  email: string;
  phone: string;
  nric: string; // masked unless pii_read
  licenceNo: string;
  riskScore: number;
  createdAt: string;
  branchName: string;
  address: string;
  emergencyContact: string;
  emergencyPhone: string;
}

interface RentalSummary {
  id: string;
  agreementNo: string;
  plateNumber: string;
  status: string;
  startDate: string;
  endDate: string;
  outstandingCents: number;
}

interface Invoice {
  id: string;
  invoiceNo: string;
  status: string;
  dueDate: string;
  amountCents: number;
  outstandingCents: number;
  paidAt: string | null;
}

type Tab = 'profile' | 'rentals' | 'invoices' | 'documents';

function InfoRow({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div className="flex items-start py-1.5 border-b border-zinc-50 gap-2">
      <span className="text-2xs text-zinc-400 w-32 shrink-0 pt-0.5 uppercase tracking-wide">{label}</span>
      <span className="text-xs text-zinc-800 flex-1">{value ?? '—'}</span>
    </div>
  );
}

export default function CustomerPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const { show } = useToast();

  const [customer, setCustomer] = useState<CustomerDetail | null>(null);
  const [rentals, setRentals] = useState<RentalSummary[]>([]);
  const [invoices, setInvoices] = useState<Invoice[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<Tab>('profile');

  useEffect(() => {
    setLoading(true);
    Promise.all([
      apiGet<CustomerDetail>(`/customers/${id}`),
      apiGet<RentalSummary[]>(`/customers/${id}/rentals`),
      apiGet<Invoice[]>(`/customers/${id}/invoices`),
    ])
      .then(([c, r, inv]) => { setCustomer(c); setRentals(r); setInvoices(inv); })
      .catch(() => show('Failed to load customer', 'error'))
      .finally(() => setLoading(false));
  }, [id, show]);

  if (loading) return <div className="p-6"><div className="h-48 bg-zinc-100 rounded animate-pulse" /></div>;
  if (!customer) return <div className="p-6 text-sm text-red-600">Customer not found.</div>;

  const TABS: { key: Tab; label: string }[] = [
    { key: 'profile', label: 'Profile' },
    { key: 'rentals', label: `Rentals (${rentals.length})` },
    { key: 'invoices', label: `Invoices (${invoices.length})` },
    { key: 'documents', label: 'Documents' },
  ];

  const totalOutstanding = rentals.reduce((s, r) => s + r.outstandingCents, 0);

  return (
    <div className="p-6 space-y-4">
      <div className="flex items-center gap-1.5 text-xs text-zinc-400">
        <a href="/customers" className="hover:text-teal-600">Customers</a>
        <span>/</span>
        <span className="text-zinc-700">{customer.fullName}</span>
      </div>

      <div className="flex items-start justify-between gap-4">
        <div>
          <h1 className="text-base font-semibold text-zinc-900">{customer.fullName}</h1>
          <p className="text-xs text-zinc-400 font-mono mt-0.5">{customer.customerRef}</p>
        </div>
        <div className="text-right">
          <p className="text-2xs text-zinc-400">Risk Score</p>
          <RiskBar score={customer.riskScore} showLabel />
        </div>
      </div>

      {totalOutstanding > 0 && (
        <div className="bg-orange-50 border border-orange-200 rounded-sm px-4 py-2 flex items-center justify-between">
          <p className="text-xs font-medium text-orange-800">Outstanding Balance</p>
          <MoneyCents cents={totalOutstanding} className="text-sm font-semibold text-orange-700" />
        </div>
      )}

      <div className="border-b border-zinc-200">
        <div className="flex gap-0">
          {TABS.map(t => (
            <button
              key={t.key}
              onClick={() => setActiveTab(t.key)}
              className={cn(
                'px-3 py-2 text-xs font-medium border-b-2 transition-colors',
                activeTab === t.key ? 'border-teal-500 text-teal-700' : 'border-transparent text-zinc-500 hover:text-zinc-800',
              )}
            >
              {t.label}
            </button>
          ))}
        </div>
      </div>

      {activeTab === 'profile' && (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          <div>
            <p className="text-2xs font-semibold uppercase tracking-widest text-zinc-400 mb-2">Contact</p>
            <div className="bg-white border border-zinc-200 rounded-sm px-4 py-1">
              <InfoRow label="Full Name" value={customer.fullName} />
              <InfoRow label="Email" value={customer.email} />
              <InfoRow label="Phone" value={customer.phone} />
              <InfoRow label="Address" value={customer.address} />
              <InfoRow label="Emergency" value={`${customer.emergencyContact} ${customer.emergencyPhone}`} />
            </div>
          </div>
          <div>
            <p className="text-2xs font-semibold uppercase tracking-widest text-zinc-400 mb-2">Identity</p>
            <div className="bg-white border border-zinc-200 rounded-sm px-4 py-1">
              <InfoRow label="NRIC" value={
                <Can permission={PERMISSIONS.CUSTOMER_PII_READ} fallback={<span className="font-mono">{customer.nric}</span>}>
                  <span className="font-mono">{customer.nric}</span>
                </Can>
              } />
              <InfoRow label="Licence No." value={
                <Can permission={PERMISSIONS.CUSTOMER_PII_READ} fallback={<span className="text-zinc-300">Restricted</span>}>
                  <span className="font-mono">{customer.licenceNo}</span>
                </Can>
              } />
              <InfoRow label="Branch" value={customer.branchName} />
              <InfoRow label="Since" value={formatDate(customer.createdAt)} />
            </div>
          </div>
        </div>
      )}

      {activeTab === 'rentals' && (
        <div className="space-y-2">
          {rentals.length === 0 ? (
            <p className="text-sm text-zinc-400 py-6 text-center">No rentals.</p>
          ) : rentals.map(r => (
            <div key={r.id} className="bg-white border border-zinc-200 rounded-sm px-4 py-3 flex items-center justify-between gap-4">
              <div>
                <div className="flex items-center gap-2">
                  <span className="text-xs font-mono text-zinc-700">{r.agreementNo}</span>
                  <a href={`/vehicles/${r.plateNumber}`} className="text-xs font-mono font-semibold text-teal-700 hover:underline">{r.plateNumber}</a>
                  <span className={cn('text-2xs px-1 py-0.5 rounded border',
                    r.status === 'ACTIVE' ? 'bg-emerald-50 border-emerald-200 text-emerald-700' : 'bg-zinc-50 border-zinc-200 text-zinc-500'
                  )}>{r.status}</span>
                </div>
                <p className="text-2xs text-zinc-400 mt-0.5">
                  {formatDate(r.startDate)} – {formatDate(r.endDate)}
                </p>
              </div>
              {r.outstandingCents > 0 && (
                <MoneyCents cents={r.outstandingCents} className="text-xs font-semibold text-orange-600" />
              )}
            </div>
          ))}
        </div>
      )}

      {activeTab === 'invoices' && (
        <div className="overflow-x-auto">
          <table className="w-full text-xs border-collapse">
            <thead>
              <tr className="border-b border-zinc-200 bg-zinc-50">
                <th className="px-3 py-2 text-left text-2xs font-semibold uppercase tracking-wide text-zinc-400">Invoice</th>
                <th className="px-3 py-2 text-left text-2xs font-semibold uppercase tracking-wide text-zinc-400">Status</th>
                <th className="px-3 py-2 text-left text-2xs font-semibold uppercase tracking-wide text-zinc-400">Due Date</th>
                <th className="px-3 py-2 text-right text-2xs font-semibold uppercase tracking-wide text-zinc-400">Amount</th>
                <th className="px-3 py-2 text-right text-2xs font-semibold uppercase tracking-wide text-zinc-400">Outstanding</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-zinc-100">
              {invoices.map(inv => (
                <tr key={inv.id} className="hover:bg-zinc-50">
                  <td className="px-3 py-2 font-mono text-zinc-700">{inv.invoiceNo}</td>
                  <td className="px-3 py-2">
                    <InvoiceStatusBadge status={inv.status as any} />
                  </td>
                  <td className="px-3 py-2 tabular-nums">{formatDate(inv.dueDate)}</td>
                  <td className="px-3 py-2 text-right tabular-nums"><MoneyCents cents={inv.amountCents} /></td>
                  <td className="px-3 py-2 text-right tabular-nums">
                    <MoneyCents cents={inv.outstandingCents} className={inv.outstandingCents > 0 ? 'text-orange-600 font-semibold' : 'text-zinc-300'} />
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {activeTab === 'documents' && (
        <p className="text-sm text-zinc-400 py-6 text-center">Document uploads coming soon.</p>
      )}
    </div>
  );
}
