import { NextRequest, NextResponse } from 'next/server';

const PUBLIC_ROUTES = new Set(['/login']);

export function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;

  // Allow public routes and Next.js internals
  if (
    PUBLIC_ROUTES.has(pathname) ||
    pathname.startsWith('/_next') ||
    pathname.startsWith('/api') ||
    pathname.includes('.')
  ) {
    return NextResponse.next();
  }

  // Check for session cookie. The API sets an httpOnly `vida_access` cookie on login.
  // We use a non-httpOnly `vida_authed` flag cookie so middleware can read it.
  const authed = request.cookies.get('vida_authed');
  if (!authed?.value) {
    const loginUrl = new URL('/login', request.url);
    loginUrl.searchParams.set('redirect', pathname);
    return NextResponse.redirect(loginUrl);
  }

  return NextResponse.next();
}

export const config = {
  matcher: ['/((?!_next/static|_next/image|favicon.ico).*)'],
};
