'use client';

import { useState, useCallback } from 'react';
import { apiGet } from '@/lib/api-client';
import { Can } from '@/lib/permissions';
import { useToast } from '@/components/ui/Toast';
import { PERMISSIONS } from '@karrkarr/shared';
import { cn } from '@/lib/utils';

type ReportType =
  | 'revenue'
  | 'outstanding-payments'
  | 'late-payments'
  | 'vehicle-utilisation'
  | 'maintenance-costs'
  | 'revenue-per-vehicle'
  | 'revenue-per-customer'
  | 'upcoming-expiries'
  | 'branch-performance';

type ExportFormat = 'csv' | 'excel' | 'pdf';

const REPORTS: { key: ReportType; label: string; description: string }[] = [
  { key: 'revenue', label: 'Revenue', description: 'Total payments received, broken down by period.' },
  { key: 'outstanding-payments', label: 'Outstanding Payments', description: 'All unpaid or partially paid invoices.' },
  { key: 'late-payments', label: 'Late Payments', description: 'Overdue invoices with interest accrued.' },
  { key: 'vehicle-utilisation', label: 'Vehicle Utilisation', description: 'Rental days vs. idle days per vehicle.' },
  { key: 'maintenance-costs', label: 'Maintenance Costs', description: 'Workshop spend, broken down by vehicle.' },
  { key: 'revenue-per-vehicle', label: 'Revenue per Vehicle', description: 'Lifetime and period revenue per plate.' },
  { key: 'revenue-per-customer', label: 'Revenue per Customer', description: 'Lifetime and period revenue per customer.' },
  { key: 'upcoming-expiries', label: 'Upcoming Expiries', description: 'COE, road tax, insurance expiring soon.' },
  { key: 'branch-performance', label: 'Branch Performance', description: 'KPIs aggregated per branch.' },
];

const today = new Date().toISOString().slice(0, 10);
const monthStart = new Date(new Date().getFullYear(), new Date().getMonth(), 1).toISOString().slice(0, 10);

