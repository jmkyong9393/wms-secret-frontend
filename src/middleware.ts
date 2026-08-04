import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';

// 수동 및 역할 기반 접근 제어 (RBAC) 라우트 설정
const protectedRoutes = ['/admin', '/worker', '/inbound', '/inventory', '/inspections', '/returns', '/orders', '/mypage'];
const authRoutes = ['/login', '/signup'];

export function middleware(request: NextRequest) {
  const token = request.cookies.get('token')?.value;
  const role = request.cookies.get('role')?.value;
  const { pathname } = request.nextUrl;

  // 1. 루트 경로(/) 접근 시 로그인 상태 및 역할별 리다이렉트
  if (pathname === '/') {
    if (!token) {
      return NextResponse.redirect(new URL('/login', request.url));
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
    return NextResponse.redirect(loginUrl);
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

  return NextResponse.next();
}

export const config = {
  matcher: ['/((?!api|_next/static|_next/image|favicon.ico).*)'],
};
