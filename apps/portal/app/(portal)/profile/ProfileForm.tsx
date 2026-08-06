'use client';

import { useState, useTransition } from 'react';
import { browserFetch } from '@/lib/api-client';

interface ProfileFormProps {
  initialName: string;
  email: string;
  customerRef: string;
}

export function ProfileForm({ initialName, email, customerRef }: ProfileFormProps) {
  const [fullName, setFullName] = useState(initialName);
  const [saved, setSaved] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setSaved(false);

    startTransition(async () => {
      try {
        await browserFetch('/portal/profile', {
          method: 'PATCH',
          body: { fullName },
        });
        setSaved(true);
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Update failed.');
      }
    });
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-4 max-w-sm">
      <div>
        <label htmlFor="ref" className="label">Customer Reference</label>
        <input id="ref" type="text" value={customerRef} readOnly className="input bg-gray-50 text-gray-500 cursor-not-allowed" />
      </div>
      <div>
        <label htmlFor="profile-email" className="label">Email address</label>
        <input id="profile-email" type="email" value={email} readOnly className="input bg-gray-50 text-gray-500 cursor-not-allowed" aria-describedby="email-hint" />
        <p id="email-hint" className="mt-1 text-xs text-gray-400">Contact support to change your email.</p>
      </div>
      <div>
        <label htmlFor="profile-name" className="label">Full name</label>
        <input
          id="profile-name"
          type="text"
          value={fullName}
          onChange={e => setFullName(e.target.value)}
          className="input"
          required
        />
      </div>

      {error && (
        <p role="alert" className="rounded-lg bg-red-50 border border-red-200 px-3 py-2 text-sm text-red-700">{error}</p>
      )}
      {saved && (
        <p role="status" className="rounded-lg bg-emerald-50 border border-emerald-200 px-3 py-2 text-sm text-emerald-700">Changes saved.</p>
      )}

      <button type="submit" disabled={isPending} className="btn-primary">
        {isPending ? 'Saving…' : 'Save changes'}
      </button>
    </form>
  );
}
