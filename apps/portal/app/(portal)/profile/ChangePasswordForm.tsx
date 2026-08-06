'use client';

import { useState, useTransition } from 'react';
import { browserFetch } from '@/lib/api-client';

export function ChangePasswordForm() {
  const [current, setCurrent] = useState('');
  const [next, setNext] = useState('');
  const [confirm, setConfirm] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);
  const [isPending, startTransition] = useTransition();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setSaved(false);

    if (next !== confirm) {
      setError('New passwords do not match.');
      return;
    }
    if (next.length < 8) {
      setError('Password must be at least 8 characters.');
      return;
    }

    startTransition(async () => {
      try {
        await browserFetch('/portal/profile/password', {
          method: 'POST',
          body: { currentPassword: current, newPassword: next },
        });
        setSaved(true);
        setCurrent('');
        setNext('');
        setConfirm('');
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Password change failed.');
      }
    });
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-4 max-w-sm">
      <div>
        <label htmlFor="curr-pw" className="label">Current password</label>
        <input
          id="curr-pw"
          type="password"
          autoComplete="current-password"
          required
          value={current}
          onChange={e => setCurrent(e.target.value)}
          className="input"
        />
      </div>
      <div>
        <label htmlFor="new-pw" className="label">New password</label>
        <input
          id="new-pw"
          type="password"
          autoComplete="new-password"
          required
          minLength={8}
          value={next}
          onChange={e => setNext(e.target.value)}
          className="input"
        />
      </div>
      <div>
        <label htmlFor="confirm-pw" className="label">Confirm new password</label>
        <input
          id="confirm-pw"
          type="password"
          autoComplete="new-password"
          required
          minLength={8}
          value={confirm}
          onChange={e => setConfirm(e.target.value)}
          className="input"
        />
      </div>

      {error && (
        <p role="alert" className="rounded-lg bg-red-50 border border-red-200 px-3 py-2 text-sm text-red-700">{error}</p>
      )}
      {saved && (
        <p role="status" className="rounded-lg bg-emerald-50 border border-emerald-200 px-3 py-2 text-sm text-emerald-700">Password updated successfully.</p>
      )}

      <button type="submit" disabled={isPending} className="btn-primary">
        {isPending ? 'Updating…' : 'Update password'}
      </button>
    </form>
  );
}
