import { NextRequest, NextResponse } from 'next/server';
import { jwtVerify } from 'jose';

const COOKIE_NAME = process.env.COOKIE_NAME ?? 'karrkarr_portal_session';
const SECRET_RAW = process.env.SESSION_SECRET ?? 'dev-secret-change-in-production-32ch';

function getSecret(): Uint8Array {
  return new TextEncoder().encode(SECRET_RAW.padEnd(32, '0').slice(0, 64));
}

const PUBLIC_PATHS = ['/login', '/api/auth/login', '/api/auth/refresh', '/api/auth/logout'];

export async function middleware(req: NextRequest) {
  const { pathname } = req.nextUrl;

  // Allow public paths through
  if (PUBLIC_PATHS.some(p => pathname.startsWith(p))) {
    return NextResponse.next();
  }

  // Allow Next.js internals
  if (pathname.startsWith('/_next') || pathname.startsWith('/favicon')) {
    return NextResponse.next();
  }

  const cookie = req.cookies.get(COOKIE_NAME);

  if (!cookie?.value) {
    return NextResponse.redirect(new URL('/login', req.url));
  }

  try {
    await jwtVerify(cookie.value, getSecret());
    return NextResponse.next();
  } catch {
    // Token invalid or expired — send to login and clear the bad cookie
    const res = NextResponse.redirect(new URL('/login', req.url));
    res.cookies.set(COOKIE_NAME, '', { maxAge: 0, path: '/' });
    return res;
  }
}

export const config = {
  matcher: [
    /*
     * Match all paths except _next/static, _next/image, and image files.
     */
    '/((?!_next/static|_next/image|.*\\.(?:png|jpg|jpeg|gif|svg|ico|webp)$).*)',
  ],
};
