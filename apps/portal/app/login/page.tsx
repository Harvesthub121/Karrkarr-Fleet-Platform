import { redirect } from 'next/navigation';
import { getSession } from '@/lib/session';
import { LoginForm } from './LoginForm';

export const metadata = { title: 'Sign In — Karrkarr Portal' };

export default async function LoginPage({
  searchParams,
}: {
  searchParams: Promise<{ activate?: string; token?: string }>;
}) {
  const session = await getSession();
  if (session) redirect('/');

  const sp = await searchParams;

  return (
    <div className="flex min-h-screen flex-col items-center justify-center bg-gray-50 px-4">
      <div className="w-full max-w-sm">
        {/* Brand */}
        <div className="mb-8 text-center">
          <div className="inline-flex h-12 w-12 items-center justify-center rounded-xl bg-teal-600 mb-4">
            <svg className="h-6 w-6 text-white" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true">
              <path strokeLinecap="round" strokeLinejoin="round" d="M9 12l2 2 4-4M7.835 4.697a3.42 3.42 0 001.946-.806 3.42 3.42 0 014.438 0 3.42 3.42 0 001.946.806 3.42 3.42 0 013.138 3.138 3.42 3.42 0 00.806 1.946 3.42 3.42 0 010 4.438 3.42 3.42 0 00-.806 1.946 3.42 3.42 0 01-3.138 3.138 3.42 3.42 0 00-1.946.806 3.42 3.42 0 01-4.438 0 3.42 3.42 0 00-1.946-.806 3.42 3.42 0 01-3.138-3.138 3.42 3.42 0 00-.806-1.946 3.42 3.42 0 010-4.438 3.42 3.42 0 00.806-1.946 3.42 3.42 0 013.138-3.138z" />
            </svg>
          </div>
          <h1 className="text-xl font-bold text-gray-900">Karrkarr</h1>
          <p className="mt-1 text-sm text-gray-500">Customer Portal</p>
        </div>

        <LoginForm activateToken={sp.activate === '1' ? sp.token : undefined} />

        <p className="mt-6 text-center text-xs text-gray-400">
          For assistance, contact{' '}
          <a href="mailto:support@karrkarr.com.sg" className="text-teal-600 underline underline-offset-2">
            support@karrkarr.com.sg
          </a>
        </p>
      </div>
    </div>
  );
}
