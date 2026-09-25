import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';

const SESSION_COOKIE_NAME = 'ai_interview_session';

export function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;
  const sessionCookie = request.cookies.get(SESSION_COOKIE_NAME);

  // Direct candidate sign-in/dashboard is disabled (candidates can only join via recruiter invitation)
  if (pathname.startsWith('/applicant')) {
    return NextResponse.redirect(new URL('/', request.url));
  }

  // Recruiter route protection
  const isRecruiterProtected = pathname.startsWith('/recruiter') && 
    !pathname.startsWith('/recruiter/sign-in') && 
    !pathname.startsWith('/recruiter/sign-up');

  if (isRecruiterProtected && !sessionCookie) {
    const loginUrl = new URL('/recruiter/sign-in', request.url);
    loginUrl.searchParams.set('redirect', pathname);
    return NextResponse.redirect(loginUrl);
  }

  return NextResponse.next();
}

export const config = {
  matcher: [
    '/recruiter/:path*',
    '/applicant/:path*',
    '/dashboard/:path*',
  ],
};
