'use client';

import { useState, type FormEvent } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { apiPost } from '@/lib/api-client';
import type { AuthedAdmin, AuthTokens } from '@vida/shared';
import { cn } from '@/lib/utils';

interface LoginResponse {
  tokens: AuthTokens;
  admin: AuthedAdmin;
}

export default function LoginPage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const redirect = searchParams.get('redirect') ?? '/';

  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setError('');
    setLoading(true);
    try {
      const res = await apiPost<LoginResponse>('/auth/admin/login', { email, password });
      // The API sets httpOnly cookies; store a flag for middleware
      document.cookie = 'vida_authed=1; path=/; SameSite=Lax';
      // Persist user role for client-side permission gating
      sessionStorage.setItem('vida_admin_session', JSON.stringify(res.admin));

      // Role-aware redirect
      const admin = res.admin;
      const dest = redirect !== '/'
        ? redirect
        : admin.role === 'ACCOUNTS'
          ? '/collections'
          : '/';
      router.replace(dest);
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Invalid credentials';
      setError(msg);
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="min-h-screen bg-zinc-950 flex items-center justify-center p-4">
      <div className="w-full max-w-sm">
        {/* Logo */}
        <div className="flex items-center gap-3 mb-8">
          <div className="w-8 h-8 bg-teal-500 rounded flex items-center justify-center">
            <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
              <path d="M3 13V8l5-5 5 5v5h-3v-4H6v4H3z" fill="white" />
            </svg>
          </div>
          <div>
            <p className="text-white text-sm font-semibold tracking-tight">Vida Fleet</p>
            <p className="text-zinc-500 text-2xs">Operations Dashboard</p>
          </div>
        </div>

        <form onSubmit={handleSubmit} className="space-y-3">
          <div>
            <label className="block text-2xs font-medium text-zinc-400 uppercase tracking-wide mb-1">
              Email
            </label>
            <input
              type="email"
              required
              autoFocus
              value={email}
              onChange={e => setEmail(e.target.value)}
              className="w-full px-3 py-2 bg-zinc-900 border border-zinc-700 rounded-sm text-sm text-white placeholder-zinc-600 focus:outline-none focus:border-teal-500 transition-colors"
              placeholder="you@vidasg.com"
            />
          </div>
          <div>
            <label className="block text-2xs font-medium text-zinc-400 uppercase tracking-wide mb-1">
              Password
            </label>
            <input
              type="password"
              required
              value={password}
              onChange={e => setPassword(e.target.value)}
              className="w-full px-3 py-2 bg-zinc-900 border border-zinc-700 rounded-sm text-sm text-white placeholder-zinc-600 focus:outline-none focus:border-teal-500 transition-colors"
              placeholder="••••••••"
            />
          </div>

          {error && (
            <p className="text-xs text-red-400 bg-red-950/50 border border-red-900/50 rounded-sm px-3 py-2">
              {error}
            </p>
          )}

          <button
            type="submit"
            disabled={loading}
            className={cn(
              'w-full py-2 px-4 rounded-sm text-sm font-medium text-white transition-colors',
              loading
                ? 'bg-teal-700 cursor-not-allowed'
                : 'bg-teal-500 hover:bg-teal-600 active:bg-teal-700',
            )}
          >
            {loading ? 'Signing in…' : 'Sign in'}
          </button>
        </form>

        <p className="mt-6 text-center text-2xs text-zinc-600">
          Vida Partners Pte Ltd &mdash; Internal use only
        </p>
      </div>
    </div>
  );
}
