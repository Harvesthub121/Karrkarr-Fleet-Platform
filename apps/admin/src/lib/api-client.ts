/**
 * Typed fetch wrapper with automatic JWT refresh on 401.
 * Access token is read from sessionStorage (karrkarr_admin_session) and
 * attached as Authorization: Bearer header on every request.
 */

const API_BASE = process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:3000';

const SESSION_KEY = 'karrkarr_admin_session';

class ApiError extends Error {
  constructor(
    public status: number,
    public body: unknown,
    message?: string,
  ) {
    super(message ?? `API error ${status}`);
    this.name = 'ApiError';
  }
}

function getSession(): { accessToken: string; refreshToken: string } | null {
  if (typeof window === 'undefined') return null;
  try {
    const raw = sessionStorage.getItem(SESSION_KEY);
    return raw ? JSON.parse(raw) : null;
  } catch {
    return null;
  }
}

function setSession(data: { accessToken: string; refreshToken: string }) {
  if (typeof window === 'undefined') return;
  const existing = getSession();
  sessionStorage.setItem(SESSION_KEY, JSON.stringify({ ...existing, ...data }));
}

function clearSession() {
  if (typeof window === 'undefined') return;
  sessionStorage.removeItem(SESSION_KEY);
}

let refreshPromise: Promise<boolean> | null = null;

async function refreshTokens(): Promise<boolean> {
  try {
    const session = getSession();
    if (!session?.refreshToken) return false;
    const res = await fetch(`${API_BASE}/auth/admin/refresh`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ refreshToken: session.refreshToken }),
    });
    if (!res.ok) return false;
    const data = await res.json();
    const tokens = data.tokens ?? data;
    if (tokens.accessToken) {
      setSession({ accessToken: tokens.accessToken, refreshToken: tokens.refreshToken ?? session.refreshToken });
      return true;
    }
    return false;
  } catch {
    return false;
  }
}

export async function apiFetch<T>(
  path: string,
  init: RequestInit = {},
  retry = true,
): Promise<T> {
  const session = getSession();
  const authHeader = session?.accessToken
    ? { Authorization: `Bearer ${session.accessToken}` }
    : {};

  const res = await fetch(`${API_BASE}${path}`, {
    ...init,
    headers: {
      'Content-Type': 'application/json',
      ...authHeader,
      ...(init.headers ?? {}),
    },
  });

  if (res.status === 401 && retry) {
    if (!refreshPromise) {
      refreshPromise = refreshTokens().finally(() => {
        refreshPromise = null;
      });
    }
    const ok = await refreshPromise;
    if (ok) return apiFetch<T>(path, init, false);
    // Hard logout
    clearSession();
    if (typeof window !== 'undefined') {
      window.location.href = '/login';
    }
    throw new ApiError(401, null, 'Session expired');
  }

  if (!res.ok) {
    let body: unknown;
    try { body = await res.json(); } catch { body = null; }
    throw new ApiError(res.status, body);
  }

  if (res.status === 204) return undefined as T;

  return res.json() as Promise<T>;
}

export function apiGet<T>(path: string, params?: Record<string, string | number | boolean | undefined>) {
  const url = params
    ? `${path}?${new URLSearchParams(
        Object.entries(params)
          .filter(([, v]) => v !== undefined)
          .map(([k, v]) => [k, String(v)]),
      )}`
    : path;
  return apiFetch<T>(url);
}

export function apiPost<T>(path: string, body?: unknown) {
  return apiFetch<T>(path, {
    method: 'POST',
    body: body ? JSON.stringify(body) : undefined,
  });
}

export function apiPatch<T>(path: string, body?: unknown) {
  return apiFetch<T>(path, {
    method: 'PATCH',
    body: body ? JSON.stringify(body) : undefined,
  });
}

export function apiDelete<T>(path: string) {
  return apiFetch<T>(path, { method: 'DELETE' });
}

export { ApiError };
