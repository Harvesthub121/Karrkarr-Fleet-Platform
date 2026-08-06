'use client';

import { useState, type ReactNode } from 'react';
import { cn } from '@/lib/utils';

export interface Column<T> {
  key: string;
  header: string;
  cell: (row: T, index: number) => ReactNode;
  sortable?: boolean;
  width?: string;
  align?: 'left' | 'right' | 'center';
}

interface DataTableProps<T> {
  columns: Column<T>[];
  rows: T[];
  rowKey: (row: T) => string;
  loading?: boolean;
  emptyMessage?: string;
  expandRow?: (row: T) => ReactNode;
  onRowClick?: (row: T) => void;
  className?: string;
}

function ChevronDown({ className }: { className?: string }) {
  return (
    <svg className={className} width="12" height="12" viewBox="0 0 12 12" fill="none">
      <path d="M2 4l4 4 4-4" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

function SortIcon({ dir }: { dir: 'asc' | 'desc' | null }) {
  return (
    <span className="inline-flex flex-col ml-1 opacity-50">
      <svg width="8" height="10" viewBox="0 0 8 10" fill="none">
        <path d="M4 1L1 4h6L4 1z" fill={dir === 'asc' ? 'currentColor' : 'none'} stroke="currentColor" strokeWidth="1" />
        <path d="M4 9L1 6h6L4 9z" fill={dir === 'desc' ? 'currentColor' : 'none'} stroke="currentColor" strokeWidth="1" />
      </svg>
    </span>
  );
}

export function DataTable<T>({
  columns,
  rows,
  rowKey,
  loading = false,
  emptyMessage = 'No records found.',
  expandRow,
  onRowClick,
  className,
}: DataTableProps<T>) {
  const [sortKey, setSortKey] = useState<string | null>(null);
  const [sortDir, setSortDir] = useState<'asc' | 'desc'>('asc');
  const [expanded, setExpanded] = useState<Set<string>>(new Set());

  function handleSort(key: string) {
    if (sortKey === key) {
      setSortDir(d => (d === 'asc' ? 'desc' : 'asc'));
    } else {
      setSortKey(key);
      setSortDir('asc');
    }
  }

  function toggleExpand(id: string) {
    setExpanded(prev => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  const sortedRows = sortKey
    ? [...rows].sort((a, b) => {
        // Generic sort by JSON string — specific tables should handle this
        const va = JSON.stringify((a as Record<string, unknown>)[sortKey] ?? '');
        const vb = JSON.stringify((b as Record<string, unknown>)[sortKey] ?? '');
        return sortDir === 'asc' ? va.localeCompare(vb) : vb.localeCompare(va);
      })
    : rows;

  if (loading) {
    return (
      <div className={cn('border border-zinc-200 rounded-sm overflow-hidden', className)}>
        <div className="divide-y divide-zinc-100">
          {Array.from({ length: 6 }).map((_, i) => (
            <div key={i} className="flex gap-4 px-3 py-2.5 animate-pulse">
              {columns.map(c => (
                <div key={c.key} className="h-4 bg-zinc-100 rounded flex-1" />
              ))}
            </div>
          ))}
        </div>
      </div>
    );
  }

  return (
    <div className={cn('border border-zinc-200 rounded-sm overflow-x-auto', className)}>
      <table className="w-full text-sm border-collapse">
        <thead>
          <tr className="bg-zinc-50 border-b border-zinc-200">
            {expandRow && <th className="w-8" />}
            {columns.map(col => (
              <th
                key={col.key}
                className={cn(
                  'px-3 py-2 text-2xs font-semibold uppercase tracking-wide text-zinc-500 whitespace-nowrap text-left',
                  col.align === 'right' && 'text-right',
                  col.align === 'center' && 'text-center',
                  col.sortable && 'cursor-pointer select-none hover:text-zinc-800',
                  col.width,
                )}
                onClick={col.sortable ? () => handleSort(col.key) : undefined}
              >
                {col.header}
                {col.sortable && (
                  <SortIcon dir={sortKey === col.key ? sortDir : null} />
                )}
              </th>
            ))}
          </tr>
        </thead>
        <tbody className="divide-y divide-zinc-100">
          {sortedRows.length === 0 ? (
            <tr>
              <td
                colSpan={columns.length + (expandRow ? 1 : 0)}
                className="px-3 py-8 text-center text-sm text-zinc-400"
              >
                {emptyMessage}
              </td>
            </tr>
          ) : (
            sortedRows.map((row, idx) => {
              const id = rowKey(row);
              const isExpanded = expanded.has(id);
              return (
                <>
                  <tr
                    key={id}
                    className={cn(
                      'hover:bg-zinc-50 transition-colors',
                      onRowClick && 'cursor-pointer',
                      isExpanded && 'bg-zinc-50',
                    )}
                    onClick={() => {
                      if (expandRow) toggleExpand(id);
                      onRowClick?.(row);
                    }}
                  >
                    {expandRow && (
                      <td className="w-8 px-2 text-center text-zinc-400">
                        <ChevronDown
                          className={cn(
                            'inline transition-transform',
                            isExpanded && 'rotate-180',
                          )}
                        />
                      </td>
                    )}
                    {columns.map(col => (
                      <td
                        key={col.key}
                        className={cn(
                          'px-3 py-2 whitespace-nowrap text-zinc-800',
                          col.align === 'right' && 'text-right',
                          col.align === 'center' && 'text-center',
                        )}
                      >
                        {col.cell(row, idx)}
                      </td>
                    ))}
                  </tr>
                  {expandRow && isExpanded && (
                    <tr key={`${id}-expanded`} className="bg-zinc-50 border-b border-zinc-200">
                      <td colSpan={columns.length + 1} className="px-4 py-3">
                        {expandRow(row)}
                      </td>
                    </tr>
                  )}
                </>
              );
            })
          )}
        </tbody>
      </table>
    </div>
  );
}
