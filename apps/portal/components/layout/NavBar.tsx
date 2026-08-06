'use client';

import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { useState } from 'react';
import { classNames } from '@/lib/utils';

const NAV_ITEMS = [
  { href: '/', label: 'Dashboard', icon: HomeIcon },
  { href: '/payments', label: 'Payments', icon: PaymentIcon },
  { href: '/documents', label: 'Documents', icon: DocumentIcon },
  { href: '/vehicle', label: 'Vehicle', icon: CarIcon },
  { href: '/profile', label: 'Profile', icon: UserIcon },
];

function HomeIcon() {
  return (
    <svg className="h-5 w-5" viewBox="0 0 20 20" fill="currentColor" aria-hidden="true">
      <path fillRule="evenodd" d="M9.293 2.293a1 1 0 011.414 0l7 7A1 1 0 0117 11h-1v6a1 1 0 01-1 1h-2a1 1 0 01-1-1v-3a1 1 0 00-1-1H9a1 1 0 00-1 1v3a1 1 0 01-1 1H5a1 1 0 01-1-1v-6H3a1 1 0 01-.707-1.707l7-7z" clipRule="evenodd" />
    </svg>
  );
}

function PaymentIcon() {
  return (
    <svg className="h-5 w-5" viewBox="0 0 20 20" fill="currentColor" aria-hidden="true">
      <path d="M2.5 4A1.5 1.5 0 001 5.5V6h18v-.5A1.5 1.5 0 0017.5 4h-15zM19 8.5H1v6A1.5 1.5 0 002.5 16h15a1.5 1.5 0 001.5-1.5v-6zM3 13.25a.75.75 0 01.75-.75h1.5a.75.75 0 010 1.5h-1.5a.75.75 0 01-.75-.75zm4.75-.75a.75.75 0 000 1.5h3.5a.75.75 0 000-1.5h-3.5z" />
    </svg>
  );
}

function DocumentIcon() {
  return (
    <svg className="h-5 w-5" viewBox="0 0 20 20" fill="currentColor" aria-hidden="true">
      <path fillRule="evenodd" d="M4 4a2 2 0 012-2h4.586A2 2 0 0112 2.586L15.414 6A2 2 0 0116 7.414V16a2 2 0 01-2 2H6a2 2 0 01-2-2V4zm2 6a1 1 0 011-1h6a1 1 0 110 2H7a1 1 0 01-1-1zm1 3a1 1 0 100 2h6a1 1 0 100-2H7z" clipRule="evenodd" />
    </svg>
  );
}

function CarIcon() {
  return (
    <svg className="h-5 w-5" viewBox="0 0 20 20" fill="currentColor" aria-hidden="true">
      <path d="M6.5 3A1.5 1.5 0 005 4.5v.56l-.91.455A3 3 0 002.5 8.03V12a1 1 0 001 1h.543A2.5 2.5 0 009 13.8V15h2v-1.2a2.5 2.5 0 004.957-.8H16.5a1 1 0 001-1V8.03a3 3 0 00-1.59-2.514L15 5.06V4.5A1.5 1.5 0 0013.5 3h-7zM6 6.5h8v-.78l.52.26c.459.23.73.67.73 1.15V9H4.75v-.87c0-.48.27-.92.73-1.15L6 6.72V6.5zm-.25 5a1 1 0 110 2 1 1 0 010-2zm8.5 0a1 1 0 110 2 1 1 0 010-2z" />
    </svg>
  );
}

function UserIcon() {
  return (
    <svg className="h-5 w-5" viewBox="0 0 20 20" fill="currentColor" aria-hidden="true">
      <path d="M10 8a3 3 0 100-6 3 3 0 000 6zM3.465 14.493a1.23 1.23 0 00.41 1.412A9.957 9.957 0 0010 18c2.31 0 4.438-.784 6.131-2.1.43-.333.604-.903.408-1.41a7.002 7.002 0 00-13.074.003z" />
    </svg>
  );
}

interface NavBarProps {
  fullName: string;
  customerRef: string;
}

export function NavBar({ fullName, customerRef }: NavBarProps) {
  const pathname = usePathname();
  const router = useRouter();
  const [loggingOut, setLoggingOut] = useState(false);

  const handleLogout = async () => {
    setLoggingOut(true);
    await fetch('/api/auth/logout', { method: 'POST' });
    router.push('/login');
  };

  return (
    <>
      {/* Desktop top bar */}
      <header className="hidden md:flex sticky top-0 z-30 h-14 items-center border-b border-gray-200 bg-white px-6">
        <div className="flex items-center gap-2 min-w-[160px]">
          {/* Logo / brand */}
          <span className="text-base font-bold tracking-tight text-teal-600">Vida Partners</span>
          <span className="text-xs text-gray-400 border-l border-gray-200 pl-2">Portal</span>
        </div>

        <nav className="flex flex-1 items-center gap-1 px-4" aria-label="Main navigation">
          {NAV_ITEMS.map(({ href, label, icon: Icon }) => {
            const active = href === '/' ? pathname === '/' : pathname.startsWith(href);
            return (
              <Link
                key={href}
                href={href}
                className={classNames(
                  'flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-sm font-medium transition',
                  active
                    ? 'bg-teal-50 text-teal-700'
                    : 'text-gray-500 hover:bg-gray-100 hover:text-gray-900',
                )}
                aria-current={active ? 'page' : undefined}
              >
                <Icon />
                {label}
              </Link>
            );
          })}
        </nav>

        <div className="flex items-center gap-3 min-w-[200px] justify-end">
          <div className="text-right">
            <p className="text-sm font-medium text-gray-900 leading-none">{fullName}</p>
            <p className="text-xs text-gray-400 mt-0.5">{customerRef}</p>
          </div>
          <button
            onClick={handleLogout}
            disabled={loggingOut}
            className="btn-ghost text-xs"
            aria-label="Sign out"
          >
            {loggingOut ? 'Signing out…' : 'Sign out'}
          </button>
        </div>
      </header>

      {/* Mobile bottom tab bar */}
      <nav
        className="fixed bottom-0 left-0 right-0 z-30 md:hidden border-t border-gray-200 bg-white"
        aria-label="Mobile navigation"
      >
        <div className="grid grid-cols-5 h-16">
          {NAV_ITEMS.map(({ href, label, icon: Icon }) => {
            const active = href === '/' ? pathname === '/' : pathname.startsWith(href);
            return (
              <Link
                key={href}
                href={href}
                className={classNames(
                  'flex flex-col items-center justify-center gap-0.5 text-[10px] font-medium transition',
                  active ? 'text-teal-600' : 'text-gray-400',
                )}
                aria-current={active ? 'page' : undefined}
              >
                <Icon />
                {label}
              </Link>
            );
          })}
        </div>
      </nav>
    </>
  );
}
