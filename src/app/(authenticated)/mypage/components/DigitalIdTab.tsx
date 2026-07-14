'use client';

import { Smartphone } from 'lucide-react';
import { useAtomValue } from 'jotai';
import { userAtom } from '@/stores/auth';

export default function DigitalIdTab() {
  const user = useAtomValue(userAtom);

  return (
    <div className="max-w-2xl mx-auto pt-4">
      <div className="bg-gradient-to-br from-indigo-500 to-purple-600 rounded-2xl shadow-xl p-8 text-white relative overflow-hidden">
        <div className="absolute -right-10 -top-10 w-40 h-40 bg-white opacity-10 rounded-full blur-2xl"></div>
        <div className="absolute -left-10 -bottom-10 w-40 h-40 bg-white opacity-10 rounded-full blur-2xl"></div>
        
        <div className="relative z-10 flex flex-col items-center">
          <h2 className="text-2xl font-bold flex items-center mb-8">
            <Smartphone className="mr-3 w-8 h-8 text-indigo-100" />
            나의 디지털 사원증 (Digital ID)
          </h2>
          
          <div className="bg-white rounded-2xl p-8 flex flex-col items-center justify-center space-y-6 w-full max-w-sm shadow-inner">
            <div className="w-full h-32 bg-gray-50 rounded-xl flex flex-col items-center justify-center p-4 border border-gray-200">
              {/* 바코드 목업 패턴 */}
              <div className="flex items-end space-x-1 h-16">
                <div className="w-1.5 h-full bg-black"></div>
                <div className="w-2.5 h-full bg-black"></div>
                <div className="w-1.5 h-full bg-black"></div>
                <div className="w-4 h-full bg-black"></div>
                <div className="w-1 h-full bg-black"></div>
                <div className="w-2 h-full bg-black"></div>
                <div className="w-1.5 h-full bg-black"></div>
                <div className="w-3 h-full bg-black"></div>
                <div className="w-1.5 h-full bg-black"></div>
                <div className="w-4 h-full bg-black"></div>
                <div className="w-1 h-full bg-black"></div>
                <div className="w-2 h-full bg-black"></div>
                <div className="w-1.5 h-full bg-black"></div>
                <div className="w-3 h-full bg-black"></div>
                <div className="w-1.5 h-full bg-black"></div>
                <div className="w-4 h-full bg-black"></div>
              </div>
              <span className="font-mono text-gray-800 tracking-[0.4em] font-bold mt-4 text-lg">EMP-{user?.username || '8921'}</span>
            </div>
            
            <div className="text-center">
              <h3 className="text-xl font-bold text-gray-900">{user?.username || '현장 작업자'}</h3>
              <p className="text-indigo-600 font-medium text-sm mt-1">{user?.role || 'WORKER'}</p>
            </div>
            
            <p className="text-sm text-gray-500 font-medium text-center bg-gray-50 px-4 py-2 rounded-lg w-full border border-gray-100">
              창고 게이트 출입 및 PDA 장비 대여 시<br/>위 바코드를 스캔하세요.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
