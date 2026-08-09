'use client';

import { type ReactNode } from 'react';
import { Sidebar } from '@/components/Sidebar';
import { SessionProvider } from '@/lib/permissions';
import { ToastProvider } from '@/components/ui/Toast';
import type { AuthedAdmin } from '@karrkarr/shared';

function getSessionUser(): AuthedAdmin | null {
  if (typeof window === 'undefined') return null;
  try {
    const raw = sessionStorage.getItem('karrkarr_admin_session');
    return raw ? (JSON.parse(raw) as AuthedAdmin) : null;
  } catch {
    return null;
  }
}

export default function DashboardLayout({ children }: { children: ReactNode }) {
  const user = getSessionUser();

  return (
    <SessionProvider initial={user}>
      <ToastProvider>
        <div className="flex h-full min-h-screen">
          <Sidebar />
          <main className="flex-1 overflow-auto min-w-0">
            {children}
          </main>
        </div>
      </ToastProvider>
    </SessionProvider>
  );
}
