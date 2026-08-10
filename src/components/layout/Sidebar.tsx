'use client';
import { API_BASE_URL } from '@/lib/api-client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useHydratedUser } from '@/features/auth/hooks/useHydratedUser';
import { 
  LayoutDashboard, 
  Camera, 
  PackageSearch, 
  ShoppingCart,
  LineChart,
  Settings,
  Menu,
  X,
  ChevronDown,
  ChevronRight,
  Users,
  Truck,
  FileCheck,
  Building2,
  ShieldCheck,
  Boxes,
  PanelLeftClose,
  PanelLeftOpen,
  MessageSquare
} from 'lucide-react';
import { useState, useEffect } from 'react';
import { WORKER_MENU_ITEMS } from './workerMenu';

/**
 * 물류 프로세스 및 권한 단위별 사이드바 메뉴 그룹 정의
 */
interface MenuGroup {
  title: string;
  items: {
    name: string;
    href: string;
    icon: any;
    badge?: string;
  }[];
}

// 항목 정의는 workerMenu.ts(SSOT)에서 가져온다. WorkerMobileShell의 하단 탭바가 같은
// 목록을 쓰므로, 한쪽만 고쳐 메뉴가 어긋나는 일이 없도록 단일 출처로 묶었다.
const WORKER_MENU_GROUPS: MenuGroup[] = [
  {
    title: '👷 현장 작업자 전용 메뉴',
    items: WORKER_MENU_ITEMS.map(({ name, href, icon }) => ({ name, href, icon })),
  },
];

/**
 * [수정 이력 2026-08-04] 메뉴 개편 (조장 채택안, 13개 -> 10개):
 * - "나의 검수 내역 (Worker)" 제거 -> 검수 처리 내역 페이지 내 [전체|내 검수만] 토글로 흡수
 * - "현장 재고 조회 (Worker)" 제거 -> 재고 현황 관리가 role-aware 공용 그리드라 중복
 * - "FDS 이상거래 관제" 신설 (룰 엔진 + Analyst Agent 실탐지 화면)
 * - 그룹명 "관제 & 대시보드" -> "관제 & 인텔리전스"
 * Worker 메뉴(WORKER_MENU_GROUPS)는 현장 동선 최적화 상태 그대로 유지.
 */
function getMenuGroups(hitlPendingCount: number): MenuGroup[] {
  return [
    {
      title: '📊 관제 & 인텔리전스',
      items: [
        { name: '종합 대시보드', href: '/admin/dashboard', icon: LayoutDashboard },
        { name: 'FDS 이상거래 관제', href: '/admin/fds', icon: ShieldCheck },
      ],
    },
    {
      title: '📥 입고 & AI 검수 파이프라인',
      items: [
        { name: '도서 입고 검수 (카메라)', href: '/inbound', icon: Camera },
        { name: '승인 대기 (HITL)', href: '/admin/hitl', icon: ShoppingCart, badge: hitlPendingCount > 0 ? String(hitlPendingCount) : undefined },
        { name: '검수 처리 내역', href: '/inspections', icon: FileCheck },
      ],
    },
    {
      title: '📦 재고 & 출고 프로세스',
      items: [
        { name: '재고 현황 관리', href: '/inventory', icon: PackageSearch },
        { name: '주문 & AI 피킹 지시서', href: '/admin/orders', icon: ShoppingCart },
        { name: '출고 최적화 및 송장 발급', href: '/admin/outbound', icon: Truck },
        { name: '출고 피킹 스캐너', href: '/worker/outbound', icon: Truck },
      ],
    },
    {
      title: '🤖 SCM & 자동 발주',
      items: [
        { name: '발주 관리 (AI)', href: '/admin/po', icon: LineChart },
      ],
    },
    {
      title: '👥 권한 & 시스템 관리',
      items: [
        { name: '사원 관리', href: '/admin/employees', icon: Users },
        { name: '시스템 설정', href: '/admin/settings', icon: Settings },
      ],
    },
    {
      title: '📢 게시판',
      items: [
        { name: '게시판', href: '/board', icon: MessageSquare },
      ],
    },
  ];
}

