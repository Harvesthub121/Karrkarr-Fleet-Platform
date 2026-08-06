'use client';

import { createContext, useContext, useState, useCallback, type ReactNode } from 'react';
import { cn } from '@/lib/utils';

type ToastType = 'success' | 'error' | 'warning' | 'info';

interface Toast {
  id: string;
  type: ToastType;
  message: string;
}

interface ToastCtx {
  show: (message: string, type?: ToastType) => void;
}

const ToastContext = createContext<ToastCtx>({ show: () => {} });

const TOAST_STYLES: Record<ToastType, string> = {
  success: 'bg-emerald-50 border-emerald-300 text-emerald-800',
  error:   'bg-red-50 border-red-300 text-red-800',
  warning: 'bg-amber-50 border-amber-300 text-amber-800',
  info:    'bg-blue-50 border-blue-300 text-blue-800',
};

export function ToastProvider({ children }: { children: ReactNode }) {
  const [toasts, setToasts] = useState<Toast[]>([]);

  const show = useCallback((message: string, type: ToastType = 'info') => {
    const id = Math.random().toString(36).slice(2);
    setToasts(prev => [...prev, { id, type, message }]);
    setTimeout(() => {
      setToasts(prev => prev.filter(t => t.id !== id));
    }, 4000);
  }, []);

  return (
    <ToastContext.Provider value={{ show }}>
      {children}
      <div className="fixed bottom-4 right-4 z-50 flex flex-col gap-2 pointer-events-none">
        {toasts.map(t => (
          <div
            key={t.id}
            className={cn(
              'px-3 py-2 text-sm border rounded-sm shadow-sm pointer-events-auto animate-in fade-in slide-in-from-bottom-2',
              TOAST_STYLES[t.type],
            )}
          >
            {t.message}
          </div>
        ))}
      </div>
    </ToastContext.Provider>
  );
}

export function useToast() {
  return useContext(ToastContext);
}
