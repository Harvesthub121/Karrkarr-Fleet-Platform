'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import { apiGet } from '@/lib/api-client';
import { StatCard } from '@/components/ui/StatCard';
import { PageSkeleton } from '@/components/ui/Skeleton';
import { MoneyCell } from '@/components/ui/MoneyCell';
import { cn, formatDate } from '@/lib/utils';
import type { FleetOverview } from '@karrkarr/shared';

interface AttentionItem {
  id: string;
  type: 'overdue' | 'expiry' | 'maintenance' | 'pending';
  severity: 'critical' | 'warning';
  title: string;
  detail: string;
  href: string;
}

// Mock attention feed — in production this would come from a /dashboard/attention endpoint
const MOCK_ATTENTION: AttentionItem[] = [
  { id: '1', type: 'overdue', severity: 'critical', title: '14 invoices overdue 8+ days', detail: 'Total S$42,560 outstanding', href: '/collections' },
  { id: '2', type: 'pending', severity: 'warning', title: '7 payment submissions pending review', detail: 'Oldest submitted 2 days ago', href: '/payments' },
  { id: '3', type: 'expiry', severity: 'critical', title: '3 vehicles: insurance expiring within 14 days', detail: 'SMR1337G, SBA4521H, SMU2290X', href: '/vehicles' },
  { id: '4', type: 'expiry', severity: 'warning', title: '5 vehicles: road tax expiring within 30 days', detail: 'Renew before expiry to avoid fines', href: '/vehicles' },
  { id: '5', type: 'maintenance', severity: 'warning', title: '8 vehicles: servicing due within 7 days', detail: 'Schedule workshop appointments', href: '/maintenance' },
];

function SeverityDot({ severity }: { severity: 'critical' | 'warning' }) {
  return (
    <span
      className={cn(
        'w-1.5 h-1.5 rounded-full shrink-0 mt-1.5',
        severity === 'critical' ? 'bg-red-500' : 'bg-amber-400',
      )}
    />
  );
}

