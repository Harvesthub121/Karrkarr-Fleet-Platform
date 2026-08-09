/**
 * Typed fetch wrapper for the Karrkarr admin portal.
 * Reads JWT from sessionStorage and attaches as Authorization header.
 */

const API_BASE = process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:3000';
const SESSION_KEY = 'karrkarr_admin_session';

export class ApiError extends Error {
  constructor(
    public status: number,
    public body: unknown,
    message?: string,
  ) {
    super(message ?? `API error ${status}`);
    this.name = 'ApiError';
  }
}

function getToken(): string | null {
  if (typeof window === 'undefined') return null;
  try {
    const raw = sessionStorage.getItem(SESSION_KEY);
    if (!raw) return null;
    const data = JSON.parse(raw);
    return data?.accessToken ?? null;
  } catch {
    return null;
  }
}

export async function apiFetch<T>(
  path: string,
  init: RequestInit = {},
  _retry = true,
): Promise<T> {
  const token = getToken();
  const baseHeaders: Record<string, string> = { 'Content-Type': 'application/json' };
  if (token) baseHeaders['Authorization'] = `Bearer ${token}`;

  const res = await fetch(`${API_BASE}${path}`, {
    ...init,
    headers: { ...baseHeaders, ...(init.headers as Record<string, string> ?? {}) },
  });

  if (!res.ok) {
    if (res.status === 401 && typeof window !== 'undefined') {
      // Clear session and redirect to login
      sessionStorage.removeItem(SESSION_KEY);
      window.location.href = '/login';
      throw new ApiError(401, null, 'Session expired');
    }
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
  return apiFetch<T>(path, { method: 'POST', body: body ? JSON.stringify(body) : undefined });
}

export function apiPatch<T>(path: string, body?: unknown) {
  return apiFetch<T>(path, { method: 'PATCH', body: body ? JSON.stringify(body) : undefined });
}

export function apiDelete<T>(path: string) {
  return apiFetch<T>(path, { method: 'DELETE' });
}
