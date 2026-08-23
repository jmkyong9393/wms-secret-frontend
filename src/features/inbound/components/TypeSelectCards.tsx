'use client';

import { BookOpen, Camera } from 'lucide-react';

/** 입고 검수 유형 선택 카드 2종 (신품 Fast-track / 중고 AI 정밀 검수). */
export function TypeSelectCards({ onSelect }: {
  onSelect: (type: 'NEW_FASTTRACK' | 'USED_RETURN_INSPECTION') => void;
}) {
  return (
            <div className="z-10 p-6 space-y-6 w-full max-w-lg animate-in fade-in zoom-in-95 duration-200">
              <div className="text-center space-y-1">
                <h2 className="text-2xl font-black text-gray-900 dark:text-white tracking-tight">📋 입고 검수 유형 선택</h2>
                <p className="text-xs text-gray-500 dark:text-slate-400">현장 상황 및 도서 상태에 맞는 입고 프로세스를 선택해 주세요.</p>
              </div>

              <div className="grid grid-cols-1 gap-4">
                {/* Card 1: Fast-track New Book Inbound (Skip Photo 100%) */}
                <button
                  onClick={() => onSelect('NEW_FASTTRACK')}
                  className="p-6 rounded-2xl bg-white dark:bg-gradient-to-br dark:from-indigo-950/90 dark:via-slate-900 dark:to-slate-950 border-2 border-indigo-200 dark:border-indigo-500/60 hover:border-indigo-500 dark:hover:border-indigo-400 text-left transition-all hover:scale-[1.02] shadow-lg dark:shadow-2xl group cursor-pointer"
                >
                  <div className="flex items-center justify-between mb-3">
                    <div className="p-3.5 rounded-2xl bg-indigo-50 text-indigo-600 dark:bg-indigo-500/20 dark:text-indigo-300 group-hover:bg-indigo-500 group-hover:text-white transition-all shadow-inner">
                      <BookOpen className="w-8 h-8" />
                    </div>
                    <span className="text-[11px] font-black bg-indigo-500 text-white px-3 py-1 rounded-full animate-pulse shadow-md">0초 고속 입고</span>
                  </div>
                  <h3 className="font-extrabold text-lg text-gray-900 dark:text-white group-hover:text-indigo-600 dark:group-hover:text-indigo-300 transition-colors">
                    ⚡ 신품 도서 (ISBN 바코드 고속 입고)
                  </h3>
                  <p className="text-xs text-gray-500 dark:text-slate-300 mt-1.5 leading-relaxed">
                    사진 촬영 과정을 <strong>100% 스킵</strong>하고, 바코드 스캔 즉시 알라딘 도서 정보를 연동하여 <strong>0초 만에 바로 재고 입고 확정</strong>합니다.
                  </p>
                </button>

                {/* Card 2: Used / Returned Book AI Inspection */}
                <button
                  onClick={() => onSelect('USED_RETURN_INSPECTION')}
                  className="p-6 rounded-2xl bg-white dark:bg-gradient-to-br dark:from-amber-950/90 dark:via-slate-900 dark:to-slate-950 border-2 border-amber-200 dark:border-amber-500/60 hover:border-amber-500 dark:hover:border-amber-400 text-left transition-all hover:scale-[1.02] shadow-lg dark:shadow-2xl group cursor-pointer"
                >
                  <div className="flex items-center justify-between mb-3">
                    <div className="p-3.5 rounded-2xl bg-amber-50 text-amber-600 dark:bg-amber-500/20 dark:text-amber-400 group-hover:bg-amber-500 group-hover:text-slate-950 transition-all shadow-inner">
                      <Camera className="w-8 h-8" />
                    </div>
                    <span className="text-[11px] font-black bg-amber-500 text-slate-950 px-3 py-1 rounded-full shadow-md">AI 훼손 정밀 검수</span>
                  </div>
                  <h3 className="font-extrabold text-lg text-gray-900 dark:text-white group-hover:text-amber-600 dark:group-hover:text-amber-300 transition-colors">
                    🔍 중고 / 반품 도서 (AI 정밀 검수)
                  </h3>
                  <p className="text-xs text-gray-500 dark:text-slate-300 mt-1.5 leading-relaxed">
                    표지 및 속지 카메라 촬영 후 <strong>4-Agent AI 비전 파이프라인(YOLOv8)</strong>으로 훼손 등급 및 매입/반품가를 정밀 평가합니다.
                  </p>
                </button>
              </div>
            </div>
  );
}
