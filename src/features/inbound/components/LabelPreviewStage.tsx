'use client';

import type { BookMeta } from '../types';
import { Zap } from 'lucide-react';
import { LpnPrintLabel } from '@/entities/label/ui/LpnPrintLabel';

/** 검열지 출력 단계 무대 - 신품 안내 카드 또는 라벨 프린터 목업+라벨 렌더. */
export function LabelPreviewStage({ inboundType, isbn, currentLpn, bookInfo, workerLabel }: {
  inboundType: 'NEW_FASTTRACK' | 'USED_RETURN_INSPECTION';
  isbn: string;
  currentLpn: string;
  bookInfo: BookMeta | null;
  workerLabel: string;
}) {
  return (
          <div className="relative z-10 flex flex-col items-center">
            {inboundType === 'NEW_FASTTRACK' ? (
              <div className="bg-white/95 dark:bg-slate-900/80 backdrop-blur-xl border border-indigo-200 dark:border-indigo-500/30 p-8 rounded-3xl text-center space-y-4 shadow-xl dark:shadow-2xl max-w-md animate-in zoom-in-95 duration-200">
                <div className="w-16 h-16 bg-gradient-to-tr from-indigo-600 to-purple-500 text-white rounded-2xl flex items-center justify-center mx-auto shadow-lg shadow-indigo-500/30 transform hover:scale-105 transition-transform">
                  <Zap className="w-9 h-9 text-yellow-300 fill-yellow-300 animate-pulse" />
                </div>
                <div className="space-y-1">
                  <h3 className="text-xl font-black text-gray-900 dark:text-white tracking-tight">⚡ 신품 도서 Fast-track 입고</h3>
                  <p className="text-xs text-gray-600 dark:text-slate-300 leading-relaxed font-medium">
                    사진 촬영 및 개별 LPN 발급을 <strong className="text-emerald-600 dark:text-emerald-400">100% 생략</strong>하고<br/>수량 확인 후 즉시 재고로 편입됩니다.
                  </p>
                </div>
                <div className="inline-flex items-center gap-2 bg-indigo-50 dark:bg-indigo-950/80 border border-indigo-200 dark:border-indigo-500/40 px-4 py-1.5 rounded-full text-xs font-mono font-bold text-indigo-700 dark:text-indigo-200 shadow-inner">
                  <span className="w-2 h-2 rounded-full bg-emerald-500 animate-ping"></span>
                  <span>ISBN: {isbn}</span>
                </div>
              </div>
            ) : (
              <>
                <div className="w-48 h-12 bg-slate-200 dark:bg-slate-800 border-b-4 border-slate-300 dark:border-slate-700 rounded-t-xl z-20 flex items-center justify-center mb-1">
                  <span className="text-slate-600 dark:text-slate-400 text-xs font-bold">라벨 프린터 (연동됨)</span>
                </div>
                {/* 50x31mm(가로형) 라벨 렌더링 */}
                <div className="relative z-10 animate-print shadow-2xl bg-white border border-gray-300 transform scale-[1.7] origin-top mb-20 mt-4 rounded-sm">
                  <LpnPrintLabel data={{
                    lpn_barcode: currentLpn,
                    book: {
                      title: bookInfo?.title || '미등록 도서',
                      author: bookInfo?.author || '-',
                      isbn: isbn || '-'
                    },
                    worker_id: workerLabel
                  }} />
                </div>
              </>
            )}
          </div>
  );
}
