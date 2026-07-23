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
  Users
} from 'lucide-react';
import { useState } from 'react';

/**
 * 전역 네비게이션 사이드바 컴포넌트입니다.
 * 모바일에서는 햄버거 버튼을 통해 오버레이 형태로 표시되며,
 * 데스크탑에서는 좌측에 고정(fixed)되어 출력됩니다.
 * 
 * @component
 */

// PM님이 요청하신 사이드바 추천 메뉴 구성
const MENU_ITEMS = [
  { name: '대시보드', href: '/admin', icon: LayoutDashboard, roles: ['MASTER', 'ADMIN'] },
  { name: '현장 반품 검수', href: '/inbound', icon: Camera, roles: ['MASTER', 'ADMIN', 'WORKER'] },
  { name: '재고 현황', href: '/admin/queue', icon: PackageSearch, roles: ['MASTER', 'ADMIN'] },
  { name: '심사 대기열 (HITL)', href: '/admin/hitl', icon: ShoppingCart, roles: ['MASTER', 'ADMIN'] },
  { name: '사원 관리', href: '/admin/employees', icon: Users, roles: ['MASTER', 'ADMIN'] },
];

const BOTTOM_MENU_ITEMS = [
  { name: '설정', href: '/settings', icon: Settings },
];

export default function Sidebar() {
  const pathname = usePathname(); // 현재 URL 경로를 파악하여 활성화된 메뉴 하이라이팅에 사용
  const [isOpen, setIsOpen] = useState(false); // 모바일 환경에서의 사이드바 열림/닫힘 상태
  const [isCoreOpen, setIsCoreOpen] = useState(true); // 'Core Menus' 아코디언 열림/닫힘 상태
  const user = useAtomValue(userAtom);

  const visibleMenuItems = MENU_ITEMS.filter(item => {
    if (!item.roles) return true;
    if (!user) return false;
    return item.roles.includes(user.role);
  });

  return (
    <>
      {/* Mobile Menu Toggle */}
      <button 
        onClick={() => setIsOpen(!isOpen)}
        className="lg:hidden fixed top-4 left-4 z-50 p-2 bg-white rounded-md shadow-sm border border-gray-200"
      >
        {isOpen ? <X className="w-5 h-5 text-gray-700" /> : <Menu className="w-5 h-5 text-gray-700" />}
      </button>

      {/* Mobile Overlay */}
      {isOpen && (
        <div 
          className="lg:hidden fixed inset-0 bg-black/20 z-40"
          onClick={() => setIsOpen(false)}
        />
      )}

      {/* Sidebar Container */}
      <aside className={`
        fixed lg:static inset-y-0 left-0 z-40
        w-64 bg-white border-r border-gray-200 flex flex-col transition-transform duration-300 ease-in-out
        ${isOpen ? 'translate-x-0' : '-translate-x-full lg:translate-x-0'}
      `}>
        {/* Logo Area */}
        <div className="h-16 flex items-center px-6 border-b border-gray-200">
          <Link href="/admin" onClick={() => setIsOpen(false)} className="text-lg font-bold bg-gradient-to-r from-blue-600 to-indigo-600 bg-clip-text text-transparent hover:opacity-80 transition-opacity">
            Nexus
          </Link>
        </div>

        {/* Main Menu */}
        <nav className="flex-1 overflow-y-auto py-4 px-3 space-y-1">
          <button 
            onClick={() => setIsCoreOpen(!isCoreOpen)}
            className="w-full flex items-center justify-between px-3 py-2 mb-1 text-xs font-semibold text-gray-400 uppercase tracking-wider hover:text-gray-600 transition-colors"
          >
            <span>Core Menus</span>
            {isCoreOpen ? <ChevronDown className="w-4 h-4" /> : <ChevronRight className="w-4 h-4" />}
          </button>
          
          <div className={`space-y-1 overflow-hidden transition-all duration-300 ${isCoreOpen ? 'max-h-[500px] opacity-100' : 'max-h-0 opacity-0'}`}>
            {visibleMenuItems.map((item) => {
              const isActive = pathname === item.href;
              return (
                <Link
                  key={item.name}
                  href={item.href}
                  onClick={() => setIsOpen(false)}
                  className={`flex items-center px-3 py-2.5 rounded-lg text-sm font-medium transition-colors ${
                    isActive 
                      ? 'bg-blue-50 text-blue-700' 
                      : 'text-gray-600 hover:bg-gray-100 hover:text-gray-900'
                  }`}
                >
                  <item.icon className={`w-5 h-5 mr-3 ${isActive ? 'text-blue-700' : 'text-gray-400'}`} />
                  {item.name}
                </Link>
              );
            })}
          </div>
        </nav>

        {/* Bottom Menu */}
        <div className="p-4 border-t border-gray-200">
          {BOTTOM_MENU_ITEMS.map((item) => (
            <Link
              key={item.name}
              href={item.href}
              className="flex items-center px-3 py-2.5 rounded-lg text-sm font-medium text-gray-600 hover:bg-gray-100 hover:text-gray-900 transition-colors"
            >
              <item.icon className="w-5 h-5 mr-3 text-gray-400" />
              {item.name}
            </Link>
          ))}
        </div>
      </aside>
    </>
  );
}
