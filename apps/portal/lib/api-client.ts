/**
 * Typed fetch wrapper for the Vida Partners customer portal.
 *
 * Token lifecycle:
 *  - Access token is stored server-side in an httpOnly cookie via the
 *    /api/auth/login route handler (never readable from JS).
 *  - On every request, the route handler or server action attaches the token
 *    from the cookie into the Authorization header.
 *  - When a request returns 401, the client calls POST /api/auth/refresh,
 *    swaps the refresh token for a new pair, and replays the original request
 *    once. A second 401 after replay signals a fully expired session and
 *    redirects to /login.
 */

export class ApiError extends Error {
  constructor(
    public readonly status: number,
    public readonly body: unknown,
    message?: string,
  ) {
    super(message ?? `API error ${status}`);
    this.name = 'ApiError';
  }
}

type RequestOptions = Omit<RequestInit, 'body'> & {
  body?: unknown;
  /** Skip the 401-retry loop (used internally for the refresh call itself). */
  _skipRefresh?: boolean;
};

const API_URL =
  process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:3000/api';

/**
 * Server-side API client — attach accessToken from cookie/session store.
 * The token is injected via `withToken()` below.
 */
export async function apiFetch<T>(
  path: string,
  opts: RequestOptions & { accessToken: string; refreshToken?: string },
): Promise<T> {
  const { accessToken, refreshToken, _skipRefresh, body, ...fetchOpts } = opts;

  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    Authorization: `Bearer ${accessToken}`,
    ...(fetchOpts.headers as Record<string, string> | undefined),
  };

  const res = await fetch(`${API_URL}${path}`, {
    ...fetchOpts,
    headers,
    body: body !== undefined ? JSON.stringify(body) : undefined,
  });

  if (res.status === 401 && !_skipRefresh && refreshToken) {
    // Attempt token rotation
    const refreshRes = await fetch(`${API_URL}/auth/customer/refresh`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ refreshToken }),
    });

    if (!refreshRes.ok) {
      throw new ApiError(401, null, 'Session expired');
    }

    const tokens = (await refreshRes.json()) as {
      accessToken: string;
      refreshToken: string;
    };

    // Replay with new token — _skipRefresh prevents infinite recursion
    return apiFetch<T>(path, {
      ...opts,
      accessToken: tokens.accessToken,
      refreshToken: tokens.refreshToken,
      _skipRefresh: true,
    });
  }

  if (!res.ok) {
    let errBody: unknown;
    try {
      errBody = await res.json();
    } catch {
      errBody = await res.text();
    }
    throw new ApiError(res.status, errBody);
  }

  if (res.status === 204) return undefined as T;
  return res.json() as Promise<T>;
}

/**
 * Browser-side client used from Client Components / route handlers.
 * Tokens are held in httpOnly cookies, so the browser never touches them
 * directly. The actual token injection happens in route handlers or server
 * actions using `getSession()`. This thin wrapper is for convenience only.
 */
export async function browserFetch<T>(
  path: string,
  opts: Omit<RequestOptions, 'accessToken' | 'refreshToken'> = {},
): Promise<T> {
  const { body, ...fetchOpts } = opts;

  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    ...(fetchOpts.headers as Record<string, string> | undefined),
  };

  const res = await fetch(`/api/proxy${path}`, {
    ...fetchOpts,
    headers,
    body: body !== undefined ? JSON.stringify(body) : undefined,
    credentials: 'include',
  });

  if (!res.ok) {
    let errBody: unknown;
    try {
      errBody = await res.json();
    } catch {
      errBody = await res.text();
    }
    throw new ApiError(res.status, errBody);
  }

  if (res.status === 204) return undefined as T;
  return res.json() as Promise<T>;
}
