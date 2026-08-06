'use client';

import { useEffect } from 'react';
import { useRouter, usePathname } from 'next/navigation';
import { useAtomValue } from 'jotai';
import { currentUserAtom } from '@/features/auth/store/authAtoms';
import Cookies from 'js-cookie';
import Sidebar from './Sidebar';
import Header from './Header';
import Footer from './Footer';

export default function MainLayout({ children }: { children: React.ReactNode }) {
  const router = useRouter();
  const pathname = usePathname();
  const user = useAtomValue(currentUserAtom);

  useEffect(() => {
    // 1. Check Authentication token and session
    const token = Cookies.get('token') || localStorage.getItem('nexus_auth_token');
    const storedUserStr = localStorage.getItem('wms_user') || sessionStorage.getItem('wms_user');
    const roleCookie = Cookies.get('role');

    const isAuthenticated = !!token || !!user?.role || !!storedUserStr;

    if (!isAuthenticated) {
      // 미인증 상태에서 /admin 또는 /worker 경로로 접속 시 Toast 없이 즉시 /login 리다이렉트
      router.replace('/login');
      return;
    }

    // 2. Role-based Route Protection
    const currentRole = (user?.role || roleCookie || 'GUEST').toUpperCase();

    if (currentRole === 'WORKER' && pathname.startsWith('/admin')) {
      // WORKER 역할이 /admin 으로 접속하면 나의 검수내역으로 강제 이동
      router.replace('/inspections?scope=mine');
    }
  }, [user, router, pathname]);

  return (
    <div className="flex h-screen bg-gray-50 dark:bg-gray-950 text-gray-900 dark:text-gray-100 overflow-hidden font-sans transition-colors duration-200">
      {/* SessionAutoLogout은 루트 레이아웃(app/layout.tsx)에서 단일 마운트한다.
          여기(인증 셸)에만 두면 로그인 화면에서 탭 마커가 설정되지 않아,
          로그인 직후 첫 진입이 새 탭으로 오판되어 즉시 로그아웃된다. */}
      <Sidebar />
      <div className="flex-1 flex flex-col min-w-0">
        <Header />
        <main className="flex-1 overflow-y-auto p-4 lg:p-8 flex flex-col justify-between bg-gray-50 dark:bg-gray-950 transition-colors duration-200">
          <div>
            {children}
          </div>
          <Footer />
        </main>
      </div>
    </div>
  );
}
