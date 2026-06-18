import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';

const PROTECTED_PATHS = [
  '/dashboard',
  '/interviews',
  '/analytics',
  '/profile',
  '/settings',
  '/questions',
  '/study-plan',
  '/achievements',
  '/leaderboard',
  '/preparation',
  '/session',
  '/processing'
];

const AUTH_PATHS = ['/login', '/register', '/forgot-password', '/reset-password'];

export function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;

  // Skip static assets, API routes, auth callbacks
  if (pathname.startsWith('/auth/callback') || pathname.startsWith('/_next') || pathname.includes('.')) {
    return NextResponse.next();
  }

  const isProtected = PROTECTED_PATHS.some((p) => pathname === p || pathname.startsWith(p + '/'));
  const isAuthPath = AUTH_PATHS.some((p) => pathname === p || pathname.startsWith(p + '/'));

  if (!isProtected && !isAuthPath) {
    return NextResponse.next();
  }

  // Lightweight check: only verify that the accessToken cookie exists.
  // The client-side api.ts interceptor handles token refresh and expiry.
  // This prevents the middleware from blocking users whose tokens expired
  // during long-running interviews.
  const hasToken = !!request.cookies.get('accessToken')?.value;

  if (isProtected && !hasToken) {
    const loginUrl = new URL('/login', request.url);
    loginUrl.searchParams.set('from', pathname);
    return NextResponse.redirect(loginUrl);
  }

  if (isAuthPath && hasToken) {
    return NextResponse.redirect(new URL('/dashboard', request.url));
  }

  return NextResponse.next();
}

export const config = {
  matcher: [
    '/((?!api|_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)',
  ],
};

