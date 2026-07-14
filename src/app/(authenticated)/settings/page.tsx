'use client';

import { LogOut, User, Bell, Shield, Smartphone } from 'lucide-react';
import Cookies from 'js-cookie';

export default function SettingsPage() {
  const handleLogout = () => {
    Cookies.remove('token');
    window.location.href = '/login';
  };

  return (
    <div className="p-4 md:p-6 max-w-4xl mx-auto space-y-6 animate-in fade-in duration-500">
      <div>
        <h1 className="text-2xl font-bold text-gray-900">설정</h1>
        <p className="text-gray-500 text-sm mt-1">계정 정보 및 시스템 환경 설정을 관리합니다.</p>
      </div>

      <div className="bg-white rounded-xl border border-gray-100 shadow-sm overflow-hidden">
        <div className="p-5 border-b border-gray-100 bg-gray-50/50 flex items-center gap-3">
          <div className="w-12 h-12 bg-blue-100 rounded-full flex items-center justify-center text-blue-600">
            <User className="w-6 h-6" />
          </div>
          <div>
            <h2 className="text-lg font-bold text-gray-900">마스터 관리자</h2>
            <p className="text-sm font-medium text-gray-500">master@wms-ai.com</p>
          </div>
        </div>
        
        <div className="divide-y divide-gray-100">
          <button className="w-full p-4 flex items-center justify-between hover:bg-gray-50 transition-colors">
            <div className="flex items-center text-gray-700">
              <Bell className="w-5 h-5 mr-3 text-gray-400" />
              <span className="font-medium text-sm">푸시 알림 설정</span>
            </div>
            <div className="w-10 h-5 bg-blue-600 rounded-full relative">
              <div className="absolute right-1 top-1 w-3 h-3 bg-white rounded-full"></div>
            </div>
          </button>
          <button className="w-full p-4 flex items-center justify-between hover:bg-gray-50 transition-colors">
            <div className="flex items-center text-gray-700">
              <Smartphone className="w-5 h-5 mr-3 text-gray-400" />
              <span className="font-medium text-sm">기기 등록 관리 (모바일 스캐너)</span>
            </div>
            <span className="text-xs font-bold text-gray-500">기기 3대 연동됨 &rarr;</span>
          </button>
          <button className="w-full p-4 flex items-center justify-between hover:bg-gray-50 transition-colors">
            <div className="flex items-center text-gray-700">
              <Shield className="w-5 h-5 mr-3 text-gray-400" />
              <span className="font-medium text-sm">보안 및 권한 관리</span>
            </div>
            <span className="text-xs font-bold text-gray-500">&rarr;</span>
          </button>
        </div>
        
        <div className="p-4 bg-gray-50 border-t border-gray-100 flex justify-end">
          <button 
            onClick={handleLogout}
            className="flex items-center text-red-600 font-bold text-sm px-4 py-2 hover:bg-red-50 rounded-lg transition-colors"
          >
            <LogOut className="w-4 h-4 mr-2" />
            로그아웃
          </button>
        </div>
      </div>
    </div>
  );
}
