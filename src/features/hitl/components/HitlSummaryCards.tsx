'use client';

import { AlertTriangle, FileCheck, Sparkles } from 'lucide-react';

/** HITL 결재 KPI 3카드 (대기 총계·선택 건·필터 적용 건). */
export function HitlSummaryCards({ total, selected, filtered, alertThreshold }: {
  total: number; selected: number; filtered: number; alertThreshold: number;
}) {
  return (
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <div className={`bg-white dark:bg-gray-900 p-5 rounded-2xl border shadow-xs space-y-1 transition-colors ${
          total >= alertThreshold
            ? 'border-rose-300 dark:border-rose-800 ring-2 ring-rose-500/20'
            : 'border-gray-200 dark:border-gray-800'
        }`}>
          <div className="flex items-center justify-between text-xs font-extrabold text-gray-500 dark:text-gray-400">
            <span>검수 대기 총계</span>
            <AlertTriangle className={`w-4 h-4 ${total >= alertThreshold ? 'text-rose-600 dark:text-rose-400' : 'text-amber-600 dark:text-amber-400'}`} />
          </div>
          <p className={`text-3xl font-black font-mono ${total >= alertThreshold ? 'text-rose-600 dark:text-rose-400' : 'text-amber-600 dark:text-amber-400'}`}>
            {total}<span className="text-sm font-bold text-gray-500 dark:text-gray-400 ml-1">건</span>
          </p>
          <p className="text-xs text-gray-500 dark:text-gray-400 font-medium">
            Supervisor 이관 - 관리자 결재 대기 (경보 기준 {alertThreshold}건)
          </p>
        </div>

        <div className="bg-white dark:bg-gray-900 p-5 rounded-2xl border border-gray-200 dark:border-gray-800 shadow-xs space-y-1">
          <div className="flex items-center justify-between text-xs font-extrabold text-gray-500 dark:text-gray-400">
            <span>선택된 처리 건</span>
            <FileCheck className="w-4 h-4 text-blue-600 dark:text-blue-400" />
          </div>
          <p className="text-3xl font-black text-blue-600 dark:text-blue-400 font-mono">
            {selected}<span className="text-sm font-bold text-gray-500 dark:text-gray-400 ml-1">건</span>
          </p>
          <p className="text-xs text-gray-500 dark:text-gray-400 font-medium">체크박스 선택 시 결재 폼 활성화</p>
        </div>

        <div className="bg-white dark:bg-gray-900 p-5 rounded-2xl border border-gray-200 dark:border-gray-800 shadow-xs space-y-1">
          <div className="flex items-center justify-between text-xs font-extrabold text-gray-500 dark:text-gray-400">
            <span>검색 필터 적용 건</span>
            <Sparkles className="w-4 h-4 text-purple-600 dark:text-purple-400" />
          </div>
          <p className="text-3xl font-black text-purple-600 dark:text-purple-400 font-mono">
            {filtered}<span className="text-sm font-bold text-gray-500 dark:text-gray-400 ml-1">건</span>
          </p>
          <p className="text-xs text-gray-500 dark:text-gray-400 font-medium">도서명 / ISBN / LPN / Task ID 키워드 필터</p>
        </div>
      </div>
  );
}
