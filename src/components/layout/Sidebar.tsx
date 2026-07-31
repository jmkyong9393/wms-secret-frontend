'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useAtomValue } from 'jotai';
import { userAtom } from '@/stores/auth';
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
  PanelLeftOpen
} from 'lucide-react';
import { useState, useEffect } from 'react';

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

const WORKER_MENU_GROUPS: MenuGroup[] = [
  {
    title: '👷 현장 작업자 전용 메뉴',
    items: [
      { name: '현장 반품 검수 (카메라)', href: '/inbound', icon: Camera },
      { name: '나의 검수 내역 (Worker)', href: '/worker/inspections', icon: ShieldCheck },
      { name: '출고 피킹 스캐너 (Worker)', href: '/worker/outbound', icon: Truck },
      { name: '현장 재고 조회 (Worker)', href: '/worker/inventory', icon: PackageSearch },
    ],
  },
];

function getMenuGroups(hitlPendingCount: number): MenuGroup[] {
  return [
    {
      title: '📊 관제 & 대시보드',
      items: [
        { name: '종합 대시보드', href: '/admin/dashboard', icon: LayoutDashboard },
      ],
    },
    {
      title: '📥 입고 & AI 검수 파이프라인',
      items: [
        { name: '현장 반품 검수 (카메라)', href: '/inbound', icon: Camera },
        { name: '나의 검수 내역 (Worker)', href: '/worker/inspections', icon: ShieldCheck },
        { name: '승인 대기 (HITL)', href: '/admin/hitl', icon: ShoppingCart, badge: hitlPendingCount > 0 ? String(hitlPendingCount) : undefined },
        { name: '검수 처리 내역 (전체)', href: '/admin/inspections', icon: FileCheck },
      ],
    },
    {
      title: '📦 재고 & 출고 프로세스',
      items: [
        { name: '재고 현황 관리 (Master)', href: '/admin/inventory', icon: PackageSearch },
        { name: '현장 재고 조회 (Worker)', href: '/worker/inventory', icon: PackageSearch },
        { name: '출고 최적화 및 송장 발급', href: '/admin/outbound', icon: Truck },
        { name: '출고 피킹 스캐너 (Worker)', href: '/worker/outbound', icon: Truck },
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
  ];
}

export default function Sidebar() {
  const pathname = usePathname();
  const [isOpen, setIsOpen] = useState(false); // Mobile Drawer State
  const [isCollapsed, setIsCollapsed] = useState(false); // Desktop Collapsed State
  const user = useAtomValue(userAtom);
  const [hitlCount, setHitlCount] = useState<number>(0);

  // 5초 간격으로 백엔드 HITL 수동 검수 대기열 조회
  useEffect(() => {
    let isMounted = true;
    const fetchPendingHitl = async () => {
      try {
        const res = await fetch('http://localhost:8000/api/v1/admin/hitl/pending', { method: 'GET' });
        if (res.ok) {
          const data = await res.json();
          if (isMounted && Array.isArray(data)) {
            setHitlCount(data.length);
          }
        } else {
          const resHistory = await fetch('http://localhost:8000/api/v1/inbound/history', { method: 'GET' });
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
    '📊 관제 & 대시보드': true,
    '📥 입고 & AI 검수 파이프라인': true,
    '📦 재고 & 출고 프로세스': true,
    '🤖 SCM & 자동 발주': true,
    '👥 권한 & 시스템 관리': true,
    '👷 현장 작업자 전용 메뉴': true,
  });

  const toggleGroup = (title: string) => {
    setOpenGroups((prev) => ({ ...prev, [title]: !prev[title] }));
  };

  return (
    <>
      {/* 📱 Mobile Menu Trigger Button (Visible on lg:hidden) */}
      <button 
        onClick={() => setIsOpen(!isOpen)}
        className="lg:hidden fixed top-3 left-3 z-50 p-2.5 bg-white dark:bg-gray-900 rounded-xl shadow-lg border border-gray-200 dark:border-gray-800 text-gray-700 dark:text-gray-200 active:scale-95 transition-all cursor-pointer"
        aria-label="메뉴 열기/닫기"
      >
        {isOpen ? <X className="w-5 h-5 text-indigo-600" /> : <Menu className="w-5 h-5" />}
      </button>

      {/* 📱 Mobile Backdrop Overlay */}
      {isOpen && (
        <div 
          className="lg:hidden fixed inset-0 bg-black/50 z-40 backdrop-blur-xs transition-opacity"
          onClick={() => setIsOpen(false)}
        />
      )}

      {/* 💻 Main Responsive Collapsible Sidebar Container */}
      <aside className={`
        fixed lg:static inset-y-0 left-0 z-40
        bg-white dark:bg-gray-900 border-r border-gray-200 dark:border-gray-800 
        flex flex-col justify-between transition-all duration-300 ease-in-out font-sans shrink-0
        ${isOpen ? 'translate-x-0' : '-translate-x-full lg:translate-x-0'}
        ${isCollapsed ? 'lg:w-20' : 'lg:w-72'}
        w-72
      `}>
        {/* Sidebar Navigation Header with Emblem & Enterprise Branding */}
        <div className={`h-16 flex items-center ${isCollapsed ? 'justify-center gap-1.5 px-2' : 'justify-between px-4'} border-b border-gray-100 dark:border-gray-800 bg-white dark:bg-gray-900 transition-colors`}>
          {!isCollapsed ? (
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
                  <span className="text-[10px] text-gray-400 dark:text-gray-500 font-mono font-bold mt-0.5">Enterprise v2.6.0</span>
                </div>
              </div>
              <button
                onClick={() => setIsCollapsed(!isCollapsed)}
                className="hidden lg:flex items-center justify-center p-2 rounded-xl text-gray-400 hover:text-indigo-600 hover:bg-indigo-50 dark:hover:bg-gray-800 transition-all cursor-pointer shrink-0 ml-1"
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
                className="hidden lg:flex items-center justify-center p-1.5 rounded-xl text-gray-400 hover:text-indigo-600 hover:bg-indigo-50 dark:hover:bg-gray-800 transition-all cursor-pointer shrink-0"
                title="사이드바 펼치기 (Expand)"
              >
                <PanelLeftOpen className="w-5 h-5" />
              </button>
            </div>
          )}

          {/* Mobile Close Button inside Drawer */}
          <button
            onClick={() => setIsOpen(false)}
            className="lg:hidden p-2 rounded-xl text-gray-400 hover:text-gray-700 dark:hover:text-white shrink-0"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Categorized Navigation Menu List */}
        <nav className="flex-1 overflow-y-auto py-5 px-3 space-y-5 custom-scrollbar">
          {(() => {
            const role = user?.role;
            const menuGroups = (role === 'MASTER' || role === 'ADMIN') 
              ? getMenuGroups(hitlCount) 
              : WORKER_MENU_GROUPS;

            return menuGroups.map((group) => {
              const isGroupOpen = openGroups[group.title] ?? true;

              return (
                <div key={group.title} className="space-y-1">
                  {/* Group Header (Hidden if Collapsed on Desktop) */}
                  {!isCollapsed ? (
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
                  {(isGroupOpen || isCollapsed) && (
                    <div className="space-y-1">
                      {group.items.map((item) => {
                        const isActive = pathname === item.href;
                        const Icon = item.icon;

                        return (
                          <Link
                            key={item.name}
                            href={item.href}
                            onClick={() => setIsOpen(false)}
                            title={isCollapsed ? item.name : undefined}
                            className={`flex items-center ${isCollapsed ? 'justify-center px-0 py-3' : 'justify-between px-3.5 py-2.5'} rounded-xl text-sm font-bold transition-all ${
                              isActive 
                                ? 'bg-indigo-600 text-white shadow-md font-extrabold' 
                                : 'text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-800/80 hover:text-gray-900 dark:hover:text-white'
                            }`}
                          >
                            <div className={`flex items-center ${isCollapsed ? 'justify-center' : 'gap-3 min-w-0'}`}>
                              <Icon className={`w-5 h-5 shrink-0 ${isActive ? 'text-white' : 'text-gray-500 dark:text-gray-400'}`} />
                              {!isCollapsed && <span className="truncate">{item.name}</span>}
                            </div>

                            {!isCollapsed && item.badge && (
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
          <div className={`flex items-center ${isCollapsed ? 'justify-center' : 'gap-3'}`}>
            <div className="w-10 h-10 rounded-xl bg-indigo-100 dark:bg-indigo-950/80 border border-indigo-200 dark:border-indigo-800 flex items-center justify-center text-indigo-700 dark:text-indigo-300 font-black text-sm font-mono shadow-2xs shrink-0">
              {user?.employee_id ? user.employee_id.slice(0, 2) : 'WM'}
            </div>
            {!isCollapsed && (
              <div className="flex flex-col min-w-0 flex-1">
                <p className="text-sm font-black text-gray-900 dark:text-white truncate">
                  {user ? (user.name || user.employee_id) : '로그인 필요'}
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
