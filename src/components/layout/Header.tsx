'use client';

import { useState } from 'react';
import { useAtomValue } from 'jotai';
import { uploadQueueAtom } from '@/stores/atoms';
import { userAtom } from '@/stores/auth';
import { Bell, User, CloudUpload, CloudOff, Sun, Moon } from 'lucide-react';
import { usePathname } from 'next/navigation';
import { useEffect } from 'react';

export default function Header() {
  const uploadQueue = useAtomValue(uploadQueueAtom);
  const user = useAtomValue(userAtom);
  const [dropdownOpen, setDropdownOpen] = useState(false);
  const [isDarkMode, setIsDarkMode] = useState(false);
  const pendingCount = uploadQueue.filter(t => t.status !== 'COMPLETED').length;
  const isOnline = true; // 추후 PWA navigator.onLine 연동

  useEffect(() => {
    if (typeof window !== 'undefined') {
      const isDark = document.documentElement.classList.contains('dark') || localStorage.getItem('nexus-theme') === 'dark';
      setIsDarkMode(isDark);
      if (isDark) {
        document.documentElement.classList.add('dark');
        document.body.classList.add('dark');
      } else {
        document.documentElement.classList.remove('dark');
        document.body.classList.remove('dark');
      }

      const handleThemeEvent = (e: Event) => {
        const customEvt = e as CustomEvent<{ isDark: boolean }>;
        if (customEvt.detail && typeof customEvt.detail.isDark === 'boolean') {
          setIsDarkMode(customEvt.detail.isDark);
        }
      };

      window.addEventListener('nexus-theme-change', handleThemeEvent);
      return () => window.removeEventListener('nexus-theme-change', handleThemeEvent);
    }
  }, []);

  const toggleTheme = () => {
    const nextDark = !isDarkMode;
    setIsDarkMode(nextDark);
    if (nextDark) {
      document.documentElement.classList.add('dark');
      document.body.classList.add('dark');
      localStorage.setItem('nexus-theme', 'dark');
    } else {
      document.documentElement.classList.remove('dark');
      document.body.classList.remove('dark');
      localStorage.setItem('nexus-theme', 'light');
    }
    window.dispatchEvent(new CustomEvent('nexus-theme-change', { detail: { isDark: nextDark } }));
  };

  const pathname = usePathname();
  const getPageTitle = (path: string) => {
    switch (path) {
      case '/admin/dashboard':
      case '/admin':
        return '종합 대시보드';
      case '/inbound':
        return '현장 반품 검수';
      case '/worker/inspections':
        return '나의 검수 내역 (작업자)';
      case '/admin/hitl':
        return '승인 대기 (HITL)';
      case '/admin/inspections':
        return '검수 처리 내역 (전체)';
      case '/admin/inventory':
      case '/inventory':
        return '재고 현황';
      case '/admin/outbound':
        return '출고 최적화 (3D/송장)';
      case '/admin/po':
      case '/po':
        return '발주 관리 (AI)';
      case '/admin/employees':
        return '사원 관리';
      case '/admin/settings':
        return '시스템 설정';
      default:
        if (path.startsWith('/admin/')) return '관제 콘솔';
        return '종합 대시보드';
    }
  };
  const pageTitle = getPageTitle(pathname);

  // ISMS-P 2.6.3 개인정보 표시제한 (가운데 글자 마스킹: 장*경, 홍*동)
  const maskName = (name: string) => {
    if (!name) return '사용자';
    if (name.length <= 2) return name.charAt(0) + '*';
    if (name.length === 3) {
      return name.charAt(0) + '*' + name.charAt(2); // 가운데 글자 마스킹 (장*경)
    }
    return name.charAt(0) + '*'.repeat(name.length - 2) + name.charAt(name.length - 1);
  };

  return (
    <header className="h-[clamp(3.75rem,6.5vh,5.5rem)] bg-white dark:bg-gray-900 border-b border-gray-200 dark:border-gray-800 flex items-center justify-between px-3 sm:px-6 lg:px-8 transition-colors duration-200">
      <div className="flex items-center gap-[clamp(0.5rem,1vw,1.25rem)]">
        <div className="flex items-center gap-[clamp(0.4rem,0.8vw,0.85rem)] ml-10 lg:ml-0">
          {/* Light Mode Logo Emblem (Fluid Viewport Adaptive Scaling) */}
          <img 
            src="/nexus_header_logo_light.jpg" 
            alt="Nexus WMS Logo Light" 
            className="h-[clamp(2.25rem,4.2vh,3.5rem)] max-w-[18vw] w-auto rounded-xl border-2 border-blue-200/80 shadow-sm object-cover hover:scale-105 transition-all duration-200 dark:hidden"
          />
          {/* Dark Mode Logo Emblem (Fluid Viewport Adaptive Scaling) */}
          <img 
            src="/nexus_header_logo_dark.jpg" 
            alt="Nexus WMS Logo Dark" 
            className="h-[clamp(2.25rem,4.2vh,3.5rem)] max-w-[18vw] w-auto rounded-xl border-2 border-blue-500/50 shadow-sm object-cover hover:scale-105 transition-all duration-200 hidden dark:block"
          />
          <div className="h-[clamp(1.25rem,2.5vh,2.2rem)] w-px bg-gray-300 dark:bg-gray-700 hidden sm:block"></div>
        </div>
        <h1 className="text-[clamp(1.15rem,1.2vw+0.4rem,1.85rem)] font-black text-gray-900 dark:text-white tracking-tight leading-none">
          {pageTitle}
        </h1>
      </div>

      {/* Right Side: Status & Profile */}
      <div className="flex items-center space-x-4">
        
        {/* Network & Queue Status */}
        <div className="hidden sm:flex items-center px-3 py-1.5 rounded-full bg-gray-50 dark:bg-gray-800 border border-gray-100 dark:border-gray-700">
          {isOnline ? (
            <CloudUpload className="w-4 h-4 text-green-500 mr-2" />
          ) : (
            <CloudOff className="w-4 h-4 text-red-500 mr-2" />
          )}
          <span className="text-xs font-medium text-gray-600 dark:text-gray-300">
            {isOnline ? 'Online' : 'Offline'}
          </span>
          <div className="w-px h-4 bg-gray-300 dark:bg-gray-700 mx-3"></div>
          <span className="text-xs font-medium text-gray-600 dark:text-gray-300">
            대기열: <span className={pendingCount > 0 ? "text-blue-600 dark:text-blue-400 font-bold" : ""}>{pendingCount}건</span>
          </span>
        </div>

        {/* Global Light / Dark Mode Toggle */}
        <button
          onClick={toggleTheme}
          className="p-2 text-gray-500 dark:text-gray-300 hover:text-gray-900 dark:hover:text-white transition-colors rounded-full hover:bg-gray-100 dark:hover:bg-gray-800"
          title={isDarkMode ? '라이트 모드로 전환' : '다크 모드로 전환'}
        >
          {isDarkMode ? (
            <Sun className="w-5 h-5 text-amber-400 animate-in spin-in-90" />
          ) : (
            <Moon className="w-5 h-5 text-indigo-600" />
          )}
        </button>

        {/* Notifications */}
        <button className="relative p-2 text-gray-400 dark:text-gray-400 hover:text-gray-600 dark:hover:text-gray-200 transition-colors rounded-full hover:bg-gray-100 dark:hover:bg-gray-800">
          <Bell className="w-5 h-5" />
          {pendingCount > 0 && (
            <span className="absolute top-1.5 right-1.5 w-2 h-2 bg-red-500 rounded-full border-2 border-white dark:border-gray-900"></span>
          )}
        </button>

        {/* User Profile (Interactive Dropdown) */}
        <div className="flex items-center pl-2 border-l border-gray-200 dark:border-gray-800 relative">
          <button 
            onClick={() => setDropdownOpen(!dropdownOpen)}
            className="flex items-center hover:bg-gray-100 dark:hover:bg-gray-800 p-2 rounded-md transition-colors"
            title="사용자 메뉴 (ISMS-P 마스킹 적용)"
          >
            <div className="w-8 h-8 bg-indigo-100 dark:bg-indigo-950/80 rounded-full flex items-center justify-center text-indigo-700 dark:text-indigo-300 font-bold text-xs">
              {user?.name ? maskName(user.name).charAt(0) : <User className="w-4 h-4" />}
            </div>
            <span className="ml-2 text-sm font-bold text-gray-700 dark:text-gray-200 hidden md:flex items-center">
              {user ? maskName(user.name) : '로그인 필요'}
              <svg className="w-4 h-4 ml-1 text-gray-400 dark:text-gray-500" fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 9l-7 7-7-7"></path></svg>
            </span>
          </button>

          {/* Dropdown Menu */}
          {dropdownOpen && (
            <div className="absolute right-0 top-12 mt-2 w-52 bg-white dark:bg-gray-800 rounded-xl shadow-xl py-2 z-50 border border-gray-200 dark:border-gray-700 font-sans text-gray-900 dark:text-white">
              {!user ? (
                <button
                  onClick={() => {
                    document.cookie = 'token=; expires=Thu, 01 Jan 1970 00:00:00 UTC; path=/;';
                    document.cookie = 'accessToken=; expires=Thu, 01 Jan 1970 00:00:00 UTC; path=/;';
                    document.cookie = 'role=; expires=Thu, 01 Jan 1970 00:00:00 UTC; path=/;';
                    if (typeof window !== 'undefined') {
                      sessionStorage.clear();
                      localStorage.removeItem('auth-user');
                    }
                    window.location.href = '/login';
                  }}
                  className="block w-full text-left px-4 py-2 text-sm font-bold text-indigo-600 dark:text-indigo-400 hover:bg-indigo-50 dark:hover:bg-indigo-950/50"
                >
                  🔑 로그인 페이지로 이동
                </button>
              ) : (
                <>
                  <div className="px-4 py-2 border-b border-gray-100 dark:border-gray-700 bg-gray-50/70 dark:bg-gray-800/90">
                    <p className="text-sm font-black text-gray-900 dark:text-white flex items-center justify-between">
                      {maskName(user.name)}
                      <span className="text-[10px] px-1.5 py-0.5 rounded bg-blue-100 dark:bg-blue-950 text-blue-700 dark:text-blue-300 font-mono font-bold">ISMS-P</span>
                    </p>
                    <p className="text-xs text-gray-500 dark:text-gray-400 font-mono mt-0.5">{user.employee_id} ({user.role})</p>
                  </div>
                  <button
                    onClick={() => {
                      setDropdownOpen(false);
                      window.location.href = '/mypage';
                    }}
                    className="block w-full text-left px-4 py-2 text-sm text-gray-700 hover:bg-gray-100"
                  >
                    마이페이지
                  </button>
                  <button
                    onClick={() => {
                      document.cookie = 'token=; expires=Thu, 01 Jan 1970 00:00:00 UTC; path=/;';
                      document.cookie = 'accessToken=; expires=Thu, 01 Jan 1970 00:00:00 UTC; path=/;';
                      document.cookie = 'role=; expires=Thu, 01 Jan 1970 00:00:00 UTC; path=/;';
                      if (typeof window !== 'undefined') {
                        sessionStorage.clear();
                        localStorage.removeItem('auth-user');
                      }
                      window.location.href = '/login';
                    }}
                    className="block w-full text-left px-4 py-2 text-sm text-red-600 hover:bg-red-50"
                  >
                    로그아웃
                  </button>
                </>
              )}
            </div>
          )}
        </div>
      </div>
    </header>
  );
}
