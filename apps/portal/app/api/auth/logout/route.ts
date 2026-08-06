import { NextRequest, NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import { getSession, clearSession } from '@/lib/session';

const API_URL = process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:3000/api';

export async function POST(_req: NextRequest) {
  const session = await getSession();

  // Best-effort: tell the API to revoke the refresh token
  if (session) {
    try {
      await fetch(`${API_URL}/auth/customer/logout`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${session.accessToken}`,
        },
        body: JSON.stringify({ refreshToken: session.refreshToken }),
      });
    } catch {
      // Ignore — the cookie is cleared regardless
    }
  }

  const store = await cookies();
  await clearSession(store);

  return NextResponse.json({ ok: true });
}
