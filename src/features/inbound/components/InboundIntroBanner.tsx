'use client';

import { Camera, RefreshCcw } from 'lucide-react';

/** 입고 관제 상단 배너 - 배정 라인 선택과 검수 유형 재선택. */
export function InboundIntroBanner({ activeStation, onStationChange, onResetType }: {
  activeStation: string;
  onStationChange: (line: string) => void;
  onResetType: () => void;
}) {
  return (
      <div className="bg-white dark:bg-gray-900 p-6 rounded-2xl border border-gray-200 dark:border-gray-800 shadow-xs space-y-4 transition-colors">
        <div className="space-y-1.5">
          <div className="flex items-center gap-2 flex-wrap">
            <span className="px-2.5 py-0.5 bg-indigo-50 dark:bg-indigo-950 text-indigo-700 dark:text-indigo-300 border border-indigo-200 dark:border-indigo-800 rounded-full text-xs font-bold font-mono flex items-center gap-1.5">
              <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse"></span>
              INBOUND CONTROL CENTER v2.15.2.0
            </span>
            <span className="text-xs text-gray-400 dark:text-gray-500 font-mono">Real-time Vision AI & Fast-track Pipeline</span>
          </div>
          <h1 className="text-2xl font-extrabold tracking-tight text-gray-900 dark:text-white flex items-center gap-2">
            <Camera className="w-6 h-6 text-indigo-600 dark:text-indigo-400" />
            현장 입고 & AI 훼손 정밀 검수 관제
          </h1>
          <p className="text-xs text-gray-500 dark:text-gray-400 max-w-4xl leading-relaxed">
            신품 도서는 사진 촬영 없이 <strong className="text-indigo-600 dark:text-indigo-300 font-black">ISBN 바코드 스캔만으로 0초 만에 재고 입고</strong>되며, 중고/반품 도서는 <strong className="text-amber-600 dark:text-amber-300 font-black">Multi-Agent AI 비전 파이프라인</strong>을 통해 훼손 등급과 매입가를 정밀 평가합니다.
          </p>
        </div>

        {/* 파이프라인 설명 텍스트 종료 후 하단 컨트롤 배치 구역 */}
        <div className="@container/controls pt-3 border-t border-gray-100 dark:border-gray-800 flex flex-col @md/controls:flex-row items-start @md/controls:items-center justify-between gap-3 flex-wrap">
          <div className="flex items-center gap-2.5 px-3.5 py-2 rounded-xl bg-gray-50 dark:bg-gray-800 border border-gray-200 dark:border-gray-700 text-xs font-bold text-gray-700 dark:text-gray-200 min-w-0 max-w-full">
            <span className="text-gray-500 dark:text-gray-400 flex items-center gap-1.5 shrink-0">
              <span className="w-2 h-2 rounded-full bg-emerald-500 animate-ping"></span>
              📍 배정 라인:
            </span>
            <select
              value={activeStation}
              onChange={(e) => onStationChange(e.target.value)}
              className="bg-transparent text-emerald-700 dark:text-emerald-300 font-black px-1.5 py-1 rounded-lg cursor-pointer focus:outline-none focus:ring-2 focus:ring-emerald-400 text-xs min-w-0 flex-1 truncate"
            >
              <option value="A" className="dark:bg-gray-800">Line A (Workstation A - 메인 입고 라인)</option>
              <option value="B" className="dark:bg-gray-800">Line B (Workstation B)</option>
              <option value="C" className="dark:bg-gray-800">Line C (Workstation C)</option>
              <option value="D" className="dark:bg-gray-800">Line D (Workstation D)</option>
              <option value="E" className="dark:bg-gray-800">Line E (Workstation E)</option>
            </select>
          </div>

          <button
            onClick={onResetType}
            className="px-4 py-2.5 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white font-bold text-xs shadow-xs transition-all flex items-center gap-2 cursor-pointer shrink-0"
          >
            <RefreshCcw className="w-4 h-4" />
            검수 유형 재선택
          </button>
        </div>
      </div>
  );
}
