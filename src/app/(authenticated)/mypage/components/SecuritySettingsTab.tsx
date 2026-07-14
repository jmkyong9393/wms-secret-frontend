'use client';

import { Shield, Bell, Key } from 'lucide-react';
import { useAtomValue } from 'jotai';
import { userAtom } from '@/stores/auth';

export default function SecuritySettingsTab() {
  const user = useAtomValue(userAtom);

  return (
    <div className="max-w-3xl mx-auto space-y-8 pt-4">
      {/* 개인 정보 및 셋팅 */}
      <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-8">
        <h2 className="text-xl font-bold text-gray-800 flex items-center mb-6">
          <Shield className="mr-3 w-6 h-6 text-indigo-600" />
          보안 및 내 정보
        </h2>
        
        <div className="space-y-5">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">아이디 (사번)</label>
            <input type="text" disabled value={user?.username || 'user123'} className="w-full text-sm border border-gray-200 rounded-lg px-4 py-2.5 bg-gray-50 text-gray-500 font-medium" />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1 flex items-center">
              <Key className="w-4 h-4 mr-1 text-gray-400" /> 새 비밀번호
            </label>
            <input type="password" placeholder="새로운 비밀번호 입력" className="w-full text-sm border border-gray-200 rounded-lg px-4 py-2.5 focus:ring-2 focus:ring-indigo-500 outline-none" />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">새 비밀번호 확인</label>
            <input type="password" placeholder="새로운 비밀번호 재입력" className="w-full text-sm border border-gray-200 rounded-lg px-4 py-2.5 focus:ring-2 focus:ring-indigo-500 outline-none" />
          </div>
          <div className="pt-4">
            <button className="w-full bg-indigo-600 text-white font-bold py-3 rounded-lg hover:bg-indigo-700 transition-colors">
              정보 수정
            </button>
          </div>
        </div>
      </div>

      <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-8">
        <h2 className="text-xl font-bold text-gray-800 flex items-center mb-6">
          <Bell className="mr-3 w-6 h-6 text-indigo-600" />
          PWA 현장 알림 설정
        </h2>
        
        <div className="space-y-6">
          <div className="flex items-center justify-between p-4 bg-slate-50 rounded-lg border border-slate-100">
            <div>
              <span className="block text-base font-bold text-gray-900">시스템 소리 알림</span>
              <span className="block text-sm text-gray-500 mt-1">판정 완료 시 스마트폰 스피커 알림</span>
            </div>
            <label className="relative inline-flex items-center cursor-pointer">
              <input type="checkbox" value="" className="sr-only peer" defaultChecked />
              <div className="w-14 h-7 bg-gray-200 peer-focus:outline-none peer-focus:ring-2 peer-focus:ring-indigo-300 rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-6 after:w-6 after:transition-all peer-checked:bg-indigo-600"></div>
            </label>
          </div>

          <div className="flex items-center justify-between p-4 bg-slate-50 rounded-lg border border-slate-100">
            <div>
              <span className="block text-base font-bold text-gray-900">진동 피드백 (Haptic)</span>
              <span className="block text-sm text-gray-500 mt-1">바코드 스캔 및 에러 발생 시 스마트폰 진동</span>
            </div>
            <label className="relative inline-flex items-center cursor-pointer">
              <input type="checkbox" value="" className="sr-only peer" defaultChecked />
              <div className="w-14 h-7 bg-gray-200 peer-focus:outline-none peer-focus:ring-2 peer-focus:ring-indigo-300 rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-6 after:w-6 after:transition-all peer-checked:bg-indigo-600"></div>
            </label>
          </div>
        </div>
      </div>
    </div>
  );
}
