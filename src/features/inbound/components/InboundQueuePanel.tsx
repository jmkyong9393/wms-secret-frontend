'use client';

import { AlertTriangle, CheckCircle2, Printer, RefreshCcw } from 'lucide-react';

/** 비동기 검수 큐 진행 현황 패널 (진행바·판정 배지·라벨 재출력). */
export function InboundQueuePanel({ visibleQueue, inFlightCount, finishedCount, reprintingLpn, onClearFinished, onReprint }: {
  visibleQueue: any[];
  inFlightCount: number;
  finishedCount: number;
  reprintingLpn: string | null;
  onClearFinished: () => void;
  onReprint: (lpn: string, title: string) => void;
}) {
  return (
      <div className="bg-white dark:bg-gray-900 rounded-2xl p-5 shadow-sm border border-gray-100 dark:border-gray-800 mx-2 sm:mx-0 transition-all">
        <div className="flex items-center justify-between mb-4 gap-2">
          <h3 className="font-bold text-gray-800 dark:text-gray-100 text-sm shrink-0">작업 진행 현황</h3>
          <div className="flex items-center gap-2 flex-wrap justify-end">
            {finishedCount > 0 && (
              <button
                onClick={onClearFinished}
                className="text-[11px] font-bold text-gray-500 dark:text-gray-400 hover:text-red-600 dark:hover:text-red-400 border border-gray-200 dark:border-gray-700 px-2 py-1 rounded-lg transition-colors cursor-pointer"
              >
                완료 기록 지우기 ({finishedCount})
              </button>
            )}
            <span className="bg-indigo-100 dark:bg-indigo-950 text-indigo-700 dark:text-indigo-300 text-xs font-bold px-3 py-1 rounded-full whitespace-nowrap">
              대기 {inFlightCount}건
            </span>
          </div>
        </div>

        {visibleQueue.length === 0 ? (
          <div className="py-6 flex justify-center items-center">
            <p className="text-gray-400 dark:text-gray-500 text-sm font-medium">아직 촬영된 도서가 없습니다.</p>
          </div>
        ) : (
          <div className="space-y-3">
            {visibleQueue.map(item => {
              const isInFlight = item.status === 'UPLOADING' || item.status === 'ANALYZING';
              return (
              <div
                key={item.id}
                className={`flex items-center justify-between p-3 rounded-xl border transition-all duration-500 ${
                  item.status === 'COMPLETED'
                    ? 'bg-emerald-50 dark:bg-emerald-950/40 border-emerald-100 dark:border-emerald-900'
                    : item.status === 'FAILED'
                      ? 'bg-red-50 dark:bg-red-950/40 border-red-100 dark:border-red-900'
                      : 'bg-slate-50 dark:bg-slate-800/60 border-slate-100 dark:border-slate-700'
                }`}
              >
                <div className="flex items-center space-x-3 w-1/2">
                  {isInFlight ? (
                    <RefreshCcw className="w-5 h-5 text-indigo-500 animate-spin flex-shrink-0" />
                  ) : item.status === 'FAILED' ? (
                    <AlertTriangle className="w-5 h-5 text-red-500 flex-shrink-0" />
                  ) : (
                    <CheckCircle2 className="w-5 h-5 text-emerald-500 flex-shrink-0" />
                  )}
                  <div className="truncate">
                    <p className="text-sm font-bold text-gray-800 dark:text-gray-100 truncate">{item.title}</p>
                    <p className="text-xs font-mono text-gray-500 dark:text-gray-400 truncate">{item.lpn}</p>
                  </div>
                </div>
                <div className="flex-1 flex flex-col items-end justify-center">
                  {isInFlight ? (
                    <div className="w-full max-w-[120px] text-right">
                      <div className="flex justify-between text-[10px] text-indigo-600 dark:text-indigo-300 font-bold mb-1">
                        <span className="truncate pr-1">{item.message || '대기 중...'}</span>
                        <span>{item.progress}%</span>
                      </div>
                      <div className="w-full bg-indigo-100 dark:bg-indigo-950 rounded-full h-1.5 overflow-hidden">
                        <div
                          className="bg-indigo-500 h-1.5 rounded-full transition-all duration-500 ease-out"
                          style={{ width: `${item.progress}%` }}
                        ></div>
                      </div>
                    </div>
                  ) : (
                    <div className="flex items-center gap-2">
                      <div className="flex flex-col items-end">
                        <span className={`text-xs font-bold px-2 py-1 rounded shadow-sm whitespace-nowrap ${
                          item.status === 'FAILED'
                            ? 'text-red-700 dark:text-red-300 bg-red-200 dark:bg-red-900'
                            : 'text-emerald-700 dark:text-emerald-300 bg-emerald-200 dark:bg-emerald-900'
                        }`}>
                          {item.status === 'FAILED' ? '실패' : item.grade}
                        </span>
                        {item.message && <span className="text-[10px] text-gray-500 dark:text-gray-400 mt-1 text-right max-w-[120px] truncate" title={item.message}>{item.message}</span>}
                      </div>
                      <button
                        onClick={() => onReprint(item.lpn, item.title)}
                        disabled={reprintingLpn === item.lpn}
                        title="LPN 라벨 재출력"
                        className="shrink-0 p-2 rounded-lg border border-gray-200 dark:border-gray-700 text-gray-500 dark:text-gray-400 hover:text-indigo-600 dark:hover:text-indigo-400 hover:border-indigo-300 disabled:opacity-40 transition-colors cursor-pointer"
                      >
                        {reprintingLpn === item.lpn
                          ? <RefreshCcw className="w-4 h-4 animate-spin" />
                          : <Printer className="w-4 h-4" />}
                      </button>
                    </div>
                  )}
                </div>
              </div>
              );
            })}
          </div>
        )}
      </div>
  );
}
