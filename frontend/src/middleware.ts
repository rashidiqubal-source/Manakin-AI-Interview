import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';

const SESSION_COOKIE_NAME = 'ai_interview_session';

export function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;
  const sessionCookie = request.cookies.get(SESSION_COOKIE_NAME);

  // Check if route is protected
  const isRecruiterProtected = pathname.startsWith('/recruiter') && 
    !pathname.startsWith('/recruiter/sign-in') && 
    !pathname.startsWith('/recruiter/sign-up');

  const isApplicantProtected = pathname.startsWith('/applicant/dashboard');

  const isInterviewProtected = pathname.startsWith('/interview');

  if (isRecruiterProtected && !sessionCookie) {
    const loginUrl = new URL('/recruiter/sign-in', request.url);
    loginUrl.searchParams.set('redirect', pathname);
    return NextResponse.redirect(loginUrl);
  }

  if ((isApplicantProtected || isInterviewProtected) && !sessionCookie) {
    const loginUrl = new URL('/applicant/sign-in', request.url);
    loginUrl.searchParams.set('redirect', pathname);
    return NextResponse.redirect(loginUrl);
  }

  return NextResponse.next();
}

export const config = {
  matcher: [
    '/recruiter/:path*',
    '/applicant/dashboard/:path*',
    '/interview/:path*',
    '/dashboard/:path*',
  ],
};