export default function ReportsPage() {
  const { show } = useToast();
  const [selectedReport, setSelectedReport] = useState<ReportType>('revenue');
  const [from, setFrom] = useState(monthStart);
  const [to, setTo] = useState(today);
  const [branchId, setBranchId] = useState('');
  const [preview, setPreview] = useState<Record<string, unknown>[] | null>(null);
  const [loading, setLoading] = useState(false);

  const runPreview = useCallback(async () => {
    setLoading(true);
    try {
      const data = await apiGet<unknown>(`/reports/${selectedReport}`, {
        from, to, branchId: branchId || undefined,
      });
      // Flatten array result
      const rows = Array.isArray(data) ? data : (data as any)?.payments ?? (data as any)?.invoices ?? [];
      setPreview(rows.slice(0, 50));
    } catch {
      show('Failed to run report', 'error');
    } finally {
      setLoading(false);
    }
  }, [selectedReport, from, to, branchId, show]);

  function buildExportUrl(format: ExportFormat) {
    const params = new URLSearchParams({
      from, to, format,
      ...(branchId ? { branchId } : {}),
    });
    return `${process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:3000'}/reports/${selectedReport}?${params}`;
  }

  const previewCols = preview && preview.length > 0 ? Object.keys(preview[0]) : [];

  return (
    <div className="p-6 space-y-5">
      <div>
        <h1 className="text-base font-semibold text-zinc-900">Reports</h1>
        <p className="text-xs text-zinc-500 mt-0.5">Generate, preview, and export operational reports</p>
      </div>

      <div className="flex gap-4">
        {/* Report list */}
        <div className="w-48 shrink-0 space-y-0.5">
          {REPORTS.map(r => (
            <button
              key={r.key}
              onClick={() => { setSelectedReport(r.key); setPreview(null); }}
              className={cn(
                'w-full text-left px-3 py-2 text-xs rounded-sm transition-colors',
                selectedReport === r.key
                  ? 'bg-teal-50 text-teal-700 font-medium'
                  : 'text-zinc-600 hover:bg-zinc-100',
              )}
            >
              {r.label}
            </button>
          ))}
        </div>

        {/* Main panel */}
        <div className="flex-1 min-w-0 space-y-4">
          {/* Controls */}
          <div className="bg-white border border-zinc-200 rounded-sm p-4 space-y-3">
            <div>
              <h2 className="text-sm font-semibold text-zinc-900">
                {REPORTS.find(r => r.key === selectedReport)?.label}
              </h2>
              <p className="text-xs text-zinc-500 mt-0.5">
                {REPORTS.find(r => r.key === selectedReport)?.description}
              </p>
            </div>

            <div className="flex flex-wrap gap-3 items-end">
              <div>
                <label className="block text-2xs font-medium text-zinc-500 uppercase tracking-wide mb-1">From</label>
                <input
                  type="date"
                  value={from}
                  onChange={e => setFrom(e.target.value)}
                  className="text-xs border border-zinc-200 rounded-sm px-2 py-1.5 bg-white focus:outline-none focus:border-teal-500"
                />
              </div>
              <div>
                <label className="block text-2xs font-medium text-zinc-500 uppercase tracking-wide mb-1">To</label>
                <input
                  type="date"
                  value={to}
                  onChange={e => setTo(e.target.value)}
                  className="text-xs border border-zinc-200 rounded-sm px-2 py-1.5 bg-white focus:outline-none focus:border-teal-500"
                />
              </div>
              <div>
                <label className="block text-2xs font-medium text-zinc-500 uppercase tracking-wide mb-1">Branch</label>
                <input
                  type="text"
                  placeholder="All branches"
                  value={branchId}
                  onChange={e => setBranchId(e.target.value)}
                  className="text-xs border border-zinc-200 rounded-sm px-2 py-1.5 bg-white focus:outline-none focus:border-teal-500 w-36"
                />
              </div>
              <button
                onClick={runPreview}
                disabled={loading}
                className="px-3 py-1.5 text-xs bg-teal-500 text-white rounded-sm hover:bg-teal-600 disabled:opacity-50 transition-colors"
              >
                {loading ? 'Running…' : 'Preview'}
              </button>
            </div>

            {/* Export buttons */}
            <Can permission={PERMISSIONS.REPORT_EXPORT}>
              <div className="flex items-center gap-2 pt-1 border-t border-zinc-100">
                <p className="text-2xs text-zinc-400 mr-1">Export:</p>
                {(['csv', 'excel', 'pdf'] as ExportFormat[]).map(fmt => (
                  <a
                    key={fmt}
                    href={buildExportUrl(fmt)}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="px-2 py-1 text-2xs font-medium border border-zinc-200 rounded hover:bg-zinc-50 text-zinc-600 transition-colors uppercase tracking-wide"
                  >
                    {fmt}
                  </a>
                ))}
              </div>
            </Can>
          </div>

          {/* Preview table */}
          {preview !== null && (
            <div>
              <p className="text-2xs text-zinc-400 mb-1.5">
                Preview (first 50 rows of {preview.length})
              </p>
              {preview.length === 0 ? (
                <p className="text-xs text-zinc-400 text-center py-8 bg-white border border-zinc-200 rounded-sm">
                  No data for this period.
                </p>
              ) : (
                <div className="overflow-x-auto border border-zinc-200 rounded-sm">
                  <table className="w-full text-xs border-collapse">
                    <thead>
                      <tr className="bg-zinc-50 border-b border-zinc-200">
                        {previewCols.map(col => (
                          <th key={col} className="px-3 py-2 text-left text-2xs font-semibold uppercase tracking-wide text-zinc-400 whitespace-nowrap">
                            {col.replace(/([A-Z])/g, ' $1').trim()}
                          </th>
                        ))}
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-zinc-100">
                      {preview.map((row, i) => (
                        <tr key={i} className="hover:bg-zinc-50">
                          {previewCols.map(col => (
                            <td key={col} className="px-3 py-2 tabular-nums text-zinc-700 whitespace-nowrap">
                              {String(row[col] ?? '—')}
                            </td>
                          ))}
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
