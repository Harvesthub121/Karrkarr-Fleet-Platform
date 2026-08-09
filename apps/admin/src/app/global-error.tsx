'use client';

export default function GlobalError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  return (
    <html lang="en">
      <body style={{fontFamily: 'system-ui, sans-serif', padding: '2rem', background: '#0a0a0a', color: '#fff'}}>
        <h1 style={{color: '#f87171'}}>Admin Portal Error</h1>
        <p style={{color: '#fbbf24'}}>Real error message:</p>
        <pre style={{background: '#1a1a1a', padding: '1rem', borderRadius: '8px', overflow: 'auto', color: '#f87171'}}>
          {error.message}
          {error.stack && '\n\nStack:\n' + error.stack}
          {error.digest && '\n\nDigest: ' + error.digest}
        </pre>
        <button
          onClick={reset}
          style={{marginTop: '1rem', padding: '0.5rem 1rem', background: '#0d9488', color: '#fff', border: 'none', borderRadius: '4px', cursor: 'pointer'}}
        >
          Try again
        </button>
      </body>
    </html>
  );
}
