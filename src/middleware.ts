import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';

// 보호할 라우트 경로 설정
const protectedRoutes = ['/admin', '/inbound'];
const authRoutes = ['/login', '/signup'];

export function middleware(request: NextRequest) {
  const token = request.cookies.get('token')?.value;
  const role = request.cookies.get('role')?.value;
  const { pathname } = request.nextUrl;

  // 1. 루트 경로(/) 접근 시 역할에 따른 리다이렉트
  if (pathname === '/') {
    if (!token) return NextResponse.redirect(new URL('/login', request.url));
    if (role === 'WORKER') return NextResponse.redirect(new URL('/inbound', request.url));
    if (role === 'MASTER') return NextResponse.redirect(new URL('/admin', request.url));
    return NextResponse.redirect(new URL('/login', request.url));
  }

  const isProtectedRoute = protectedRoutes.some(route => pathname.startsWith(route));
  const isAuthRoute = authRoutes.some(route => pathname.startsWith(route));

  // 2. 방어 로직: 토큰이 없는데 보호된 라우트에 접근하려는 경우
  if (!token && isProtectedRoute) {
    return NextResponse.redirect(new URL('/login', request.url));
  }

  // 3. 방어 로직: 이미 토큰이 있는데 로그인/회원가입 페이지에 접근하려는 경우
  if (token && isAuthRoute) {
    return NextResponse.redirect(new URL('/', request.url));
  }

  // 4. RBAC (Role-Based Access Control) 라우트 가드
  if (token && role) {
    // WORKER가 관리자 페이지(/admin/*)에 접근 시도 시 차단
    if (role === 'WORKER' && pathname.startsWith('/admin')) {
      return NextResponse.redirect(new URL('/inbound', request.url));
    }
    // MASTER가 현장 작업자용(/inbound/*) 접근 시도 시 차단
    if (role === 'MASTER' && pathname.startsWith('/inbound')) {
      return NextResponse.redirect(new URL('/admin', request.url));
    }
  }

  return NextResponse.next();
}

export const config = {
  matcher: ['/((?!api|_next/static|_next/image|favicon.ico).*)'],
};
