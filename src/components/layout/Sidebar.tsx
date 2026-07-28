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
  Boxes
} from 'lucide-react';
import { useState } from 'react';

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
      { name: '나의 검수 내역', href: '/worker/inspections', icon: ShieldCheck },
      { name: '출고 패킹 스캐너 (모바일)', href: '/worker/outbound', icon: Truck },
      { name: '현장 재고 현황 조회', href: '/worker/inventory', icon: PackageSearch },
    ],
  },
];

const MENU_GROUPS: MenuGroup[] = [
  {
    title: '📊 관제 & 대시보드',
    items: [
      { name: '종합 대시보드', href: '/admin/dashboard', icon: LayoutDashboard },
    ],
  },
  {
    title: '📥 입고 & AI 검수 파이프라인',
    items: [
      { name: '현장 반품 검수', href: '/inbound', icon: Camera },
      { name: '나의 검수 내역 (작업자)', href: '/worker/inspections', icon: ShieldCheck },
      { name: '승인 대기 (HITL)', href: '/admin/hitl', icon: ShoppingCart, badge: '3' },
      { name: '검수 처리 내역 (전체)', href: '/admin/inspections', icon: FileCheck },
    ],
  },
  {
    title: '📦 재고 & 출고 프로세스',
    items: [
      { name: '재고 현황 관리 (Master)', href: '/admin/inventory', icon: PackageSearch },
      { name: '현장 재고 조회 (Worker)', href: '/worker/inventory', icon: PackageSearch },
      { name: '출고 최적화 (3D/송장)', href: '/admin/outbound', icon: Truck },
      { name: '출고 패킹 스캐너 (Worker)', href: '/worker/outbound', icon: Truck },
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

export default function Sidebar() {
  const pathname = usePathname();
  const [isOpen, setIsOpen] = useState(false);
  const user = useAtomValue(userAtom);

  // 그룹별 개별 아코디언 토글 상태 관리 (기본적으로 모두 열림)
  const [openGroups, setOpenGroups] = useState<Record<string, boolean>>({
    '📊 관제 & 대시보드': true,
    '📥 입고 & AI 검수 파이프라인': true,
    '📦 재고 & 출고 프로세스': true,
    '🤖 SCM & 자동 발주': true,
    '👥 권한 & 시스템 관리': true,
  });

  const toggleGroup = (title: string) => {
    setOpenGroups((prev) => ({ ...prev, [title]: !prev[title] }));
  };

  return (
    <>
      {/* Mobile Menu Toggle */}
      <button 
        onClick={() => setIsOpen(!isOpen)}
        className="lg:hidden fixed top-4 left-4 z-50 p-2 bg-white rounded-xl shadow-md border border-gray-200"
      >
        {isOpen ? <X className="w-5 h-5 text-gray-700" /> : <Menu className="w-5 h-5 text-gray-700" />}
      </button>

      {/* Mobile Overlay */}
      {isOpen && (
        <div 
          className="lg:hidden fixed inset-0 bg-black/30 z-40 backdrop-blur-xs"
          onClick={() => setIsOpen(false)}
        />
      )}

      {/* Sidebar Container */}
      <aside className={`
        fixed lg:static inset-y-0 left-0 z-40
        w-72 bg-white dark:bg-gray-900 border-r border-gray-200 dark:border-gray-800 flex flex-col transition-colors duration-200 font-sans
        ${isOpen ? 'translate-x-0' : '-translate-x-full lg:translate-x-0'}
      `}>
        {/* Logo & System Brand (Top Left Home Link) */}
        <div className="h-20 flex items-center justify-between px-6 border-b border-gray-100 dark:border-gray-800 bg-white dark:bg-gray-900 transition-colors">
          <Link 
            href="/admin/dashboard" 
            onClick={() => setIsOpen(false)} 
            className="flex items-center gap-3 group"
            title="Nexus WMS 대시보드로 돌아가기"
          >
            <img 
              src="/nexus_logo.png" 
              alt="Nexus AI WMS Logo" 
              className="w-11 h-11 rounded-2xl object-cover shadow-md shadow-blue-500/30 group-hover:scale-105 group-hover:shadow-blue-500/50 transition-all border border-blue-500/20 group-hover:border-blue-500/60 shrink-0" 
            />
            <div className="flex flex-col">
              <div className="flex items-center gap-1.5 text-xl font-black tracking-tight leading-none">
                <span className="text-gray-900 dark:text-white group-hover:text-blue-600 dark:group-hover:text-blue-400 transition-colors">Nexus</span>
                <span className="text-blue-600 dark:text-blue-400 group-hover:text-indigo-600 dark:group-hover:text-indigo-300 transition-colors">WMS</span>
              </div>
              <span className="text-xs text-gray-400 dark:text-gray-500 group-hover:text-blue-500 dark:group-hover:text-blue-400 font-mono font-bold mt-1 transition-colors">Enterprise v2.6.0</span>
            </div>
          </Link>
        </div>

        {/* Categorized Menu List */}
        <nav className="flex-1 overflow-y-auto py-5 px-4 space-y-5">
          {(user?.role === 'WORKER' ? WORKER_MENU_GROUPS : MENU_GROUPS).map((group) => {
            const isGroupOpen = openGroups[group.title] ?? true;

            return (
              <div key={group.title} className="space-y-1.5">
                {/* Group Header */}
                <button
                  onClick={() => toggleGroup(group.title)}
                  className="w-full flex items-center justify-between px-3 py-2 text-xs font-black text-gray-500 dark:text-gray-400 uppercase tracking-wider hover:text-gray-900 dark:hover:text-white transition-colors"
                >
                  <span>{group.title}</span>
                  {isGroupOpen ? (
                    <ChevronDown className="w-4 h-4 text-gray-400 dark:text-gray-500" />
                  ) : (
                    <ChevronRight className="w-4 h-4 text-gray-400 dark:text-gray-500" />
                  )}
                </button>

                {/* Group Items */}
                {isGroupOpen && (
                  <div className="space-y-1">
                    {group.items.map((item) => {
                      const isActive = pathname === item.href;
                      const Icon = item.icon;

                      return (
                        <Link
                          key={item.name}
                          href={item.href}
                          onClick={() => setIsOpen(false)}
                          className={`flex items-center justify-between px-3.5 py-2.5 rounded-xl text-sm font-bold transition-all ${
                            isActive 
                              ? 'bg-blue-600 dark:bg-blue-600 text-white shadow-md font-extrabold' 
                              : 'text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-800/80 hover:text-gray-900 dark:hover:text-white'
                          }`}
                        >
                          <div className="flex items-center gap-3">
                            <Icon className={`w-5 h-5 ${isActive ? 'text-white' : 'text-gray-500 dark:text-gray-400'}`} />
                            <span>{item.name}</span>
                          </div>

                          {item.badge && (
                            <span className={`px-2.5 py-0.5 rounded-full text-xs font-black font-mono ${
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
          })}
        </nav>

        {/* User Info Footer */}
        <div className="p-4 border-t border-gray-100 dark:border-gray-800 bg-gray-50/60 dark:bg-gray-850 transition-colors">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-blue-100 dark:bg-blue-950/80 border border-blue-200 dark:border-blue-800 flex items-center justify-center text-blue-700 dark:text-blue-300 font-black text-sm font-mono shadow-xs">
              WM
            </div>
            <div className="flex flex-col min-w-0 flex-1">
              <p className="text-sm font-black text-gray-900 dark:text-white truncate">
                {(user as any)?.username || user?.name || '장문경 (Lead Architect)'}
              </p>
              <p className="text-xs text-gray-500 dark:text-gray-400 font-mono font-bold truncate">
                {user?.role || 'MASTER_ADMIN'}
              </p>
            </div>
          </div>
        </div>
      </aside>
    </>
  );
}