export default function OverviewPage() {
  const [data, setData] = useState<FleetOverview | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [branchId, setBranchId] = useState<string | undefined>(undefined);
  const [branches, setBranches] = useState<{ id: string; name: string }[]>([]);

  useEffect(() => {
    apiGet<{ id: string; name: string }[]>('/branches')
      .then(setBranches)
      .catch(() => {});
  }, []);

  useEffect(() => {
    setLoading(true);
    setError(null);
    apiGet<FleetOverview>('/reports/fleet-overview', branchId ? { branchId } : undefined)
      .then(setData)
      .catch(err => setError(err.message ?? 'Failed to load'))
      .finally(() => setLoading(false));
  }, [branchId]);

  if (loading) return <PageSkeleton />;

  if (error) {
    return (
      <div className="p-6">
        <p className="text-sm text-red-600 bg-red-50 border border-red-200 rounded-sm px-3 py-2">
          {error}
        </p>
      </div>
    );
  }

  if (!data) return null;

  const utilPct = data.fleetUtilisationPct;
  const utilUrgency =
    utilPct < 50 ? 'warning' : utilPct < 70 ? 'normal' : 'ok';

  return (
    <div className="p-6 space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-base font-semibold text-zinc-900">Fleet Overview</h1>
          <p className="text-xs text-zinc-500 mt-0.5">{formatDate(new Date().toISOString(), 'EEEE d MMMM yyyy')}</p>
        </div>
        <select
          className="text-xs border border-zinc-200 rounded-sm px-2 py-1 bg-white text-zinc-700 focus:outline-none focus:border-teal-500"
          value={branchId ?? ''}
          onChange={e => setBranchId(e.target.value || undefined)}
        >
          <option value="">All Branches</option>
          {branches.map(b => (
            <option key={b.id} value={b.id}>{b.name}</option>
          ))}
        </select>
      </div>

      {/* Fleet cluster */}
      <section>
        <p className="text-2xs font-semibold uppercase tracking-widest text-zinc-400 mb-2">Fleet</p>
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-2">
          <StatCard label="Total Vehicles" value={data.totalVehicles} urgency="normal" />
          <StatCard
            label="Available"
            value={data.availableVehicles}
            urgency="ok"
            sub={`${Math.round((data.availableVehicles / data.totalVehicles) * 100)}% of fleet`}
          />
          <StatCard label="Currently Rented" value={data.currentlyRented} urgency="normal" />
          <StatCard
            label="Maintenance"
            value={data.inMaintenance}
            urgency={data.inMaintenance > 5 ? 'warning' : 'normal'}
          />
          <StatCard
            label="Returning Soon"
            value={data.returningSoon}
            urgency={data.returningSoon > 10 ? 'warning' : 'normal'}
            sub="next 7 days"
          />
        </div>
        {/* Utilisation bar */}
        <div className="mt-2 bg-white border border-zinc-200 rounded-sm px-3 py-2 flex items-center gap-4">
          <p className="text-2xs font-medium text-zinc-500 uppercase tracking-wide w-32 shrink-0">Fleet Utilisation</p>
          <div className="flex-1 h-2 bg-zinc-100 rounded-full overflow-hidden">
            <div
              className={cn(
                'h-full rounded-full transition-all',
                utilPct >= 80 ? 'bg-emerald-500' : utilPct >= 60 ? 'bg-amber-400' : 'bg-red-400',
              )}
              style={{ width: `${utilPct}%` }}
            />
          </div>
          <p className="text-sm font-semibold tabular-nums text-zinc-800 w-12 text-right">{utilPct.toFixed(1)}%</p>
        </div>
      </section>

      {/* Money cluster */}
      <section>
        <p className="text-2xs font-semibold uppercase tracking-widest text-zinc-400 mb-2">Money</p>
        <div className="grid grid-cols-2 sm:grid-cols-2 lg:grid-cols-4 gap-2">
          <StatCard
            label="Monthly Revenue"
            value={<MoneyCell value={data.monthlyRevenue} />}
            urgency="ok"
          />
          <StatCard
            label="Outstanding Receivables"
            value={<MoneyCell value={data.outstandingReceivables} />}
            urgency={data.outstandingReceivables.cents > 5000000 ? 'critical' : 'warning'}
          />
          <StatCard
            label="Payments Due Today"
            value={data.paymentsDueToday}
            urgency={data.paymentsDueToday > 0 ? 'warning' : 'normal'}
          />
          <StatCard
            label="Overdue Payments"
            value={data.overduePayments}
            urgency={data.overduePayments > 0 ? 'critical' : 'normal'}
            sub={<Link href="/collections" className="text-teal-600 hover:underline">View in Collections</Link>}
          />
        </div>
      </section>

      {/* Compliance cluster */}
      <section>
        <p className="text-2xs font-semibold uppercase tracking-widest text-zinc-400 mb-2">Compliance</p>
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-2">
          <StatCard
            label="Upcoming Servicing"
            value={data.upcomingServicing}
            urgency={data.upcomingServicing > 0 ? 'warning' : 'normal'}
            sub="next 7 days"
          />
          <StatCard
            label="Upcoming Inspection"
            value={data.upcomingInspection}
            urgency={data.upcomingInspection > 0 ? 'warning' : 'normal'}
            sub="next 30 days"
          />
          <StatCard
            label="Insurance Expiring"
            value={data.insuranceExpiring}
            urgency={data.insuranceExpiring > 0 ? 'critical' : 'normal'}
            sub="next 30 days"
          />
          <StatCard
            label="Road Tax Expiring"
            value={data.roadTaxExpiring}
            urgency={data.roadTaxExpiring > 0 ? 'warning' : 'normal'}
            sub="next 30 days"
          />
          <StatCard
            label="COE Expiring"
            value={data.coeExpiring}
            urgency={data.coeExpiring > 0 ? 'critical' : 'normal'}
            sub="next 90 days"
          />
        </div>
      </section>

      {/* Attention feed */}
      <section>
        <p className="text-2xs font-semibold uppercase tracking-widest text-zinc-400 mb-2">Needs Attention</p>
        <div className="bg-white border border-zinc-200 rounded-sm divide-y divide-zinc-100">
          {MOCK_ATTENTION.map(item => (
            <Link
              key={item.id}
              href={item.href}
              className="flex items-start gap-3 px-4 py-3 hover:bg-zinc-50 transition-colors group"
            >
              <SeverityDot severity={item.severity} />
              <div className="min-w-0 flex-1">
                <p className="text-xs font-medium text-zinc-800 group-hover:text-teal-700 transition-colors">
                  {item.title}
                </p>
                <p className="text-2xs text-zinc-500 mt-0.5">{item.detail}</p>
              </div>
              <svg className="w-3 h-3 text-zinc-300 group-hover:text-teal-500 shrink-0 mt-1 transition-colors" viewBox="0 0 12 12" fill="none">
                <path d="M2 6h8M6 2l4 4-4 4" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
              </svg>
            </Link>
          ))}
        </div>
      </section>
    </div>
  );
}
