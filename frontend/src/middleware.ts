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

async function hasValidSession(request: NextRequest): Promise<boolean> {
  const token = request.cookies.get('accessToken')?.value;
  
  // Fast fail if no token
  if (!token) return false;

  const apiBaseUrl = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:5000/api/v1';

  try {
    const response = await fetch(`${apiBaseUrl}/auth/me`, {
      method: 'GET',
      headers: {
        'Authorization': `Bearer ${token}`,
      },
      cache: 'no-store',
    });

    return response.ok;
  } catch (error) {
    console.error('Middleware session check failed:', error);
    return false;
  }
}

export async function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;

  if (pathname.startsWith('/auth/callback') || pathname.startsWith('/_next') || pathname.includes('.')) {
    return NextResponse.next();
  }

  const isProtected = PROTECTED_PATHS.some((p) => pathname === p || pathname.startsWith(p + '/'));
  const isAuthPath = AUTH_PATHS.some((p) => pathname === p || pathname.startsWith(p + '/'));

  if (!isProtected && !isAuthPath) {
    return NextResponse.next();
  }

  const hasSession = await hasValidSession(request);

  if (isProtected && !hasSession) {
    const loginUrl = new URL('/login', request.url);
    loginUrl.searchParams.set('from', pathname);
    return NextResponse.redirect(loginUrl);
  }

  if (isAuthPath && hasSession) {
    return NextResponse.redirect(new URL('/dashboard', request.url));
  }

  return NextResponse.next();
}

export const config = {
  matcher: [
    '/((?!api|_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)',
  ],
};
