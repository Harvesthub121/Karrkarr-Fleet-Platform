'use client';

import { useEffect, useState, type ReactNode } from 'react';
import { Sidebar } from '@/components/Sidebar';
import { SessionProvider, useSession } from '@/lib/permissions';
import { ToastProvider } from '@/components/ui/Toast';
import type { AuthedAdmin } from '@karrkarr/shared';

function SessionLoader({ children }: { children: ReactNode }) {
  const { setUser } = useSession();

  useEffect(() => {
    try {
      const raw = sessionStorage.getItem('karrkarr_admin_session');
      if (raw) {
        const parsed = JSON.parse(raw) as AuthedAdmin;
        setUser(parsed);
      }
    } catch {
      // ignore
    }
  }, [setUser]);

  return <>{children}</>;
}

export default function DashboardLayout({ children }: { children: ReactNode }) {
  return (
    <SessionProvider initial={null}>
      <ToastProvider>
        <SessionLoader>
          <div className="flex h-full min-h-screen">
            <Sidebar />
            <main className="flex-1 overflow-auto min-w-0">
              {children}
            </main>
          </div>
        </SessionLoader>
      </ToastProvider>
    </SessionProvider>
  );
}