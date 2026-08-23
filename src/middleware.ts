import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';
import { isJwtUsable } from '@/shared/lib/jwt';

// 수동 및 역할 기반 접근 제어 (RBAC) 라우트 설정
const protectedRoutes = ['/admin', '/worker', '/inbound', '/inventory', '/inspections', '/returns', '/orders', '/mypage'];
const authRoutes = ['/login', '/signup'];

export function middleware(request: NextRequest) {
  // 만료·손상 토큰은 비로그인으로 취급한다. 쿠키 존재만 보면 만료 쿠키가 /login 접근을
  // 홈으로 되튕겨 로그인 페이지에 도달할 수 없는 교착이 생긴다 (2026-08-24 실사고).
  const rawToken = request.cookies.get('token')?.value;
  const token = isJwtUsable(rawToken) ? rawToken : undefined;
  const role = request.cookies.get('role')?.value;
  const { pathname } = request.nextUrl;

  // 무효 쿠키는 응답에서 지워 다음 요청부터 깨끗한 상태로 만든다 (HttpOnly라 서버만 지울 수 있다).
  const withCleanup = (res: NextResponse) => {
    if (rawToken && !token) {
      res.cookies.delete('token');
      res.cookies.delete('role');
    }
    return res;
  };

  // 1. 루트 경로(/) 접근 시 로그인 상태 및 역할별 리다이렉트
  if (pathname === '/') {
    if (!token) {
      return withCleanup(NextResponse.redirect(new URL('/login', request.url)));
    }
    if (role === 'WORKER') {
      return NextResponse.redirect(new URL('/inspections?scope=mine', request.url));
    }
    return NextResponse.redirect(new URL('/admin/dashboard', request.url));
  }

  const isProtectedRoute = protectedRoutes.some((route) => pathname.startsWith(route));
  const isAuthRoute = authRoutes.some((route) => pathname.startsWith(route));

  // 2. 인증 가드: 토큰이 없는 비로그인 사용자가 보호된 페이지에 접근 시 로그인 페이지로 즉시 튕겨냄
  if (!token && isProtectedRoute) {
    const loginUrl = new URL('/login', request.url);
    loginUrl.searchParams.set('redirect', pathname);
    return withCleanup(NextResponse.redirect(loginUrl));
  }

  // 3. 역방향 가드: 이미 로그인된 사용자가 /login 페이지 접근 시 해당 홈으로 전송
  if (token && isAuthRoute) {
    if (role === 'WORKER') {
      return NextResponse.redirect(new URL('/inspections?scope=mine', request.url));
    }
    return NextResponse.redirect(new URL('/admin/dashboard', request.url));
  }

  // 4. RBAC 역할 기반 가드: WORKER 계정이 관리자 권한 전용 페이지(/admin/*) 접근 시 현장 작업자 전용 뷰로 리다이렉트
  if (token && role === 'WORKER' && pathname.startsWith('/admin')) {
    return NextResponse.redirect(new URL('/inspections?scope=mine', request.url));
  }

  return withCleanup(NextResponse.next());
}

export const config = {
  matcher: ['/((?!api|_next/static|_next/image|favicon.ico).*)'],
};
