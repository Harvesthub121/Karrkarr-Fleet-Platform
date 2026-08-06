import { Suspense } from 'react';
import { getMyDocuments } from '@/lib/api';
import { formatDate, documentTypeLabel, documentGroupOrder, fileSizeLabel } from '@/lib/utils';
import { CardSkeleton } from '@/components/ui/Skeleton';
import { ErrorState } from '@/components/ui/ErrorState';
import { EmptyState } from '@/components/ui/EmptyState';
import { ApiError } from '@/lib/api-client';
import type { CustomerDocument } from '@/lib/api';

export const metadata = { title: 'Documents — Vida Partners Portal' };
export const dynamic = 'force-dynamic';

function groupDocuments(docs: CustomerDocument[]) {
  const groups = new Map<string, CustomerDocument[]>();
  for (const doc of docs) {
    const existing = groups.get(doc.type) ?? [];
    existing.push(doc);
    groups.set(doc.type, existing);
  }
  return [...groups.entries()].sort(
    ([a], [b]) => documentGroupOrder(a) - documentGroupOrder(b),
  );
}

async function DocumentsContent() {
  let docs: CustomerDocument[];
  try {
    docs = await getMyDocuments();
  } catch (err) {
    return <ErrorState title="Could not load documents" message={err instanceof ApiError ? String(err.status) : undefined} />;
  }

  if (docs.length === 0) {
    return (
      <EmptyState
        title="No documents yet"
        message="Your rental agreement, receipts, and other documents will appear here once available."
        icon={
          <svg className="h-6 w-6" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" aria-hidden="true">
            <path strokeLinecap="round" strokeLinejoin="round" d="M19.5 14.25v-2.625a3.375 3.375 0 00-3.375-3.375h-1.5A1.125 1.125 0 0113.5 7.125v-1.5a3.375 3.375 0 00-3.375-3.375H8.25m0 12.75h7.5m-7.5 3H12M10.5 2.25H5.625c-.621 0-1.125.504-1.125 1.125v17.25c0 .621.504 1.125 1.125 1.125h12.75c.621 0 1.125-.504 1.125-1.125V11.25a9 9 0 00-9-9z" />
          </svg>
        }
      />
    );
  }

  const groups = groupDocuments(docs);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-lg font-bold text-gray-900">Documents</h1>
        <p className="text-sm text-gray-500 mt-0.5">Download links are valid for 15 minutes.</p>
      </div>

      {groups.map(([type, items]) => (
        <section key={type} aria-labelledby={`group-${type}`}>
          <div className="card">
            <h2 id={`group-${type}`} className="mb-3 text-xs font-semibold uppercase tracking-widest text-gray-400">
              {documentTypeLabel(type)}
            </h2>
            <ul className="divide-y divide-gray-100" role="list">
              {items.map(doc => (
                <li key={doc.id} className="flex items-center gap-3 py-3">
                  <div className="flex h-9 w-9 flex-none items-center justify-center rounded-lg bg-gray-100">
                    <FileIcon mimeType={doc.mimeType} />
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-medium text-gray-900">{doc.title}</p>
                    <p className="text-xs text-gray-400 mt-0.5">
                      {formatDate(doc.createdAt)}
                      {' · '}
                      {fileSizeLabel(doc.sizeBytes)}
                      {doc.expiresAt && ` · Expires ${formatDate(doc.expiresAt)}`}
                    </p>
                  </div>
                  {doc.downloadUrl ? (
                    <a
                      href={doc.downloadUrl}
                      download
                      target="_blank"
                      rel="noopener noreferrer"
                      className="flex-none btn-ghost text-xs px-3 py-1.5"
                      aria-label={`Download ${doc.title}`}
                    >
                      <svg className="h-4 w-4 text-teal-600" viewBox="0 0 16 16" fill="currentColor" aria-hidden="true">
                        <path d="M7.25 9.75a.75.75 0 001.5 0V3a.75.75 0 00-1.5 0v6.75z"/>
                        <path d="M3.5 9a.75.75 0 00-1.5 0v3.25c0 .966.784 1.75 1.75 1.75h8.5A1.75 1.75 0 0014 12.25V9a.75.75 0 00-1.5 0v3.25a.25.25 0 01-.25.25h-8.5a.25.25 0 01-.25-.25V9z"/>
                        <path d="M4.22 7.97a.75.75 0 001.06 1.06l2.22-2.22 2.22 2.22a.75.75 0 101.06-1.06l-2.75-2.75a.75.75 0 00-1.06 0L4.22 7.97z"/>
                      </svg>
                      Download
                    </a>
                  ) : (
                    <span className="text-xs text-gray-400 flex-none">Unavailable</span>
                  )}
                </li>
              ))}
            </ul>
          </div>
        </section>
      ))}
    </div>
  );
}

function FileIcon({ mimeType }: { mimeType: string }) {
  const isPdf = mimeType.includes('pdf');
  const isImage = mimeType.startsWith('image/');

  if (isPdf) {
    return (
      <svg className="h-5 w-5 text-red-500" viewBox="0 0 20 20" fill="currentColor" aria-hidden="true">
        <path fillRule="evenodd" d="M4 4a2 2 0 012-2h4.586A2 2 0 0112 2.586L15.414 6A2 2 0 0116 7.414V16a2 2 0 01-2 2H6a2 2 0 01-2-2V4zm2 6a1 1 0 011-1h6a1 1 0 110 2H7a1 1 0 01-1-1zm1 3a1 1 0 100 2h6a1 1 0 100-2H7z" clipRule="evenodd" />
      </svg>
    );
  }
  if (isImage) {
    return (
      <svg className="h-5 w-5 text-blue-400" viewBox="0 0 20 20" fill="currentColor" aria-hidden="true">
        <path fillRule="evenodd" d="M1 5.25A2.25 2.25 0 013.25 3h13.5A2.25 2.25 0 0119 5.25v9.5A2.25 2.25 0 0116.75 17H3.25A2.25 2.25 0 011 14.75v-9.5zm1.5 5.81v3.69c0 .414.336.75.75.75h13.5a.75.75 0 00.75-.75v-2.69l-2.22-2.219a.75.75 0 00-1.06 0l-1.91 1.909.47.47a.75.75 0 11-1.06 1.06L6.53 8.091a.75.75 0 00-1.06 0l-2.97 2.97zM12 7a1 1 0 11-2 0 1 1 0 012 0z" clipRule="evenodd" />
      </svg>
    );
  }
  return (
    <svg className="h-5 w-5 text-gray-400" viewBox="0 0 20 20" fill="currentColor" aria-hidden="true">
      <path fillRule="evenodd" d="M4 4a2 2 0 012-2h4.586A2 2 0 0112 2.586L15.414 6A2 2 0 0116 7.414V16a2 2 0 01-2 2H6a2 2 0 01-2-2V4z" clipRule="evenodd" />
    </svg>
  );
}

export default function DocumentsPage() {
  return (
    <Suspense fallback={<div className="space-y-5"><CardSkeleton /><CardSkeleton /></div>}>
      <DocumentsContent />
    </Suspense>
  );
}
