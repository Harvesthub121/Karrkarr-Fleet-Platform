/**
 * Session helpers — read/write the httpOnly cookie that stores the customer's
 * JWT pair plus basic identity.
 *
 * We use `jose` for a lightweight signed JWT wrapping the session payload so
 * the cookie is tamper-evident without a database round-trip on every request.
 */

import { cookies } from 'next/headers';
import { SignJWT, jwtVerify } from 'jose';

export interface SessionPayload {
  customerId: string;
  email: string;
  fullName: string;
  customerRef: string;
  accessToken: string;
  refreshToken: string;
}

const COOKIE_NAME = process.env.COOKIE_NAME ?? 'vida_portal_session';
const SECRET_RAW = process.env.SESSION_SECRET ?? 'dev-secret-change-in-production-32ch';

function getSecret(): Uint8Array {
  return new TextEncoder().encode(SECRET_RAW.padEnd(32, '0').slice(0, 64));
}

export async function encryptSession(payload: SessionPayload): Promise<string> {
  return new SignJWT({ ...payload })
    .setProtectedHeader({ alg: 'HS256' })
    .setIssuedAt()
    .setExpirationTime('7d')
    .sign(getSecret());
}

export async function decryptSession(token: string): Promise<SessionPayload | null> {
  try {
    const { payload } = await jwtVerify(token, getSecret());
    return payload as unknown as SessionPayload;
  } catch {
    return null;
  }
}

export async function getSession(): Promise<SessionPayload | null> {
  const store = await cookies();
  const raw = store.get(COOKIE_NAME)?.value;
  if (!raw) return null;
  return decryptSession(raw);
}

export async function setSession(
  payload: SessionPayload,
  cookieStore?: Awaited<ReturnType<typeof cookies>>,
): Promise<void> {
  const encrypted = await encryptSession(payload);
  const store = cookieStore ?? (await cookies());
  store.set(COOKIE_NAME, encrypted, {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax',
    path: '/',
    maxAge: 60 * 60 * 24 * 7, // 7 days
  });
}

export async function clearSession(
  cookieStore?: Awaited<ReturnType<typeof cookies>>,
): Promise<void> {
  const store = cookieStore ?? (await cookies());
  store.set(COOKIE_NAME, '', { maxAge: 0, path: '/' });
}

export async function updateSessionTokens(
  accessToken: string,
  refreshToken: string,
): Promise<void> {
  const session = await getSession();
  if (!session) return;
  await setSession({ ...session, accessToken, refreshToken });
}
