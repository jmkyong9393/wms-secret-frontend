'use client';

import type { DemoOrder } from '@/features/outbound/model/types';
import { Sparkles, Box, TrendingUp, CheckCircle2 } from 'lucide-react';
import type { BoxOption } from '../constants/boxOptions';

/** 출고 관제 KPI 3카드 (AI 추천 박스·동적 할인율·당일 출고). */
export function OutboundKpiCards({ selectedCount, bestBox, cushionName, mockOrder, outboundSummary, isSummaryLoading }: {
  selectedCount: number;
  bestBox: BoxOption;
  cushionName: string;
  mockOrder: DemoOrder | null;
  outboundSummary: { shippedTodayCount: number; onTimeRatePercent: number };
  isSummaryLoading: boolean;
}) {
  return (
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <div className="bg-white dark:bg-gray-900 rounded-2xl p-5 border border-indigo-200 dark:border-indigo-900/60 shadow-xs ring-1 ring-indigo-500/10">
          <div className="flex items-center justify-between mb-2">
            <span className="text-xs text-indigo-600 dark:text-indigo-400 font-extrabold uppercase tracking-wider flex items-center gap-1">
              <Sparkles className="w-3.5 h-3.5" /> AI 1위 추천 박스 & 완충재 팩
            </span>
            <Box className="w-5 h-5 text-indigo-600 dark:text-indigo-400" />
          </div>
          <div className="flex items-end justify-between">
            <div>
              <span className="text-base sm:text-lg font-black text-indigo-900 dark:text-indigo-200 font-mono block">
                {selectedCount === 0 ? "도서 선택 대기 중" : `${bestBox.id} + ${cushionName}`}
              </span>
              <span className="text-[11px] text-gray-500 dark:text-gray-400 font-bold block">
                {selectedCount === 0 ? "선택 도서 3D 규격 맞춤 연동" : `${bestBox.name} (${bestBox.specs})`}
              </span>
            </div>
            <div className="text-right">
              <span className="text-xs text-emerald-600 dark:text-emerald-400 font-black bg-emerald-50 dark:bg-emerald-950/60 px-2 py-1 rounded block">
                {selectedCount === 0 ? "적재율 0%" : `공간효율 ${bestBox.eff}%`}
              </span>
              <span className="text-[10px] text-indigo-600 dark:text-indigo-300 font-bold block pt-0.5">
                SAFE (A+) 등급
              </span>
            </div>
          </div>
        </div>

        <div className="bg-white dark:bg-gray-900 rounded-2xl p-5 border border-gray-200 dark:border-gray-800 shadow-xs">
          <div className="flex items-center justify-between mb-2">
            <span className="text-xs text-gray-400 dark:text-gray-500 font-bold uppercase tracking-wider">동적 가격 할인율</span>
            <TrendingUp className="w-5 h-5 text-emerald-600 dark:text-emerald-400" />
          </div>
          <div className="flex items-end justify-between">
            <span className="text-2xl font-black text-gray-900 dark:text-white font-mono">
              {mockOrder?.discount_rate || '25%'}
            </span>
            <span className="text-xs text-blue-600 dark:text-blue-400 font-bold bg-blue-50 dark:bg-blue-950/60 px-2 py-1 rounded">
              {mockOrder?.trend_badge_text || '비부패성 보관료 방어: -3.2% (120일 체류)'}
            </span>
          </div>
        </div>

        <div className="bg-white dark:bg-gray-900 rounded-2xl p-5 border border-gray-200 dark:border-gray-800 shadow-xs">
          <div className="flex items-center justify-between mb-2">
            <span className="text-xs text-gray-400 dark:text-gray-500 font-bold uppercase tracking-wider">당일 출고 완료</span>
            <CheckCircle2 className="w-5 h-5 text-emerald-600 dark:text-emerald-400" />
          </div>
          <div className="flex items-end justify-between">
            <span className="text-3xl font-black text-gray-900 dark:text-white font-mono">
              {isSummaryLoading ? '...' : `${outboundSummary.shippedTodayCount}건`}
            </span>
            <span className="text-xs text-emerald-600 dark:text-emerald-400 font-bold bg-emerald-50 dark:bg-emerald-950/60 px-2 py-1 rounded">
              정시 출고률 {outboundSummary.onTimeRatePercent}%
            </span>
          </div>
        </div>
      </div>
  );
}
