'use client';

import { CheckCircle2 } from 'lucide-react';

/** 큐 등록 완료 무대 - LPN·도서명·다음 안내. */
export function ResultStage({ currentLpn, title }: { currentLpn: string; title: string }) {
  return (
          <div className="relative z-10 bg-white p-8 rounded-2xl flex flex-col items-center animate-in zoom-in-95 shadow-xl w-72 text-center">
            <div className="w-16 h-16 bg-emerald-100 rounded-full flex items-center justify-center mb-3">
              <CheckCircle2 className="w-8 h-8 text-emerald-600" />
            </div>
            <div className="bg-gray-100 px-3 py-1 rounded mb-2 border border-gray-200">
              <span className="text-xs font-mono font-bold text-gray-600 tracking-wider">{currentLpn}</span>
            </div>
            <h2 className="text-xl font-bold text-gray-800 mb-3">
              {title}
            </h2>
            <div className="px-4 py-1.5 bg-emerald-50 border border-emerald-200 rounded-full mb-5 shadow-sm">
              <span className="text-emerald-700 font-extrabold">AI 검수 큐 등록 완료</span>
            </div>
            <p className="text-sm text-gray-500 font-medium">
              AI 판독 에이전트가 검수를 시작했습니다.<br/>다음 도서 스캔을 진행하세요.
            </p>
          </div>
  );
}
