'use client';

import { useState } from 'react';
import { User, History, CheckCircle2, AlertTriangle, AlertCircle, RefreshCw, X, ChevronRight, MessageSquareText } from 'lucide-react';
import { useAtomValue } from 'jotai';
import { userAtom } from '@/stores/auth';
import ExplainableAIModal from './ExplainableAIModal';

// 모의 데이터 (임시)
const mockHistory = [
  { id: '1', title: '클린 아키텍처', time: '10분 전', status: 'PASS', aiScore: 98, type: '자동 승인' },
  { id: '2', title: '토비의 스프링', time: '45분 전', status: 'HITL_PENDING', aiScore: 45, type: '판정 보류' },
  { id: '3', title: '오브젝트', time: '2시간 전', status: 'REJECT', aiScore: 12, type: '자동 반려 (낙서)' },
  { id: '4', title: '리팩터링 2판', time: '3시간 전', status: 'PASS', aiScore: 95, type: '자동 승인' },
  { id: '5', title: 'DDD Start!', time: '어제', status: 'HITL_PENDING', aiScore: 55, type: '판정 보류' },
];

export default function DashboardTab() {
  const user = useAtomValue(userAtom);
  const [selectedLogId, setSelectedLogId] = useState<string | null>(null);

  return (
    <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 pt-4">
      {/* 4/12: 간이 프로필 & 최근 히스토리 */}
      <div className="lg:col-span-4 space-y-6">
        <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-6">
          <div className="flex items-center space-x-4 mb-4">
            <div className="w-16 h-16 bg-indigo-50 rounded-full flex items-center justify-center">
              <User className="w-8 h-8 text-indigo-600" />
            </div>
            <div className="flex-1">
              <div className="flex justify-between items-start">
                <h2 className="text-xl font-bold text-gray-900">{user?.username || '현장 작업자'}</h2>
                <span className="flex items-center text-xs font-semibold text-emerald-600 bg-emerald-50 px-2 py-1 rounded-full">
                  <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 mr-1.5"></span>
                  Online
                </span>
              </div>
              <div className="mt-1 inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-blue-100 text-blue-800">
                {user?.role || 'WORKER'}
              </div>
            </div>
          </div>
          <div className="border-t border-gray-100 pt-4 mt-2">
            <div className="flex justify-between text-sm">
              <span className="text-gray-500">금일 검수량</span>
              <span className="font-bold text-gray-900">124 건</span>
            </div>
            <div className="flex justify-between text-sm mt-2">
              <span className="text-gray-500">AI 승인율</span>
              <span className="font-bold text-green-600">92.5%</span>
            </div>
          </div>
        </div>

        <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-6">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-lg font-semibold text-gray-800 flex items-center">
              <History className="mr-2 w-5 h-5 text-gray-400" />
              최근 작업 요약
            </h3>
            <select className="text-xs border-gray-200 rounded-md bg-gray-50 text-gray-600 focus:ring-indigo-500 focus:border-indigo-500 p-1">
              <option>오늘 (Today)</option>
              <option>어제 (Yesterday)</option>
            </select>
          </div>
          <ul className="space-y-3">
            {mockHistory.map((item, idx) => (
              <li key={idx} className="flex items-center justify-between p-3 rounded-lg bg-slate-50 border border-slate-100 hover:bg-slate-100 transition-colors cursor-pointer gap-2" onClick={() => setSelectedLogId(item.id)}>
                <div className="flex items-center space-x-3 min-w-0">
                  <div className="shrink-0">
                    {item.status === 'PASS' ? <CheckCircle2 className="w-5 h-5 text-green-500" /> : item.status === 'HITL_PENDING' ? <AlertTriangle className="w-5 h-5 text-yellow-500" /> : <AlertCircle className="w-5 h-5 text-red-500" />}
                  </div>
                  <div className="min-w-0">
                    <p className="text-sm font-semibold text-gray-800 truncate">{item.title}</p>
                    <p className="text-xs text-gray-500 truncate">{item.time} · {item.type}</p>
                  </div>
                </div>
                <div className="shrink-0">
                  <span className={`inline-block px-2 py-1 rounded text-xs font-bold whitespace-nowrap text-center w-[95px] ${item.status === 'PASS' ? 'bg-green-100 text-green-800' : item.status === 'HITL_PENDING' ? 'bg-yellow-100 text-yellow-800' : 'bg-red-100 text-red-800'}`}>AI 확신도 {item.aiScore}%</span>
                </div>
              </li>
            ))}
          </ul>
          <button className="w-full mt-4 py-2 text-sm text-indigo-600 font-medium hover:bg-indigo-50 rounded-md transition-colors">
            전체 히스토리 보기 ➔
          </button>
        </div>
      </div>

      {/* 8/12: Live 워크플로우 큐 */}
      <div className="lg:col-span-8">
        <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-6 h-full flex flex-col">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 mb-6">
            <h2 className="text-lg sm:text-xl font-bold text-gray-800 flex items-center">
              <RefreshCw className="mr-2 w-5 h-5 sm:w-6 sm:h-6 text-indigo-500 animate-spin-slow shrink-0" />
              <span>Live AI 워크플로우 대기열 (Queue)</span>
            </h2>
            <span className="text-sm text-gray-500 whitespace-nowrap">현재 동시 처리 중: <strong className="text-indigo-600">3권</strong></span>
          </div>

          <div className="flex-1 space-y-4">
            {/* 진행 중 예시 */}
            <div className="border border-indigo-100 rounded-lg p-4 bg-indigo-50/30">
              <div className="flex flex-col sm:flex-row justify-between sm:items-center gap-2 mb-3">
                <span className="font-bold text-gray-800 text-sm sm:text-base">ISBN 9788966263158</span>
                <span className="text-xs font-semibold px-2.5 py-1 bg-blue-100 text-blue-700 rounded-full animate-pulse whitespace-nowrap self-start sm:self-auto">처리 중 (Policy 검증 단계)</span>
              </div>
              <div className="w-full bg-gray-200 rounded-full h-2 mb-2">
                <div className="bg-indigo-600 h-2 rounded-full w-2/3 transition-all duration-500"></div>
              </div>
            </div>
            {/* HITL 심사 대기 예시 */}
            <div className="border border-yellow-200 rounded-lg p-4 bg-yellow-50/50">
              <div className="flex flex-col sm:flex-row justify-between sm:items-center gap-2 mb-3">
                <span className="font-bold text-gray-800 text-sm sm:text-base">ISBN 9791192931448</span>
                <span className="text-xs font-semibold px-2.5 py-1 bg-yellow-200 text-yellow-800 rounded-full whitespace-nowrap self-start sm:self-auto">예외 처리: HITL 심사 필요</span>
              </div>
              <div className="w-full bg-gray-200 rounded-full h-2 mb-4">
                <div className="bg-yellow-400 h-2 rounded-full w-full"></div>
              </div>
              <button className="w-full py-2.5 bg-yellow-500 hover:bg-yellow-600 text-white font-bold rounded-md text-sm flex items-center justify-center transition-colors">
                HITL 심사 대기 보드 이동 <ChevronRight className="w-4 h-4 ml-1" />
              </button>
            </div>
          </div>
        </div>
      </div>

      <ExplainableAIModal isOpen={!!selectedLogId} onClose={() => setSelectedLogId(null)} logId={selectedLogId} />
    </div>
  );
}
