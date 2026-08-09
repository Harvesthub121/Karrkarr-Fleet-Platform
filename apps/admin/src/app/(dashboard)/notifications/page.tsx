'use client';

import { useState, useEffect } from 'react';
import { apiGet, apiPatch } from '@/lib/api-client';
import { useToast } from '@/components/ui/Toast';
import { cn, formatDate } from '@/lib/utils';

interface Notification {
  id: string;
  type: string;
  severity: 'INFO' | 'WARNING' | 'CRITICAL';
  title: string;
  body: string;
  readAt: string | null;
  createdAt: string;
  relatedEntityType?: string;
  relatedEntityId?: string;
}

const SEVERITY_STYLES: Record<string, string> = {
  CRITICAL: 'border-l-red-500 bg-red-50/30',
  WARNING:  'border-l-amber-400 bg-amber-50/20',
  INFO:     'border-l-zinc-300 bg-white',
};

const SEVERITY_DOTS: Record<string, string> = {
  CRITICAL: 'bg-red-500',
  WARNING:  'bg-amber-400',
  INFO:     'bg-zinc-300',
};

export default function NotificationsPage() {
  const { show } = useToast();
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState<'all' | 'unread'>('unread');

  useEffect(() => {
    setLoading(true);
    apiGet<{ data: Notification[] }>('/notifications', { unreadOnly: filter === 'unread' || undefined })
      .then(res => setNotifications(res.data ?? []))
      .catch(() => show('Failed to load notifications', 'error'))
      .finally(() => setLoading(false));
  }, [filter, show]);

  async function markRead(id: string) {
    try {
      await apiPatch(`/notifications/${id}/read`);
      setNotifications(prev =>
        prev.map(n => n.id === id ? { ...n, readAt: new Date().toISOString() } : n),
      );
    } catch {
      show('Failed to mark read', 'error');
    }
  }

  async function markAllRead() {
    try {
      await apiPatch('/notifications/read-all');
      setNotifications(prev => prev.map(n => ({ ...n, readAt: n.readAt ?? new Date().toISOString() })));
      show('All notifications marked read', 'success');
    } catch {
      show('Failed to mark all read', 'error');
    }
  }

  const grouped = notifications.reduce<Record<string, Notification[]>>((acc, n) => {
    const key = n.severity;
    (acc[key] ??= []).push(n);
    return acc;
  }, {});

  const ORDER: Notification['severity'][] = ['CRITICAL', 'WARNING', 'INFO'];
  const unreadCount = notifications.filter(n => !n.readAt).length;

  return (
    <div className="p-6 space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-base font-semibold text-zinc-900">Notifications</h1>
          {unreadCount > 0 && (
            <p className="text-xs text-zinc-500 mt-0.5">{unreadCount} unread</p>
          )}
        </div>
        <div className="flex items-center gap-2">
          <div className="flex gap-1">
            <button
              onClick={() => setFilter('unread')}
              className={cn('px-2 py-1 text-xs border rounded-sm', filter === 'unread' ? 'bg-zinc-900 text-white border-zinc-900' : 'border-zinc-200 text-zinc-600 hover:bg-zinc-50')}
            >Unread</button>
            <button
              onClick={() => setFilter('all')}
              className={cn('px-2 py-1 text-xs border rounded-sm', filter === 'all' ? 'bg-zinc-900 text-white border-zinc-900' : 'border-zinc-200 text-zinc-600 hover:bg-zinc-50')}
            >All</button>
          </div>
          {unreadCount > 0 && (
            <button onClick={markAllRead} className="text-xs text-teal-600 hover:underline">Mark all read</button>
          )}
        </div>
      </div>

      {loading ? (
        <div className="space-y-2">
          {[1, 2, 3, 4].map(i => <div key={i} className="h-16 bg-zinc-100 rounded animate-pulse" />)}
        </div>
      ) : notifications.length === 0 ? (
        <div className="text-center py-12 text-sm text-zinc-400">
          {filter === 'unread' ? 'No unread notifications.' : 'No notifications.'}
        </div>
      ) : (
        <div className="space-y-5">
          {ORDER.map(severity => {
            const items = grouped[severity];
            if (!items?.length) return null;
            return (
              <section key={severity}>
                <div className="flex items-center gap-2 mb-2">
                  <span className={cn('w-2 h-2 rounded-full', SEVERITY_DOTS[severity])} />
                  <p className="text-2xs font-semibold uppercase tracking-widest text-zinc-400">
                    {severity} ({items.length})
                  </p>
                </div>
                <div className="space-y-1">
                  {items.map(n => (
                    <div
                      key={n.id}
                      className={cn(
                        'border border-zinc-200 rounded-sm px-4 py-3 border-l-2 flex items-start justify-between gap-4',
                        SEVERITY_STYLES[n.severity],
                        n.readAt && 'opacity-60',
                      )}
                    >
                      <div className="min-w-0 flex-1">
                        <p className={cn('text-xs font-medium text-zinc-900', !n.readAt && 'font-semibold')}>{n.title}</p>
                        <p className="text-xs text-zinc-500 mt-0.5">{n.body}</p>
                        <p className="text-2xs text-zinc-400 mt-1">{formatDate(n.createdAt, 'd MMM yyyy HH:mm')}</p>
                      </div>
                      {!n.readAt && (
                        <button
                          onClick={() => markRead(n.id)}
                          className="shrink-0 text-2xs text-zinc-400 hover:text-zinc-700 transition-colors mt-0.5"
                        >
                          Mark read
                        </button>
                      )}
                    </div>
                  ))}
                </div>
              </section>
            );
          })}
        </div>
      )}
    </div>
  );
}
