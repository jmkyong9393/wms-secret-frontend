'use client';

/**
 * Worker 전용 모바일/태블릿 풀스크린 셸.
 * [수정 이력 2026-08-05] C안 URL 물리 통합 후속: /inspections·/inventory 가 레이아웃 없이
 * 렌더되던 누락을 역할 적응형으로 보완. WORKER는 사이드바/헤더 대신 뒤로가기 상단바만 노출한다
 * (현장 작업 환경이 스마트폰·태블릿인 점을 반영).
 *
 * [수정 이력 2026-08-06] 두 가지를 보완했다.
 *  1) 하단 탭바 추가 - 종전에는 뒤로가기 버튼만 있어서 이 셸에 들어오면 **다른 메뉴로
 *     이동할 방법이 없었다**. /inbound(MainLayout)로 돌아가 사이드바를 열어야만 했다.
 *     메뉴 정의는 workerMenu.ts로 분리해 Sidebar와 공유한다.
 *  2) 공용 Header 재사용 - 종전 자체 상단바에는 **알림 벨이 없어 WORKER가 실시간 알림을
 *     받을 수 없었다**. Header는 사이드바 결합이나 역할 게이팅이 없는 독립 컴포넌트이고
 *     pathname으로 제목을 스스로 정하므로 그대로 얹을 수 있다. 알림 SSE·뮤트·토스트
 *     로직을 여기에 다시 구현하지 않는다(중복 방지).
 */
import Link from 'next/link';
import { useRouter, usePathname } from 'next/navigation';
import { ChevronLeft } from 'lucide-react';
import { SessionAutoLogout } from '@/components/auth/SessionAutoLogout';
import Header from './Header';
import { WORKER_MENU_ITEMS, isWorkerMenuActive } from './workerMenu';

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
  const pathname = usePathname();

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

      {/* 알림·다크모드·사용자 메뉴는 공용 Header를 그대로 쓴다 (제목은 pathname 기반 자동) */}
      <div className="shrink-0">
        <Header />
      </div>

      {/* 뒤로가기 줄. Header가 제목을 표시하므로 여기는 이동 수단만 얇게 둔다. */}
      <div className="flex items-center gap-1 px-2 py-1.5 bg-white dark:bg-gray-900 border-b border-gray-200 dark:border-gray-800 shrink-0">
        <button
          type="button"
          onClick={handleBack}
          aria-label="뒤로가기"
          className="flex items-center gap-1 px-2 py-1.5 rounded-lg text-sm font-medium text-gray-600 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-800 active:scale-95 transition-all"
        >
          <ChevronLeft className="w-4 h-4" />
          <span className="truncate max-w-[60vw]">{title}</span>
        </button>
      </div>

      <main className="flex-1 overflow-y-auto bg-gray-50 dark:bg-gray-950 transition-colors duration-200">
        {children}
      </main>

      {/* 하단 탭바 - 현장에서 한 손 엄지 조작을 전제로 화면 하단에 둔다.
          safe-area-inset-bottom으로 iOS 홈 인디케이터에 가리지 않게 한다. */}
      <nav
        aria-label="작업자 메뉴"
        className="shrink-0 grid grid-cols-4 bg-white dark:bg-gray-900 border-t border-gray-200 dark:border-gray-800 pb-[env(safe-area-inset-bottom)]"
      >
        {WORKER_MENU_ITEMS.map((item) => {
          const active = isWorkerMenuActive(pathname, item.href);
          const Icon = item.icon;
          return (
            <Link
              key={item.href}
              href={item.href}
              aria-current={active ? 'page' : undefined}
              className={`flex flex-col items-center justify-center gap-1 py-2.5 text-[11px] font-semibold transition-colors active:scale-95 ${
                active
                  ? 'text-blue-600 dark:text-blue-400'
                  : 'text-gray-500 dark:text-gray-400 hover:text-gray-900 dark:hover:text-gray-100'
              }`}
            >
              <Icon className="w-5 h-5" />
              <span className="truncate max-w-full px-1">{item.shortName}</span>
            </Link>
          );
        })}
      </nav>
    </div>
  );
}
