'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { cn } from '@/lib/utils';
import { useSession } from '@/lib/permissions';

const NAV_ITEMS = [
  {
    href: '/',
    label: 'Overview',
    icon: (
      <svg width="15" height="15" viewBox="0 0 15 15" fill="none">
        <rect x="1" y="1" width="5.5" height="5.5" rx="0.5" stroke="currentColor" strokeWidth="1.2" />
        <rect x="8.5" y="1" width="5.5" height="5.5" rx="0.5" stroke="currentColor" strokeWidth="1.2" />
        <rect x="1" y="8.5" width="5.5" height="5.5" rx="0.5" stroke="currentColor" strokeWidth="1.2" />
        <rect x="8.5" y="8.5" width="5.5" height="5.5" rx="0.5" stroke="currentColor" strokeWidth="1.2" />
      </svg>
    ),
  },
  {
    href: '/collections',
    label: 'Collections',
    icon: (
      <svg width="15" height="15" viewBox="0 0 15 15" fill="none">
        <path d="M2 4h11M2 7.5h11M2 11h7" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round" />
        <circle cx="12" cy="11" r="2.5" stroke="currentColor" strokeWidth="1.2" />
        <path d="M11.5 11h1M12 10.5v1" stroke="currentColor" strokeWidth="1" strokeLinecap="round" />
      </svg>
    ),
  },
  {
    href: '/payments',
    label: 'Payments',
    icon: (
      <svg width="15" height="15" viewBox="0 0 15 15" fill="none">
        <rect x="1" y="3" width="13" height="9" rx="1" stroke="currentColor" strokeWidth="1.2" />
        <path d="M1 6h13" stroke="currentColor" strokeWidth="1.2" />
        <rect x="3" y="8.5" width="3" height="1.5" rx="0.3" fill="currentColor" />
      </svg>
    ),
  },
  {
    href: '/vehicles',
    label: 'Vehicles',
    icon: (
      <svg width="15" height="15" viewBox="0 0 15 15" fill="none">
        <path d="M2 9V7l2-4h6l2 4v2" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round" strokeLinejoin="round" />
        <path d="M1 9h13" stroke="currentColor" strokeWidth="1.2" />
        <circle cx="4" cy="10.5" r="1.5" stroke="currentColor" strokeWidth="1.2" />
        <circle cx="11" cy="10.5" r="1.5" stroke="currentColor" strokeWidth="1.2" />
      </svg>
    ),
  },
  {
    href: '/rentals',
    label: 'Rentals',
    icon: (
      <svg width="15" height="15" viewBox="0 0 15 15" fill="none">
        <rect x="1" y="2" width="13" height="11" rx="1" stroke="currentColor" strokeWidth="1.2" />
        <path d="M1 6h13M5 2v4M10 2v4" stroke="currentColor" strokeWidth="1.2" />
      </svg>
    ),
  },
  {
    href: '/customers',
    label: 'Customers',
    icon: (
      <svg width="15" height="15" viewBox="0 0 15 15" fill="none">
        <circle cx="7.5" cy="5" r="2.5" stroke="currentColor" strokeWidth="1.2" />
        <path d="M2 13c0-3.038 2.462-5.5 5.5-5.5S13 9.962 13 13" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round" />
      </svg>
    ),
  },
  {
    href: '/maintenance',
    label: 'Maintenance',
    icon: (
      <svg width="15" height="15" viewBox="0 0 15 15" fill="none">
        <path d="M9 2l.5 1.5L11 4l-1.5.5L9 6l-.5-1.5L7 4l1.5-.5L9 2z" stroke="currentColor" strokeWidth="1" strokeLinejoin="round" />
        <path d="M4 8.5l3 3L3.5 15 1 12.5 4 8.5z" stroke="currentColor" strokeWidth="1.2" strokeLinejoin="round" />
        <path d="M7 11.5L11.5 7a2 2 0 00-3-3L4 8.5" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round" />
      </svg>
    ),
  },
  {
    href: '/reports',
    label: 'Reports',
    icon: (
      <svg width="15" height="15" viewBox="0 0 15 15" fill="none">
        <path d="M3 13V8M6.5 13V5M10 13V3M13.5 13V7" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round" />
      </svg>
    ),
  },
  {
    href: '/notifications',
    label: 'Notifications',
    icon: (
      <svg width="15" height="15" viewBox="0 0 15 15" fill="none">
        <path d="M7.5 2a1 1 0 011 1v.5A4 4 0 0112 7.5V10l1 1.5H2L3 10V7.5A4 4 0 016.5 3.5V3a1 1 0 011-1z" stroke="currentColor" strokeWidth="1.2" strokeLinejoin="round" />
        <path d="M6 11.5a1.5 1.5 0 003 0" stroke="currentColor" strokeWidth="1.2" />
      </svg>
    ),
  },
  {
    href: '/settings',
    label: 'Settings',
    icon: (
      <svg width="15" height="15" viewBox="0 0 15 15" fill="none">
        <circle cx="7.5" cy="7.5" r="2" stroke="currentColor" strokeWidth="1.2" />
        <path d="M7.5 1v1.5M7.5 12.5V14M1 7.5h1.5M12.5 7.5H14M2.9 2.9l1.1 1.1M11 11l1.1 1.1M2.9 12.1L4 11M11 4l1.1-1.1" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round" />
      </svg>
    ),
  },
];

export function Sidebar() {
  const pathname = usePathname();
  const { user } = useSession();

  function isActive(href: string): boolean {
    if (href === '/') return pathname === '/';
    return pathname.startsWith(href);
  }

  return (
    <aside className="w-48 shrink-0 bg-zinc-900 flex flex-col h-screen sticky top-0">
      {/* Brand */}
      <div className="px-4 py-4 border-b border-zinc-800">
        <div className="flex items-center gap-2">
          <div className="w-6 h-6 bg-teal-500 rounded-sm flex items-center justify-center">
            <svg width="12" height="12" viewBox="0 0 12 12" fill="none">
              <path d="M2 10V6l4-4 4 4v4H8V7H4v3H2z" fill="white" />
            </svg>
          </div>
          <span className="text-sm font-semibold text-white tracking-tight">Vida Fleet</span>
        </div>
      </div>

      {/* Nav */}
      <nav className="flex-1 py-2 overflow-y-auto">
        {NAV_ITEMS.map(item => (
          <Link
            key={item.href}
            href={item.href}
            className={cn(
              'flex items-center gap-2.5 px-4 py-2 text-xs font-medium transition-colors',
              isActive(item.href)
                ? 'bg-teal-500/10 text-teal-400 border-r-2 border-teal-500'
                : 'text-zinc-400 hover:text-zinc-100 hover:bg-zinc-800',
            )}
          >
            {item.icon}
            {item.label}
          </Link>
        ))}
      </nav>

      {/* User footer */}
      {user && (
        <div className="px-4 py-3 border-t border-zinc-800">
          <p className="text-2xs text-zinc-500 uppercase tracking-wide">{user.role.replace('_', ' ')}</p>
          <p className="text-xs text-zinc-300 truncate mt-0.5">{user.fullName}</p>
          {user.branchName && (
            <p className="text-2xs text-zinc-500 truncate">{user.branchName}</p>
          )}
        </div>
      )}
    </aside>
  );
}
