'use client';

import { useState, useRef, useCallback } from 'react';
import { Modal } from '@/components/ui/Modal';
import { centsToDisplay, formatDate } from '@/lib/utils';
import type { CustomerInvoice } from '@/lib/api';

interface PaymentModalProps {
  invoice: CustomerInvoice;
}

type SubmitState = 'idle' | 'uploading' | 'submitting' | 'success' | 'error';

export function PaymentModal({ invoice }: PaymentModalProps) {
  const [open, setOpen] = useState(false);
  const [submitState, setSubmitState] = useState<SubmitState>('idle');
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  const [transactionRef, setTransactionRef] = useState('');
  const [paidOnDate, setPaidOnDate] = useState(new Date().toISOString().slice(0, 10));
  const [note, setNote] = useState('');
  const [file, setFile] = useState<File | null>(null);
  const [filePreview, setFilePreview] = useState<string | null>(null);
  const [dragOver, setDragOver] = useState(false);

  const fileRef = useRef<HTMLInputElement>(null);

  const handleFile = useCallback((f: File) => {
    if (f.size > 5 * 1024 * 1024) {
      setErrorMsg('Screenshot must be under 5 MB.');
      return;
    }
    setFile(f);
    setErrorMsg(null);
    const reader = new FileReader();
    reader.onload = e => setFilePreview(e.target?.result as string);
    reader.readAsDataURL(f);
  }, []);

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setDragOver(false);
    const f = e.dataTransfer.files[0];
    if (f) handleFile(f);
  }, [handleFile]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!transactionRef.trim()) {
      setErrorMsg('Transaction reference is required.');
      return;
    }
    setErrorMsg(null);
    setSubmitState('submitting');

    try {
      const formData = new FormData();
      formData.append('invoiceId', invoice.id);
      formData.append('declaredAmountCents', String(invoice.outstandingCents));
      formData.append('transactionRef', transactionRef.trim());
      formData.append('paidOnDate', paidOnDate);
      if (note.trim()) formData.append('customerNote', note.trim());
      if (file) formData.append('proof', file);

      const res = await fetch('/api/proxy/payments/submit', {
        method: 'POST',
        credentials: 'include',
        body: formData,
        // Don't set Content-Type — let browser set multipart boundary
      });

      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        throw new Error((body as { message?: string }).message ?? 'Submission failed.');
      }

      setSubmitState('success');
    } catch (err) {
      setSubmitState('error');
      setErrorMsg(err instanceof Error ? err.message : 'Submission failed.');
    }
  };

  const handleClose = () => {
    if (submitState === 'submitting' || submitState === 'uploading') return;
    setOpen(false);
    if (submitState === 'success') {
      // Refresh to pick up new pending state
      window.location.reload();
    }
  };

  return (
    <>
      <button
        onClick={() => setOpen(true)}
        className="btn-primary"
      >
        I've Made Payment
      </button>

      <Modal open={open} onClose={handleClose} title="Submit Payment" size="md">
        {submitState === 'success' ? (
          <div className="text-center space-y-4 py-2">
            <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-amber-100">
              <svg className="h-6 w-6 text-amber-600" viewBox="0 0 20 20" fill="currentColor" aria-hidden="true">
                <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm.75-11.25a.75.75 0 00-1.5 0v4.59L7.3 9.24a.75.75 0 00-1.1 1.02l3.25 3.5a.75.75 0 001.1 0l3.25-3.5a.75.75 0 10-1.1-1.02l-1.95 2.1V6.75z" clipRule="evenodd" />
              </svg>
            </div>
            <div>
              <p className="text-base font-semibold text-gray-900">Payment submitted — Pending Verification</p>
              <p className="mt-2 text-sm text-gray-600">
                Your payment has been received. An admin will verify your transaction reference and update your account within 1 business day. You will be notified once confirmed.
              </p>
            </div>
            <button onClick={handleClose} className="btn-primary w-full">Done</button>
          </div>
        ) : (
          <form onSubmit={handleSubmit} className="space-y-4">
            {/* Summary */}
            <div className="rounded-lg bg-gray-50 border border-gray-200 px-4 py-3 text-sm">
              <div className="flex justify-between">
                <span className="text-gray-500">Invoice</span>
                <span className="font-mono font-medium">{invoice.invoiceNo}</span>
              </div>
              <div className="flex justify-between mt-1">
                <span className="text-gray-500">Amount Due</span>
                <span className="font-semibold tabular">{centsToDisplay(invoice.outstandingCents)}</span>
              </div>
            </div>

            {/* Transaction reference — mandatory */}
            <div>
              <label htmlFor="txn-ref" className="label">
                Transaction Reference <span className="text-red-500" aria-hidden="true">*</span>
              </label>
              <input
                id="txn-ref"
                type="text"
                required
                value={transactionRef}
                onChange={e => setTransactionRef(e.target.value)}
                className="input"
                placeholder="e.g. PAY-20260806-01234"
                aria-required="true"
                aria-describedby="txn-ref-hint"
              />
              <p id="txn-ref-hint" className="mt-1 text-xs text-gray-400">
                The reference shown on your bank statement or PayNow confirmation.
              </p>
            </div>

            {/* Date */}
            <div>
              <label htmlFor="paid-on" className="label">Date Paid</label>
              <input
                id="paid-on"
                type="date"
                required
                value={paidOnDate}
                onChange={e => setPaidOnDate(e.target.value)}
                max={new Date().toISOString().slice(0, 10)}
                className="input"
              />
            </div>

            {/* Screenshot upload */}
            <div>
              <span className="label">Screenshot (optional, max 5 MB)</span>
              {filePreview ? (
                <div className="relative mt-1 rounded-lg overflow-hidden border border-gray-200">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img src={filePreview} alt="Payment screenshot preview" className="w-full max-h-48 object-contain bg-gray-50" />
                  <button
                    type="button"
                    onClick={() => { setFile(null); setFilePreview(null); }}
                    className="absolute top-2 right-2 rounded-full bg-white/90 p-1 text-gray-600 hover:bg-white shadow"
                    aria-label="Remove screenshot"
                  >
                    <svg className="h-4 w-4" viewBox="0 0 16 16" fill="currentColor" aria-hidden="true">
                      <path d="M6.28 5.22a.75.75 0 00-1.06 1.06L6.94 8l-1.72 1.72a.75.75 0 101.06 1.06L8 9.06l1.72 1.72a.75.75 0 101.06-1.06L9.06 8l1.72-1.72a.75.75 0 00-1.06-1.06L8 6.94 6.28 5.22z" />
                    </svg>
                  </button>
                </div>
              ) : (
                <div
                  onDragOver={e => { e.preventDefault(); setDragOver(true); }}
                  onDragLeave={() => setDragOver(false)}
                  onDrop={handleDrop}
                  onClick={() => fileRef.current?.click()}
                  className={`mt-1 flex cursor-pointer flex-col items-center justify-center rounded-lg border-2 border-dashed p-6 text-center transition ${
                    dragOver ? 'border-teal-400 bg-teal-50' : 'border-gray-300 hover:border-teal-400 hover:bg-gray-50'
                  }`}
                  role="button"
                  tabIndex={0}
                  onKeyDown={e => { if (e.key === 'Enter' || e.key === ' ') fileRef.current?.click(); }}
                  aria-label="Upload screenshot"
                >
                  <svg className="h-8 w-8 text-gray-400 mb-2" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" aria-hidden="true">
                    <path strokeLinecap="round" strokeLinejoin="round" d="M3 16.5v2.25A2.25 2.25 0 005.25 21h13.5A2.25 2.25 0 0021 18.75V16.5m-13.5-9L12 3m0 0l4.5 4.5M12 3v13.5" />
                  </svg>
                  <p className="text-sm text-gray-500">Drag and drop or <span className="text-teal-600">browse</span></p>
                  <p className="text-xs text-gray-400 mt-1">PNG, JPG, JPEG — max 5 MB</p>
                </div>
              )}
              <input
                ref={fileRef}
                type="file"
                accept="image/png,image/jpeg,image/jpg"
                className="sr-only"
                aria-hidden="true"
                tabIndex={-1}
                onChange={e => {
                  const f = e.target.files?.[0];
                  if (f) handleFile(f);
                  e.target.value = '';
                }}
              />
            </div>

            {/* Note */}
            <div>
              <label htmlFor="pay-note" className="label">Note (optional)</label>
              <textarea
                id="pay-note"
                rows={2}
                value={note}
                onChange={e => setNote(e.target.value)}
                className="input resize-none"
                placeholder="Any additional information for the admin…"
              />
            </div>

            {errorMsg && (
              <p role="alert" className="rounded-lg bg-red-50 border border-red-200 px-3 py-2 text-sm text-red-700">
                {errorMsg}
              </p>
            )}

            <div className="flex gap-3 pt-1">
              <button
                type="button"
                onClick={handleClose}
                className="btn-secondary flex-1"
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={submitState === 'submitting'}
                className="btn-primary flex-1"
              >
                {submitState === 'submitting' ? 'Submitting…' : 'Submit Payment'}
              </button>
            </div>
          </form>
        )}
      </Modal>
    </>
  );
}
