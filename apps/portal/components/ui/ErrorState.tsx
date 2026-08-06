interface ErrorStateProps {
  title?: string;
  message?: string;
}

export function ErrorState({
  title = 'Something went wrong',
  message = 'Please try refreshing the page. If the problem persists, contact support.',
}: ErrorStateProps) {
  return (
    <div className="rounded-xl border border-red-200 bg-red-50 p-6 text-center">
      <div className="mx-auto mb-3 flex h-10 w-10 items-center justify-center rounded-full bg-red-100">
        <svg className="h-5 w-5 text-red-600" viewBox="0 0 20 20" fill="currentColor" aria-hidden="true">
          <path
            fillRule="evenodd"
            d="M10 18a8 8 0 100-16 8 8 0 000 16zm-1-7V7a1 1 0 112 0v4a1 1 0 11-2 0zm1 2.25a.75.75 0 110 1.5.75.75 0 010-1.5z"
            clipRule="evenodd"
          />
        </svg>
      </div>
      <p className="font-semibold text-red-800">{title}</p>
      <p className="mt-1 text-sm text-red-600">{message}</p>
    </div>
  );
}