export default function Sidebar() {
  const pathname = usePathname();
  const [isOpen, setIsOpen] = useState(false); // Mobile Drawer State
  const [isCollapsed, setIsCollapsed] = useState(false); // Desktop Collapsed State

  // 화면 표시용 축약 여부. 축약은 **데스크톱 전용** 기능인데, 종전에는 모바일 드로어를
  // 열었을 때도 그대로 적용돼 아이콘만 뜨고 메뉴 이름이 사라졌다(무엇을 누르는지 알 수 없음).
  // 드로어가 열려 있는 동안에는 항상 펼친 모습으로 그린다.
  const compact = isCollapsed && !isOpen;
  // 메뉴 구성이 역할에 따라 통째로 갈리므로, 하이드레이션 이후에만 사용자 정보를 반영한다.
  // 아톰을 직접 읽으면 서버(=null, 작업자 메뉴)와 클라이언트(=저장된 MASTER, 관제 메뉴)의
  // 렌더 결과가 달라 하이드레이션 불일치가 난다.
  const { user, hydrated } = useHydratedUser();
  const [hitlCount, setHitlCount] = useState<number>(0);

  // 5초 간격으로 백엔드 HITL 수동 검수 대기열 조회
  useEffect(() => {
    let isMounted = true;
    const fetchPendingHitl = async () => {
      try {
        const res = await fetch(`${API_BASE_URL}/api/v1/admin/hitl/pending`, { method: 'GET' });
        if (res.ok) {
          const data = await res.json();
          if (isMounted && Array.isArray(data)) {
            setHitlCount(data.length);
          }
        } else {
          const resHistory = await fetch(`${API_BASE_URL}/api/v1/inbound/history`, { method: 'GET' });
          if (resHistory.ok) {
            const historyData = await resHistory.json();
            if (isMounted && Array.isArray(historyData)) {
              const pending = historyData.filter((item: any) => item.status === 'PENDING' || item.status === 'HITL_REQUIRED').length;
              setHitlCount(pending);
            }
          }
        }
      } catch (e) {
        // network fallback
      }
    };

    fetchPendingHitl();
    const timer = setInterval(fetchPendingHitl, 5000);
    return () => {
      isMounted = false;
      clearInterval(timer);
    };
  }, []);

  const [openGroups, setOpenGroups] = useState<Record<string, boolean>>({
    '📊 관제 & 인텔리전스': true,
    '📥 입고 & AI 검수 파이프라인': true,
    '📦 재고 & 출고 프로세스': true,
    '🤖 SCM & 자동 발주': true,
    '👥 권한 & 시스템 관리': true,
    '📢 게시판': true,
    '👷 현장 작업자 전용 메뉴': true,
  });

  const toggleGroup = (title: string) => {
    setOpenGroups((prev) => ({ ...prev, [title]: !prev[title] }));
  };

  return (
    <>
      {/* 📱 모바일 메뉴 버튼 (md 미만에서만 노출).
          [2026-08-06] 기준을 lg(1024px) -> md(768px)로 낮췄다. 종전에는 노트북이나
          창을 반만 키운 데스크톱(예: 960px)에서도 사이드바가 사라지고 햄버거만 남아
          "PC인데 모바일 화면"으로 보였다. */}
      <button 
        onClick={() => setIsOpen(!isOpen)}
        className="md:hidden fixed top-3 left-3 z-50 p-2.5 bg-white dark:bg-gray-900 rounded-xl shadow-lg border border-gray-200 dark:border-gray-800 text-gray-700 dark:text-gray-200 active:scale-95 transition-all cursor-pointer"
        aria-label="메뉴 열기/닫기"
      >
        {isOpen ? <X className="w-5 h-5 text-indigo-600" /> : <Menu className="w-5 h-5" />}
      </button>

      {/* 📱 Mobile Backdrop Overlay */}
      {isOpen && (
        <div 
          className="md:hidden fixed inset-0 bg-black/50 z-40 backdrop-blur-xs transition-opacity"
          onClick={() => setIsOpen(false)}
        />
      )}

      {/* 💻 Main Responsive Collapsible Sidebar Container */}
      <aside className={`
        fixed md:static inset-y-0 left-0 z-40
        bg-white dark:bg-gray-900 border-r border-gray-200 dark:border-gray-800 
        flex flex-col justify-between transition-all duration-300 ease-in-out font-sans shrink-0
        ${isOpen ? 'translate-x-0' : '-translate-x-full md:translate-x-0'}
        ${compact ? 'md:w-20' : 'md:w-72'}
        w-72
      `}>
        {/* Sidebar Navigation Header with Emblem & Enterprise Branding */}
        <div className={`h-16 flex items-center ${compact ? 'justify-center gap-1.5 px-2' : 'justify-between px-4'} border-b border-gray-100 dark:border-gray-800 bg-white dark:bg-gray-900 transition-colors`}>
          {!compact ? (
            <>
              <div className="flex items-center gap-2.5 min-w-0">
                <img 
                  src="/nexus_logo.png" 
                  alt="Nexus AI WMS Emblem" 
                  className="w-9 h-9 rounded-2xl object-cover shadow-sm border border-blue-500/20 shrink-0" 
                />
                <div className="flex flex-col min-w-0">
                  <div className="flex items-center gap-1 text-base font-black tracking-tight leading-none">
                    <span className="text-gray-900 dark:text-white">Nexus</span>
                    <span className="text-blue-600 dark:text-blue-400">WMS</span>
                  </div>
                  <span className="text-[10px] text-gray-400 dark:text-gray-500 font-mono font-bold mt-0.5">Enterprise v2.15.0.1</span>
                </div>
              </div>
              <button
                onClick={() => setIsCollapsed(!isCollapsed)}
                className="hidden md:flex items-center justify-center p-2 rounded-xl text-gray-400 hover:text-indigo-600 hover:bg-indigo-50 dark:hover:bg-gray-800 transition-all cursor-pointer shrink-0 ml-1"
                title="사이드바 접기 (Collapse)"
              >
                <PanelLeftClose className="w-5 h-5" />
              </button>
            </>
          ) : (
            <div className="flex items-center justify-center gap-1.5 w-full">
              <Boxes className="w-5 h-5 text-indigo-600 dark:text-indigo-400 shrink-0" />
              <button
                onClick={() => setIsCollapsed(!isCollapsed)}
                className="hidden md:flex items-center justify-center p-1.5 rounded-xl text-gray-400 hover:text-indigo-600 hover:bg-indigo-50 dark:hover:bg-gray-800 transition-all cursor-pointer shrink-0"
                title="사이드바 펼치기 (Expand)"
              >
                <PanelLeftOpen className="w-5 h-5" />
              </button>
            </div>
          )}

          {/* Mobile Close Button inside Drawer */}
          <button
            onClick={() => setIsOpen(false)}
            className="md:hidden p-2 rounded-xl text-gray-400 hover:text-gray-700 dark:hover:text-white shrink-0"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Categorized Navigation Menu List */}
        <nav className="flex-1 overflow-y-auto py-5 px-3 space-y-5 custom-scrollbar">
          {(() => {
            // 역할을 알기 전에는 어느 쪽 메뉴도 그리지 않는다. 기본값으로 한쪽을 그리면
            // 하이드레이션 직후 메뉴가 통째로 바뀌며 깜빡인다(관리자에게 작업자 메뉴가 스침).
            if (!hydrated) {
              return (
                <div className="space-y-2 px-3 pt-2" aria-hidden="true">
                  {Array.from({ length: 6 }).map((_, i) => (
                    <div key={i} className="h-8 rounded-lg bg-gray-100 dark:bg-gray-800 animate-pulse" />
                  ))}
                </div>
              );
            }

            const role = user?.role;
            const menuGroups = (role === 'MASTER' || role === 'ADMIN')
              ? getMenuGroups(hitlCount)
              : WORKER_MENU_GROUPS;

            return menuGroups.map((group) => {
              const isGroupOpen = openGroups[group.title] ?? true;

              return (
                <div key={group.title} className="space-y-1">
                  {/* Group Header (Hidden if Collapsed on Desktop) */}
                  {!compact ? (
                    <button
                      onClick={() => toggleGroup(group.title)}
                      className="w-full flex items-center justify-between px-3 py-2 text-xs font-black text-gray-400 dark:text-gray-500 uppercase tracking-wider hover:text-gray-900 dark:hover:text-white transition-colors"
                    >
                      <span className="truncate">{group.title}</span>
                      {isGroupOpen ? (
                        <ChevronDown className="w-4 h-4 text-gray-400 shrink-0" />
                      ) : (
                        <ChevronRight className="w-4 h-4 text-gray-400 shrink-0" />
                      )}
                    </button>
                  ) : (
                    <div className="h-4 border-b border-gray-100 dark:border-gray-800 mb-2" />
                  )}

                  {/* Group Nav Items */}
                  {(isGroupOpen || compact) && (
                    <div className="space-y-1">
                      {group.items.map((item) => {
                        // C안: href에 쿼리가 붙는 항목(/inspections?scope=mine)은 경로 부분만 비교.
                        // 메뉴가 역할별 분리 렌더링이라 한 화면에서 중복 점등은 발생하지 않는다.
                        const isActive = pathname === item.href.split('?')[0];
                        const Icon = item.icon;

                        return (
                          <Link
                            key={item.name}
                            href={item.href}
                            onClick={() => setIsOpen(false)}
                            title={compact ? item.name : undefined}
                            className={`flex items-center ${compact ? 'justify-center px-0 py-3' : 'justify-between px-3.5 py-2.5'} rounded-xl text-sm font-bold transition-all ${
                              isActive 
                                ? 'bg-indigo-600 text-white shadow-md font-extrabold' 
                                : 'text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-800/80 hover:text-gray-900 dark:hover:text-white'
                            }`}
                          >
                            <div className={`flex items-center ${compact ? 'justify-center' : 'gap-3 min-w-0'}`}>
                              <Icon className={`w-5 h-5 shrink-0 ${isActive ? 'text-white' : 'text-gray-500 dark:text-gray-400'}`} />
                              {!compact && <span className="truncate">{item.name}</span>}
                            </div>

                            {!compact && item.badge && (
                              <span className={`px-2 py-0.5 rounded-full text-[11px] font-black font-mono shrink-0 ${
                                isActive ? 'bg-white/20 text-white' : 'bg-rose-100 dark:bg-rose-950/80 text-rose-700 dark:text-rose-300'
                              }`}>
                                {item.badge}
                              </span>
                            )}
                          </Link>
                        );
                      })}
                    </div>
                  )}
                </div>
              );
            });
          })()}
        </nav>

        {/* User Profile Footer */}
        <div className="p-3.5 border-t border-gray-100 dark:border-gray-800 bg-gray-50/60 dark:bg-gray-850 transition-colors">
          <div className={`flex items-center ${compact ? 'justify-center' : 'gap-3'}`}>
            <div className="w-10 h-10 rounded-xl bg-indigo-100 dark:bg-indigo-950/80 border border-indigo-200 dark:border-indigo-800 flex items-center justify-center text-indigo-700 dark:text-indigo-300 font-black text-sm font-mono shadow-2xs shrink-0">
              {user?.employeeId ? user.employeeId.slice(0, 2) : 'WM'}
            </div>
            {!compact && (
              <div className="flex flex-col min-w-0 flex-1">
                <p className="text-sm font-black text-gray-900 dark:text-white truncate">
                  {user ? (user.name || user.employeeId) : '로그인 필요'}
                </p>
                <p className="text-xs text-gray-500 dark:text-gray-400 font-mono font-bold truncate">
                  {user ? user.role : 'GUEST'}
                </p>
              </div>
            )}
          </div>
        </div>
      </aside>
    </>
  );
}
