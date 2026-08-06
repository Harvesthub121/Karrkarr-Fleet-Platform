'use client';

import { useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';

type Mode = 'login' | 'activate' | 'forgot';

interface LoginFormProps {
  activateToken?: string;
}

export function LoginForm({ activateToken }: LoginFormProps) {
  const router = useRouter();
  const [mode, setMode] = useState<Mode>(activateToken ? 'activate' : 'login');
  const [isPending, startTransition] = useTransition();

  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [activateSuccess, setActivateSuccess] = useState(false);
  const [forgotSent, setForgotSent] = useState(false);

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    startTransition(async () => {
      const res = await fetch('/api/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, password }),
      });

      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        setError((body as { message?: string }).message ?? 'Login failed.');
        return;
      }

      router.push('/');
      router.refresh();
    });
  };

  const handleActivate = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    if (password !== confirmPassword) {
      setError('Passwords do not match.');
      return;
    }
    if (password.length < 8) {
      setError('Password must be at least 8 characters.');
      return;
    }

    startTransition(async () => {
      const res = await fetch('/api/auth/activate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ token: activateToken, password }),
      });

      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        setError((body as { message?: string }).message ?? 'Activation failed.');
        return;
      }

      setActivateSuccess(true);
    });
  };

  const handleForgot = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    // Simulate: in production this would call POST /auth/customer/forgot-password
    // We show a generic confirmation regardless of whether the email exists (security)
    startTransition(async () => {
      await new Promise(r => setTimeout(r, 600));
      setForgotSent(true);
    });
  };

  if (activateSuccess) {
    return (
      <div className="card text-center space-y-3">
        <div className="mx-auto flex h-10 w-10 items-center justify-center rounded-full bg-emerald-100">
          <svg className="h-5 w-5 text-emerald-600" viewBox="0 0 20 20" fill="currentColor" aria-hidden="true">
            <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.857-9.809a.75.75 0 00-1.214-.882l-3.483 4.79-1.88-1.88a.75.75 0 10-1.06 1.061l2.5 2.5a.75.75 0 001.137-.089l4-5.5z" clipRule="evenodd" />
          </svg>
        </div>
        <p className="font-semibold text-gray-900">Account activated</p>
        <p className="text-sm text-gray-500">Your account is ready. Please sign in.</p>
        <button onClick={() => setMode('login')} className="btn-primary w-full">Sign in</button>
      </div>
    );
  }

  if (forgotSent) {
    return (
      <div className="card text-center space-y-3">
        <p className="font-semibold text-gray-900">Check your email</p>
        <p className="text-sm text-gray-500">
          If an account exists for <strong>{email}</strong>, you will receive a password reset link shortly.
        </p>
        <button onClick={() => { setMode('login'); setForgotSent(false); }} className="btn-ghost w-full text-sm">
          Back to sign in
        </button>
      </div>
    );
  }

  return (
    <div className="card">
      {mode === 'login' && (
        <>
          <h2 className="mb-5 text-base font-semibold text-gray-900">Sign in to your account</h2>
          <form onSubmit={handleLogin} noValidate className="space-y-4">
            <div>
              <label htmlFor="email" className="label">Email address</label>
              <input
                id="email"
                type="email"
                autoComplete="email"
                required
                value={email}
                onChange={e => setEmail(e.target.value)}
                className="input"
                placeholder="you@example.com"
              />
            </div>
            <div>
              <div className="flex items-center justify-between mb-1">
                <label htmlFor="password" className="label mb-0">Password</label>
                <button
                  type="button"
                  onClick={() => setMode('forgot')}
                  className="text-xs text-teal-600 hover:underline focus-visible:outline focus-visible:outline-2 focus-visible:outline-teal-600 rounded"
                >
                  Forgot password?
                </button>
              </div>
              <input
                id="password"
                type="password"
                autoComplete="current-password"
                required
                value={password}
                onChange={e => setPassword(e.target.value)}
                className="input"
                placeholder="••••••••"
              />
            </div>

            {error && (
              <p role="alert" className="rounded-lg bg-red-50 border border-red-200 px-3 py-2 text-sm text-red-700">
                {error}
              </p>
            )}

            <button type="submit" disabled={isPending} className="btn-primary w-full mt-1">
              {isPending ? 'Signing in…' : 'Sign in'}
            </button>
          </form>
        </>
      )}

      {mode === 'activate' && (
        <>
          <h2 className="mb-1 text-base font-semibold text-gray-900">Activate your account</h2>
          <p className="mb-5 text-sm text-gray-500">Set a password to access your rental portal.</p>
          <form onSubmit={handleActivate} noValidate className="space-y-4">
            <div>
              <label htmlFor="act-pw" className="label">New password</label>
              <input
                id="act-pw"
                type="password"
                autoComplete="new-password"
                required
                minLength={8}
                value={password}
                onChange={e => setPassword(e.target.value)}
                className="input"
                placeholder="At least 8 characters"
              />
            </div>
            <div>
              <label htmlFor="act-pw2" className="label">Confirm password</label>
              <input
                id="act-pw2"
                type="password"
                autoComplete="new-password"
                required
                minLength={8}
                value={confirmPassword}
                onChange={e => setConfirmPassword(e.target.value)}
                className="input"
                placeholder="Repeat password"
              />
            </div>

            {error && (
              <p role="alert" className="rounded-lg bg-red-50 border border-red-200 px-3 py-2 text-sm text-red-700">
                {error}
              </p>
            )}

            <button type="submit" disabled={isPending} className="btn-primary w-full">
              {isPending ? 'Activating…' : 'Activate account'}
            </button>
          </form>
        </>
      )}

      {mode === 'forgot' && (
        <>
          <h2 className="mb-1 text-base font-semibold text-gray-900">Reset your password</h2>
          <p className="mb-5 text-sm text-gray-500">Enter your email and we will send a reset link.</p>
          <form onSubmit={handleForgot} noValidate className="space-y-4">
            <div>
              <label htmlFor="forgot-email" className="label">Email address</label>
              <input
                id="forgot-email"
                type="email"
                autoComplete="email"
                required
                value={email}
                onChange={e => setEmail(e.target.value)}
                className="input"
                placeholder="you@example.com"
              />
            </div>

            {error && (
              <p role="alert" className="rounded-lg bg-red-50 border border-red-200 px-3 py-2 text-sm text-red-700">
                {error}
              </p>
            )}

            <button type="submit" disabled={isPending} className="btn-primary w-full">
              {isPending ? 'Sending…' : 'Send reset link'}
            </button>
            <button type="button" onClick={() => setMode('login')} className="btn-ghost w-full text-sm">
              Back to sign in
            </button>
          </form>
        </>
      )}
    </div>
  );
}
