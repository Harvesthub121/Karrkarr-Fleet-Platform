'use client';

import { useEffect, useState, type ReactNode } from 'react';
import { Sidebar } from '@/components/Sidebar';
import { SessionProvider } from '@/lib/permissions';
import { ToastProvider } from '@/components/ui/Toast';
import type { AuthedAdmin } from '@karrkarr/shared';

export default function DashboardLayout({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<AuthedAdmin | null>(null);
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
    try {
      const raw = sessionStorage.getItem('karrkarr_admin_session');
      if (raw) {
        const parsed = JSON.parse(raw) as AuthedAdmin;
        setUser(parsed);
      }
    } catch {
      // ignore
    }
  }, []);

  // Avoid hydration mismatch: render identical shell on server and client until mounted
  if (!mounted) {
    return (
      <SessionProvider initial={null}>
        <ToastProvider>
          <div className="flex h-full min-h-screen">
            <div className="w-52 shrink-0 bg-zinc-950 border-r border-zinc-800" />
            <main className="flex-1 overflow-auto min-w-0">{children}</main>
          </div>
        </ToastProvider>
      </SessionProvider>
    );
  }

  return (
    <SessionProvider initial={user}>
      <ToastProvider>
        <div className="flex h-full min-h-screen">
          <Sidebar />
          <main className="flex-1 overflow-auto min-w-0">{children}</main>
        </div>
      </ToastProvider>
    </SessionProvider>
  );
}
