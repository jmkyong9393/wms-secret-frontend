'use client';

import { Bot } from 'lucide-react';
import { Button } from '@/shared/ui/button';
import type { PipelineLogEntry } from '../hooks/useAiReinspection';

/** Multi-Agent 파이프라인 실시간 처리 로그 하단 패널. */
export function PipelineLogPanel({ logs, onClear }: { logs: PipelineLogEntry[]; onClear: () => void }) {
  return (
      <div className="bg-white dark:bg-gray-900 p-6 rounded-2xl border border-gray-200 dark:border-gray-800 shadow-xs space-y-4">
        <div className="flex items-center justify-between border-b border-gray-100 dark:border-gray-800 pb-3">
          <div className="flex items-center gap-2">
            <div className="p-2 bg-purple-50 dark:bg-purple-950 rounded-lg text-purple-600 dark:text-purple-400">
              <Bot className="w-5 h-5" />
            </div>
            <div>
              <h3 className="text-base font-bold text-gray-900 dark:text-white flex items-center gap-2">
                Multi-Agent 파이프라인 실시간 처리 로그
                <span className="inline-flex items-center px-2 py-0.5 rounded text-[10px] font-bold bg-green-100 dark:bg-green-950 text-green-700 dark:text-green-300 border border-green-200 dark:border-green-800">
                  <span className="w-1.5 h-1.5 rounded-full bg-green-500 mr-1 animate-pulse" /> Live Stream
                </span>
              </h3>
              <p className="text-xs text-gray-500 dark:text-gray-400">
                Detector(YOLO) ➔ Vision(GPT-4o) ➔ Policy ➔ Critic ➔ Supervisor ➔ Report ➔ Human Node(HITL)
              </p>
            </div>
          </div>
          <Button size="xs" variant="ghost" className="text-xs text-gray-400 hover:text-gray-600 cursor-pointer hover:bg-gray-100 dark:hover:bg-gray-800" onClick={onClear}>
            로그 초기화
          </Button>
        </div>

        {/* 재고 상세의 파이프라인 진단 기록과 동일한 라이트/다크 겸용 로그 패널 스타일 */}
        <div className="bg-gray-50/70 dark:bg-gray-800/60 text-gray-700 dark:text-gray-200 p-4 rounded-xl text-xs space-y-2 max-h-48 overflow-y-auto border border-gray-200 dark:border-gray-700">
          {logs.length === 0 ? (
            <div className="text-gray-400 dark:text-gray-500 italic text-center py-4">대기 중인 Multi-Agent 로그가 없습니다. [AI 재검수] 실행 시 실시간 스트리밍됩니다.</div>
          ) : (
            logs.map((log, idx) => (
              <div key={idx} className="flex items-start gap-3 py-1 border-b border-gray-200/70 dark:border-gray-700/60 last:border-0">
                <span className="text-gray-400 dark:text-gray-500 font-mono text-[11px] min-w-[65px]">[{log.time}]</span>
                <span className="font-bold text-purple-700 dark:text-purple-400 min-w-[120px]">{log.agent}</span>
                <span className={`flex-1 leading-relaxed ${log.type === "success" ? "text-emerald-700 dark:text-emerald-400" : log.type === "warning" ? "text-amber-700 dark:text-amber-300" : "text-gray-700 dark:text-gray-300"}`}>
                  {log.text}
                </span>
              </div>
            ))
          )}
        </div>
      </div>
  );
}
