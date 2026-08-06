/**
 * Transparent API proxy — Client Components call /api/proxy/... and this
 * handler injects the httpOnly-cookie access token before forwarding to the
 * actual API. Handles 401 by refreshing and retrying once.
 */

import { NextRequest, NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import { getSession, setSession } from '@/lib/session';

const API_URL = process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:3000/api';

async function forwardWithBody(
  req: NextRequest,
  upstreamPath: string,
  accessToken: string,
  body: ArrayBuffer | undefined,
): Promise<Response> {
  const url = `${API_URL}${upstreamPath}${req.nextUrl.search}`;

  const headers = new Headers(req.headers);
  headers.set('Authorization', `Bearer ${accessToken}`);
  headers.delete('host');
  headers.delete('cookie');

  return fetch(url, {
    method: req.method,
    headers,
    body: body && body.byteLength > 0 ? body : undefined,
  });
}

export async function GET(req: NextRequest, { params }: { params: Promise<{ path: string[] }> }) {
  return handleProxy(req, await params);
}
export async function POST(req: NextRequest, { params }: { params: Promise<{ path: string[] }> }) {
  return handleProxy(req, await params);
}
export async function PATCH(req: NextRequest, { params }: { params: Promise<{ path: string[] }> }) {
  return handleProxy(req, await params);
}
export async function PUT(req: NextRequest, { params }: { params: Promise<{ path: string[] }> }) {
  return handleProxy(req, await params);
}
export async function DELETE(req: NextRequest, { params }: { params: Promise<{ path: string[] }> }) {
  return handleProxy(req, await params);
}

async function handleProxy(
  req: NextRequest,
  params: { path: string[] },
): Promise<NextResponse> {
  const session = await getSession();
  if (!session) {
    return NextResponse.json({ message: 'Unauthenticated' }, { status: 401 });
  }

  const upstreamPath = '/' + params.path.join('/');

  // Read body once so we can replay it on 401
  const bodyBuffer =
    req.method !== 'GET' && req.method !== 'HEAD'
      ? await req.arrayBuffer()
      : undefined;

  let res = await forwardWithBody(req, upstreamPath, session.accessToken, bodyBuffer);

  if (res.status === 401) {
    // Attempt token rotation
    const refreshRes = await fetch(`${API_URL}/auth/customer/refresh`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ refreshToken: session.refreshToken }),
    });

    if (!refreshRes.ok) {
      return NextResponse.json({ message: 'Session expired' }, { status: 401 });
    }

    const tokens = (await refreshRes.json()) as { accessToken: string; refreshToken: string };
    const store = await cookies();
    await setSession({ ...session, ...tokens }, store);

    // Replay with new token — body already buffered so safe to reuse
    res = await forwardWithBody(req, upstreamPath, tokens.accessToken, bodyBuffer);
  }

  const resBody = await res.arrayBuffer();
  const nextRes = new NextResponse(resBody.byteLength > 0 ? resBody : null, {
    status: res.status,
    headers: {
      'content-type': res.headers.get('content-type') ?? 'application/json',
    },
  });

  return nextRes;
}
