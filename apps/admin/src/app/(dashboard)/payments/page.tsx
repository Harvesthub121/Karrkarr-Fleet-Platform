'use client';

import { useState, useEffect, useCallback } from 'react';
import { apiGet, apiPost } from '@/lib/api-client';
import { InvoiceStatusBadge } from '@/components/ui/StatusBadge';
import { MoneyCents } from '@/components/ui/MoneyCell';
import { Modal } from '@/components/ui/Modal';
import { useToast } from '@/components/ui/Toast';
import { Can } from '@/lib/permissions';
import { PERMISSIONS } from '@vida/shared';
import { cn, formatDate } from '@/lib/utils';

interface PaymentSubmission {
  id: string;
  status: 'PENDING' | 'APPROVED' | 'REJECTED';
  submittedAt: string;
  declaredAmountCents: number;
  transactionRef: string;
  paidOnDate: string;
  customerNote?: string;
  proofUrl?: string;
  method?: string;
  customer: { fullName: string; customerRef: string; email: string };
  invoice: { invoiceNo: string; outstandingCents: number };
  reviewedBy?: { fullName: string };
}

interface PaginatedSubmissions {
  data: PaymentSubmission[];
  page: number;
  pageSize: number;
  total: number;
  totalPages: number;
}

export default function PaymentsPage() {
  const { show } = useToast();
  const [submissions, setSubmissions] = useState<PaymentSubmission[]>([]);
  const [loading, setLoading] = useState(true);
  const [statusFilter, setStatusFilter] = useState<string>('PENDING');
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);

  const [rejectModal, setRejectModal] = useState<{ id: string; invoiceNo: string } | null>(null);
  const [rejectReason, setRejectReason] = useState('');
  const [rejectLoading, setRejectLoading] = useState(false);

  const [approveModal, setApproveModal] = useState<PaymentSubmission | null>(null);
  const [approvedAmount, setApprovedAmount] = useState('');
  const [approveNote, setApproveNote] = useState('');
  const [approveLoading, setApproveLoading] = useState(false);

  const load = useCallback(() => {
    setLoading(true);
    apiGet<PaginatedSubmissions>('/payments/submissions', { status: statusFilter, page, pageSize: 20 })
      .then(res => {
        setSubmissions(res.data);
        setTotalPages(res.totalPages);
      })
      .catch(() => show('Failed to load submissions', 'error'))
      .finally(() => setLoading(false));
  }, [statusFilter, page, show]);

  useEffect(() => { load(); }, [load]);

  async function handleApprove() {
    if (!approveModal) return;
    setApproveLoading(true);
    try {
      const cents = Math.round(parseFloat(approvedAmount) * 100);
      await apiPost(`/payments/submissions/${approveModal.id}/approve`, {
        approvedAmountCents: cents,
        notes: approveNote || undefined,
      });
      show('Payment approved', 'success');
      setApproveModal(null);
      load();
    } catch {
      show('Failed to approve payment', 'error');
    } finally {
      setApproveLoading(false);
    }
  }

  async function handleReject() {
    if (!rejectModal || !rejectReason.trim()) return;
    setRejectLoading(true);
    try {
      await apiPost(`/payments/submissions/${rejectModal.id}/reject`, {
        rejectionReason: rejectReason,
      });
      show('Payment rejected', 'info');
      setRejectModal(null);
      setRejectReason('');
      load();
    } catch {
      show('Failed to reject payment', 'error');
    } finally {
      setRejectLoading(false);
    }
  }

  return (
    <div className="p-6 space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-base font-semibold text-zinc-900">Payment Verification</h1>
          <p className="text-xs text-zinc-500 mt-0.5">Review customer payment submissions</p>
        </div>
        <div className="flex gap-1">
          {(['PENDING', 'APPROVED', 'REJECTED'] as const).map(s => (
            <button
              key={s}
              onClick={() => { setStatusFilter(s); setPage(1); }}
              className={cn(
                'px-2 py-1 text-xs border rounded-sm transition-colors',
                statusFilter === s
                  ? 'bg-zinc-900 text-white border-zinc-900'
                  : 'border-zinc-200 text-zinc-600 hover:bg-zinc-50',
              )}
            >
              {s.charAt(0) + s.slice(1).toLowerCase()}
            </button>
          ))}
        </div>
      </div>

      {loading ? (
        <div className="space-y-2">
          {[1, 2, 3, 4, 5].map(i => (
            <div key={i} className="h-24 bg-zinc-100 rounded animate-pulse" />
          ))}
        </div>
      ) : submissions.length === 0 ? (
        <div className="text-center py-12 text-sm text-zinc-400">
          No {statusFilter.toLowerCase()} submissions.
        </div>
      ) : (
        <div className="space-y-2">
          {submissions.map(sub => {
            const variance = sub.declaredAmountCents - sub.invoice.outstandingCents;
            const hasVariance = Math.abs(variance) > 0;

            return (
              <div key={sub.id} className="bg-white border border-zinc-200 rounded-sm p-4">
                <div className="flex items-start justify-between gap-4">
                  {/* Left: customer + invoice info */}
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2 flex-wrap">
                      <p className="text-sm font-semibold text-zinc-900">{sub.customer.fullName}</p>
                      <span className="text-2xs text-zinc-400 font-mono">{sub.customer.customerRef}</span>
                      <span className="text-2xs text-zinc-300">|</span>
                      <span className="text-xs font-mono text-zinc-600">{sub.invoice.invoiceNo}</span>
                    </div>
                    <div className="mt-2 grid grid-cols-2 sm:grid-cols-4 gap-x-4 gap-y-1">
                      <div>
                        <p className="text-2xs text-zinc-400">Declared Amount</p>
                        <p className="text-xs font-semibold tabular-nums">
                          <MoneyCents cents={sub.declaredAmountCents} />
                        </p>
                      </div>
                      <div>
                        <p className="text-2xs text-zinc-400">Invoice Outstanding</p>
                        <p className="text-xs font-semibold tabular-nums">
                          <MoneyCents cents={sub.invoice.outstandingCents} />
                        </p>
                      </div>
                      {hasVariance && (
                        <div>
                          <p className="text-2xs text-zinc-400">Variance</p>
                          <p className={cn(
                            'text-xs font-semibold tabular-nums',
                            variance > 0 ? 'text-emerald-600' : 'text-red-600',
                          )}>
                            {variance > 0 ? '+' : ''}<MoneyCents cents={variance} />
                          </p>
                        </div>
                      )}
                      <div>
                        <p className="text-2xs text-zinc-400">Transaction Ref</p>
                        <p className="text-xs font-mono text-zinc-700">{sub.transactionRef}</p>
                      </div>
                    </div>
                    <div className="mt-2 flex items-center gap-3">
                      {sub.method && (
                        <span className="text-2xs text-zinc-500 border border-zinc-200 rounded px-1.5 py-0.5">{sub.method}</span>
                      )}
                      <p className="text-2xs text-zinc-400">
                        Paid {formatDate(sub.paidOnDate)} &bull; Submitted {formatDate(sub.submittedAt, 'd MMM HH:mm')}
                      </p>
                    </div>
                    {sub.customerNote && (
                      <p className="mt-1 text-xs text-zinc-500 italic">&ldquo;{sub.customerNote}&rdquo;</p>
                    )}
                  </div>

                  {/* Right: proof + actions */}
                  <div className="flex flex-col items-end gap-2 shrink-0">
                    {sub.proofUrl && (
                      <a
                        href={sub.proofUrl}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="block w-16 h-16 border border-zinc-200 rounded overflow-hidden bg-zinc-50 hover:border-teal-300 transition-colors"
                      >
                        <img src={sub.proofUrl} alt="Payment proof" className="w-full h-full object-cover" />
                      </a>
                    )}

                    {sub.status === 'PENDING' && (
                      <Can permission={PERMISSIONS.PAYMENT_VERIFY}>
                        <div className="flex gap-1">
                          <button
                            onClick={() => {
                              setApproveModal(sub);
                              setApprovedAmount((sub.declaredAmountCents / 100).toFixed(2));
                            }}
                            className="px-2 py-1 text-xs font-medium bg-teal-500 text-white rounded-sm hover:bg-teal-600 transition-colors"
                          >
                            Approve
                          </button>
                          <button
                            onClick={() => setRejectModal({ id: sub.id, invoiceNo: sub.invoice.invoiceNo })}
                            className="px-2 py-1 text-xs font-medium border border-red-200 text-red-600 rounded-sm hover:bg-red-50 transition-colors"
                          >
                            Reject
                          </button>
                        </div>
                      </Can>
                    )}

                    {sub.status !== 'PENDING' && (
                      <span className={cn(
                        'text-2xs font-medium px-1.5 py-0.5 rounded border',
                        sub.status === 'APPROVED'
                          ? 'bg-emerald-50 border-emerald-200 text-emerald-700'
                          : 'bg-red-50 border-red-200 text-red-700',
                      )}>
                        {sub.status}
                        {sub.reviewedBy && ` · ${sub.reviewedBy.fullName}`}
                      </span>
                    )}
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Pagination */}
      {totalPages > 1 && (
        <div className="flex items-center justify-between text-xs text-zinc-500">
          <span>Page {page} of {totalPages}</span>
          <div className="flex gap-1">
            <button disabled={page <= 1} onClick={() => setPage(p => p - 1)}
              className="px-2 py-1 border border-zinc-200 rounded-sm disabled:opacity-40 hover:bg-zinc-50">Prev</button>
            <button disabled={page >= totalPages} onClick={() => setPage(p => p + 1)}
              className="px-2 py-1 border border-zinc-200 rounded-sm disabled:opacity-40 hover:bg-zinc-50">Next</button>
          </div>
        </div>
      )}

      {/* Approve modal */}
      <Modal
        open={!!approveModal}
        onClose={() => setApproveModal(null)}
        title={`Approve Payment — ${approveModal?.invoice.invoiceNo}`}
        size="sm"
      >
        <div className="space-y-3">
          <div>
            <label className="block text-2xs font-medium text-zinc-500 uppercase tracking-wide mb-1">
              Approved Amount (S$)
            </label>
            <input
              type="number"
              step="0.01"
              min="0.01"
              value={approvedAmount}
              onChange={e => setApprovedAmount(e.target.value)}
              className="w-full px-3 py-2 border border-zinc-200 rounded-sm text-sm focus:outline-none focus:border-teal-500"
            />
          </div>
          <div>
            <label className="block text-2xs font-medium text-zinc-500 uppercase tracking-wide mb-1">
              Notes (optional)
            </label>
            <textarea
              rows={2}
              value={approveNote}
              onChange={e => setApproveNote(e.target.value)}
              className="w-full px-3 py-2 border border-zinc-200 rounded-sm text-sm focus:outline-none focus:border-teal-500 resize-none"
            />
          </div>
          <div className="flex gap-2 justify-end">
            <button onClick={() => setApproveModal(null)} className="px-3 py-1.5 text-xs border border-zinc-200 rounded-sm hover:bg-zinc-50">Cancel</button>
            <button
              onClick={handleApprove}
              disabled={approveLoading || !approvedAmount}
              className="px-3 py-1.5 text-xs bg-teal-500 text-white rounded-sm hover:bg-teal-600 disabled:opacity-50"
            >
              {approveLoading ? 'Approving…' : 'Approve'}
            </button>
          </div>
        </div>
      </Modal>

      {/* Reject modal */}
      <Modal
        open={!!rejectModal}
        onClose={() => { setRejectModal(null); setRejectReason(''); }}
        title={`Reject Payment — ${rejectModal?.invoiceNo}`}
        size="sm"
      >
        <div className="space-y-3">
          <div>
            <label className="block text-2xs font-medium text-zinc-500 uppercase tracking-wide mb-1">
              Rejection Reason <span className="text-red-500">*</span>
            </label>
            <textarea
              rows={3}
              value={rejectReason}
              onChange={e => setRejectReason(e.target.value)}
              placeholder="e.g. Amount does not match invoice, proof unclear…"
              className="w-full px-3 py-2 border border-zinc-200 rounded-sm text-sm focus:outline-none focus:border-red-400 resize-none"
            />
          </div>
          <div className="flex gap-2 justify-end">
            <button onClick={() => { setRejectModal(null); setRejectReason(''); }} className="px-3 py-1.5 text-xs border border-zinc-200 rounded-sm hover:bg-zinc-50">Cancel</button>
            <button
              onClick={handleReject}
              disabled={rejectLoading || !rejectReason.trim()}
              className="px-3 py-1.5 text-xs bg-red-600 text-white rounded-sm hover:bg-red-700 disabled:opacity-50"
            >
              {rejectLoading ? 'Rejecting…' : 'Reject'}
            </button>
          </div>
        </div>
      </Modal>
    </div>
  );
}
