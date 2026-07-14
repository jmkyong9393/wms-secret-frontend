'use client';

import { useState } from 'react';
import { useAtomValue } from 'jotai';
import { uploadQueueAtom } from '@/stores/atoms';
import { userAtom } from '@/stores/auth';
import { Bell, User, CloudUpload, CloudOff } from 'lucide-react';
import { usePathname } from 'next/navigation';

export default function Header() {
  const uploadQueue = useAtomValue(uploadQueueAtom);
  const user = useAtomValue(userAtom);
  const [dropdownOpen, setDropdownOpen] = useState(false);
  const pendingCount = uploadQueue.filter(t => t.status !== 'COMPLETED').length;
  const isOnline = true; // 추후 PWA navigator.onLine 연동

  const pathname = usePathname();
  let pageTitle = 'Dashboard';
  if (pathname === '/inbound') pageTitle = '현장 반품 검수';
  if (pathname === '/inventory') pageTitle = '가상 재고 창고';
  if (pathname === '/po') pageTitle = '자동 발주 현황';
  if (pathname === '/reports') pageTitle = 'AI 품질 리포트';

  return (
    <header className="h-16 bg-white border-b border-gray-200 flex items-center justify-between px-4 lg:px-8">
      {/* Mobile Title Spacer (since hamburger menu is on the left) */}
      <div className="flex items-center">
        <h1 className="text-lg font-semibold text-gray-800 ml-12 lg:ml-0">
          {pageTitle}
        </h1>
      </div>

      {/* Right Side: Status & Profile */}
      <div className="flex items-center space-x-4">
        
        {/* Network & Queue Status */}
        <div className="hidden sm:flex items-center px-3 py-1.5 rounded-full bg-gray-50 border border-gray-100">
          {isOnline ? (
            <CloudUpload className="w-4 h-4 text-green-500 mr-2" />
          ) : (
            <CloudOff className="w-4 h-4 text-red-500 mr-2" />
          )}
          <span className="text-xs font-medium text-gray-600">
            {isOnline ? 'Online' : 'Offline'}
          </span>
          <div className="w-px h-4 bg-gray-300 mx-3"></div>
          <span className="text-xs font-medium text-gray-600">
            대기열: <span className={pendingCount > 0 ? "text-blue-600 font-bold" : ""}>{pendingCount}건</span>
          </span>
        </div>

        {/* Notifications */}
        <button className="relative p-2 text-gray-400 hover:text-gray-600 transition-colors rounded-full hover:bg-gray-100">
          <Bell className="w-5 h-5" />
          {pendingCount > 0 && (
            <span className="absolute top-1.5 right-1.5 w-2 h-2 bg-red-500 rounded-full border-2 border-white"></span>
          )}
        </button>

        {/* User Profile (Interactive Dropdown) */}
        <div className="flex items-center pl-2 border-l border-gray-200 relative">
          <button 
            onClick={() => setDropdownOpen(!dropdownOpen)}
            className="flex items-center hover:bg-gray-100 p-2 rounded-md transition-colors"
            title="사용자 메뉴"
          >
            <div className="w-8 h-8 bg-indigo-100 rounded-full flex items-center justify-center text-indigo-700">
              <User className="w-4 h-4" />
            </div>
            <span className="ml-2 text-sm font-medium text-gray-700 hidden md:flex items-center">
              {user ? user.username : '로그인 필요'}
              <svg className="w-4 h-4 ml-1 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 9l-7 7-7-7"></path></svg>
            </span>
          </button>

          {/* Dropdown Menu */}
          {dropdownOpen && (
            <div className="absolute right-0 top-12 mt-2 w-48 bg-white rounded-md shadow-lg py-1 z-50 ring-1 ring-black ring-opacity-5">
              {!user ? (
                <button
                  onClick={() => {
                    window.location.href = '/login';
                  }}
                  className="block w-full text-left px-4 py-2 text-sm text-gray-700 hover:bg-gray-100"
                >
                  로그인
                </button>
              ) : (
                <>
                  <div className="px-4 py-2 border-b border-gray-100">
                    <p className="text-sm font-medium text-gray-900">{user.username}</p>
                    <p className="text-xs text-gray-500 truncate">{user.role}</p>
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
                      document.cookie = 'role=; expires=Thu, 01 Jan 1970 00:00:00 UTC; path=/;';
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
