'use client';

import { Sparkles } from 'lucide-react';
import { Button } from '@/shared/ui/button';
import type { ReinspectionView } from '../hooks/useAiReinspection';

/** Multi-Agent AI 재검수 라이브 모달 (스테퍼·진행바·터미널 스트림). */
export function ReinspectionLiveModal({ task, onClose }: { task: ReinspectionView; onClose: () => void }) {
  return (
        <div className="fixed inset-0 z-50 bg-black/75 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-800 rounded-2xl shadow-2xl w-full max-w-4xl overflow-hidden animate-in fade-in zoom-in duration-200">
            {/* Modal Header */}
            <div className="bg-gradient-to-r from-purple-900 to-indigo-900 text-white p-5 flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="p-2.5 bg-white/10 rounded-xl backdrop-blur-md">
                  <Sparkles className="w-6 h-6 text-purple-300 animate-spin-slow" />
                </div>
                <div>
                  <h3 className="text-lg font-extrabold flex items-center gap-2">
                    Multi-Agent AI 비전 실시간 재검수 파이프라인
                  </h3>
                  <p className="text-xs text-purple-200 mt-0.5">
                    대상 LPN: <span className="font-mono font-bold text-yellow-300">{task.lpn}</span> ({task.title})
                  </p>
                </div>
              </div>
              {task.isDone && (
                <button
                  onClick={() => onClose()}
                  className="text-purple-200 hover:text-white text-xl font-bold p-1 hover:bg-white/10 rounded-lg transition-colors"
                >
                  ✕
                </button>
              )}
            </div>

            {/* Modal Body */}
            <div className="p-6 space-y-6">
              {/* Stepper Progress */}
              <div className="grid grid-cols-5 gap-2 text-center text-xs">
                {[
                  // 모델 배정은 wms-secret-backend/.claude/rules/01-freeze-zones.md가 정본.
                  // Vision 박스는 Detector(YOLO, LLM 미사용)까지 시각적으로 묶어 보여준다 -
                  // 백엔드 그래프 노드는 그대로 분리돼 있고 여기 라벨만 축약한 것.
                  { step: 1, label: "Vision 👁️", desc: "YOLO탐지+GPT-4o 판독·증거검증" },
                  // Policy는 LLM을 쓰지 않는 UBCI v2.0 매트릭스 결정론적 산식이다.
                  { step: 2, label: "Policy ⚖️", desc: "UBCI 매트릭스(결정론적)" },
                  // Stage A(정합성 게이트, LLM 미사용) 통과 + 결함 1건 이상일 때만 Stage B(GPT-4o-mini) 심사.
                  { step: 3, label: "Critic 🛡️", desc: "정합성게이트+4o-mini 심사" },
                  // HITL이 Report보다 앞이다. Supervisor가 HITL로 이관하면 그래프는
                  // human_node에서 끝나고, 보증서(Report)는 관리자 결재가 확정된 뒤에야
                  // 생성된다. 종전 순서(Report → HITL)는 실제 흐름과 반대였다.
                  { step: 4, label: "HITL 👤", desc: "관리자결재(Supervisor 이관)" },
                  { step: 5, label: "Report 📋", desc: "GPT-4o-mini 보증서생성" },
                ].map((s) => {
                  const isActive = task.step >= s.step;
                  const isCurrent = task.step === s.step;

                  return (
                    <div
                      key={s.step}
                      className={`p-3 rounded-xl border transition-all ${
                        isCurrent
                          ? "bg-purple-50 dark:bg-purple-950 border-purple-500 text-purple-700 dark:text-purple-300 font-extrabold ring-2 ring-purple-500/20"
                          : isActive
                          ? "bg-emerald-50 dark:bg-emerald-950 border-emerald-300 text-emerald-700 dark:text-emerald-300"
                          : "bg-gray-50 dark:bg-gray-800 border-gray-200 dark:border-gray-700 text-gray-400"
                      }`}
                    >
                      <div className="text-xs font-bold">{s.label}</div>
                      <div className="text-[11px] text-gray-500 dark:text-gray-400 mt-0.5">{s.desc}</div>
                    </div>
                  );
                })}
              </div>

              {/* Progress Bar */}
              <div className="w-full bg-gray-100 dark:bg-gray-800 h-2.5 rounded-full overflow-hidden">
                <div
                  className="bg-gradient-to-r from-purple-600 to-indigo-500 h-full transition-all duration-500"
                  style={{ width: `${Math.min(100, (task.step / 5) * 100)}%` }}
                />
              </div>

              {/* Live Terminal Stream */}
              <div className="bg-gray-950 text-gray-100 p-5 rounded-xl font-mono text-xs sm:text-sm space-y-3 h-64 overflow-y-auto border border-gray-800 shadow-inner">
                {task.logs.map((log, i) => (
                  <div key={i} className="leading-relaxed border-b border-gray-900/60 pb-1.5 last:border-none">
                    {log}
                  </div>
                ))}
                {!task.isDone && (
                  <div className="text-purple-400 animate-pulse flex items-center gap-1.5 mt-2">
                    <span className="w-2 h-2 rounded-full bg-purple-400" /> Multi-Agent 비전 텐서 및 룰 엔진 계산 중...
                  </div>
                )}
              </div>
            </div>

            {/* Modal Footer */}
            <div className="bg-gray-50 dark:bg-gray-800/80 px-6 py-4 flex items-center justify-between border-t border-gray-200 dark:border-gray-800">
              <span className="text-xs text-gray-500 dark:text-gray-400">
                {task.isDone
                  ? "✅ Multi-Agent 비전 재검수 완료 (PostgreSQL DB 동기화 완료)"
                  : "⏳ 비전 검수 파이프라인 가동 중..."}
              </span>
              <Button
                disabled={!task.isDone}
                onClick={() => onClose()}
                className="bg-purple-600 hover:bg-purple-700 text-white font-bold text-xs px-5 py-2 rounded-lg"
              >
                {task.isDone ? "완료 및 결과 반영" : "재검수 진행 중..."}
              </Button>
            </div>
          </div>
        </div>
  );
}
