import { NextRequest, NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import { getSession, setSession } from '@/lib/session';

const API_URL = process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:3000/api';

export async function POST(_req: NextRequest) {
  const session = await getSession();
  if (!session) {
    return NextResponse.json({ message: 'Not authenticated' }, { status: 401 });
  }

  const res = await fetch(`${API_URL}/auth/customer/refresh`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ refreshToken: session.refreshToken }),
  });

  if (!res.ok) {
    return NextResponse.json({ message: 'Refresh failed' }, { status: 401 });
  }

  const tokens = await res.json() as { accessToken: string; refreshToken: string };
  const store = await cookies();
  await setSession({ ...session, ...tokens }, store);

  return NextResponse.json({ ok: true });
}
