'use client';

/**
 * Worker 전용 모바일/태블릿 풀스크린 셸.
 * [수정 이력 2026-08-05] C안 URL 물리 통합 후속: /inspections·/inventory 가 레이아웃 없이
 * 렌더되던 누락을 역할 적응형으로 보완. WORKER는 사이드바/헤더 대신 뒤로가기 상단바만 노출한다
 * (현장 작업 환경이 스마트폰·태블릿인 점을 반영).
 */
import { useRouter } from 'next/navigation';
import { ChevronLeft } from 'lucide-react';
import { SessionAutoLogout } from '@/components/auth/SessionAutoLogout';

interface WorkerMobileShellProps {
  title: string;
  /** 브라우저 히스토리가 없을 때(딥링크 직행 등) 뒤로가기 버튼이 이동할 경로 */
  fallbackHref?: string;
  children: React.ReactNode;
}

export default function WorkerMobileShell({
  title,
  fallbackHref = '/inbound',
  children,
}: WorkerMobileShellProps) {
  const router = useRouter();

  const handleBack = () => {
    if (window.history.length > 1) {
      router.back();
    } else {
      router.replace(fallbackHref);
    }
  };

  return (
    <div className="flex flex-col h-screen bg-gray-50 dark:bg-gray-950 text-gray-900 dark:text-gray-100 overflow-hidden font-sans transition-colors duration-200">
      <SessionAutoLogout />
      <header className="flex items-center gap-1.5 px-2 py-2.5 sm:px-4 bg-white dark:bg-gray-900 border-b border-gray-200 dark:border-gray-800 shadow-xs shrink-0">
        <button
          type="button"
          onClick={handleBack}
          aria-label="뒤로가기"
          className="p-2 rounded-xl text-gray-600 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-800 active:scale-95 transition-all"
        >
          <ChevronLeft className="w-5 h-5" />
        </button>
        <h1 className="text-base font-bold truncate">{title}</h1>
      </header>
      <main className="flex-1 overflow-y-auto bg-gray-50 dark:bg-gray-950 transition-colors duration-200">
        {children}
      </main>
    </div>
  );
}
