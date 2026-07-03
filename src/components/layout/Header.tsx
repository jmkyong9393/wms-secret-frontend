'use client';

import { useAtomValue } from 'jotai';
import { uploadQueueAtom } from '@/stores/atoms';
import { Bell, User, CloudUpload, CloudOff } from 'lucide-react';
import { usePathname } from 'next/navigation';

export default function Header() {
  const uploadQueue = useAtomValue(uploadQueueAtom);
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

        {/* User Profile */}
        <div className="flex items-center pl-2 border-l border-gray-200">
          <div className="w-8 h-8 bg-indigo-100 rounded-full flex items-center justify-center text-indigo-700">
            <User className="w-4 h-4" />
          </div>
          <span className="ml-2 text-sm font-medium text-gray-700 hidden md:block">
            현장 관리자
          </span>
        </div>
      </div>
    </header>
  );
}
