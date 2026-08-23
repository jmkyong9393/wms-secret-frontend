'use client';

// LangGraph 파이프라인 진단 기록 패널 - 노드별 실행 여부·서술·시각과
// HITL 재검증(BBox 편집 후 2차) 타임라인을 렌더한다.
import React from 'react';
import { Bot } from 'lucide-react';

/**
 * LangGraph 파이프라인 노드 표시 정의. executed_agents에 없으면 SKIPPED로 렌더한다.
 *
 * Detector(YOLO) ➔ Vision(GPT-4o) ➔ Policy ➔ Critic ➔ Supervisor ➔ Report
 * (MINT Fast-track 분기와 Auto-Refund 노드는 구조 개편으로 제거됨 -
 *  검증을 건너뛰고 자동 매입이 확정되던 경로였다. 이제 전 건이 동일 경로를 통과한다.)
 */
const PIPELINE_STEPS = [
  { node: 'detector_node', label: 'Detector (YOLO)', icon: '🔬', logKey: 'detector_text', tone: 'text-gray-700 dark:text-gray-300' },
  { node: 'vision_agent', label: 'Vision Agent', icon: '👁️', logKey: 'vision_text', tone: 'text-gray-700 dark:text-gray-300' },
  { node: 'policy_agent', label: 'Policy Agent', icon: '📜', logKey: 'policy_text', tone: 'text-amber-700 dark:text-amber-300' },
  { node: 'critic_agent', label: 'Critic Agent', icon: '🛡️', logKey: 'critic_text', tone: 'text-emerald-700 dark:text-emerald-400' },
  { node: 'supervisor', label: 'Supervisor', icon: '🧭', logKey: 'supervisor_rationale', tone: 'text-sky-700 dark:text-sky-300' },
  { node: 'report_agent', label: 'Report Agent', icon: '💬', logKey: 'report_text', tone: 'text-emerald-700 dark:text-emerald-400' },
] as const;

interface PipelineTracePanelProps {
  /** return_jobs.agent_logs - 노드 서술·실행 목록·재검증 기록이 담긴다 */
  logs: any;
  /** 검수 일시 문자열 ("YYYY-MM-DD HH:MM:SS") - 타임라인 기본 시각 */
  inspectionDate?: string;
}

export function PipelineTracePanel({ logs, inspectionDate }: PipelineTracePanelProps) {
  const executedAgents: string[] = logs.executed_agents || [];
  const inspectionTime = inspectionDate ? inspectionDate.split(' ')[1] : 'KST';
  const reportGeneratedAt: string | null = logs.report_generated_at || null;
  const stepTime = (node: string) =>
    node === 'report_agent' && reportGeneratedAt && executedAgents.includes('report_agent')
      ? reportGeneratedAt.split(' ')[1] || reportGeneratedAt
      : inspectionTime;

  return (
    <>
            {/*
              Multi-Agent Pipeline Trace
              페이지에서 이 섹션만 다크 터미널(bg-gray-950) 고정이라
              라이트 모드에서 붕 떠 보였다. 주변과 동일한 화이트 카드 + dark: 변형으로 통일.
            */}
            <div className="bg-white dark:bg-gray-900 rounded-2xl border border-gray-200 dark:border-gray-800 shadow-xs p-6 space-y-4 transition-colors">
              <div className="flex items-center justify-between border-b border-gray-100 dark:border-gray-800 pb-3 gap-3 flex-wrap">
                <div className="flex items-center gap-2">
                  <div className="p-2 bg-purple-50 dark:bg-purple-950 rounded-lg text-purple-600 dark:text-purple-400">
                    <Bot className="w-5 h-5" />
                  </div>
                  <div>
                    <h3 className="text-base font-bold text-gray-900 dark:text-white flex items-center gap-2 flex-wrap">
                      LangGraph Multi-Agent 파이프라인 진단 기록
                      {/*
                        [수정 이력] 예전에는 DB에 없는 값을 프론트에서 지어내면서
                        "PostgreSQL DB Verified" 뱃지를 붙였다. 실제로 DB에 Agent 서술이
                        저장된 경우에만 검증 뱃지를 표시한다.
                      */}
                      {executedAgents.length > 0 ? (
                        <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-emerald-50 dark:bg-emerald-950 text-emerald-700 dark:text-emerald-300 border border-emerald-200 dark:border-emerald-800">
                          PostgreSQL DB Verified
                        </span>
                      ) : (
                        <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-amber-50 dark:bg-amber-950 text-amber-700 dark:text-amber-300 border border-amber-200 dark:border-amber-800">
                          로그 미기록 (재검수 필요)
                        </span>
                      )}
                    </h3>
                    <p className="text-xs text-gray-500 dark:text-gray-400">
                      Detector(YOLO) ➔ Vision(GPT-4o) ➔ Policy ➔ Critic ➔ Supervisor ➔ Report
                      {(logs.retry_count ?? 0) > 0 && (
                        <span className="text-amber-600 dark:text-amber-400 font-bold"> · 재검수 {logs.retry_count}회</span>
                      )}
                      {logs.auto_refund_eligible && (
                        <span className="text-emerald-600 dark:text-emerald-400 font-bold"> · ⚡ MINT 자동 매입 승인</span>
                      )}
                    </p>
                  </div>
                </div>
              </div>

              {executedAgents.length === 0 ? (
                <div className="bg-amber-50/60 dark:bg-amber-950/40 p-4 rounded-xl border border-amber-200 dark:border-amber-800 text-xs text-amber-900 dark:text-amber-200 leading-relaxed">
                  이 건에는 저장된 Agent 실행 기록이 없습니다. 파이프라인 로그 영속화 이전에 검수된
                  건이므로, 상단의 <span className="text-rose-600 dark:text-rose-300 font-bold">AI 재검수 요청</span>을 실행하면
                  각 Agent의 실제 판정 근거가 DB에 기록됩니다.
                </div>
              ) : (
                <div className="bg-gray-50/70 dark:bg-gray-800/60 p-4 rounded-xl text-xs space-y-2.5 border border-gray-200 dark:border-gray-700">
                  {PIPELINE_STEPS.map((step) => {
                    const ran = executedAgents.includes(step.node);
                    const text = ran ? logs[step.logKey] : null;
                    // [2026-08-06 모바일 대응] 종전에는 시각(min-w-65px) + 노드명(min-w-150px) +
                    // 서술을 한 줄 flex로 배치했다. 좁은 화면에서는 앞 두 칸이 215px를 먼저
                    // 점유해 서술 칸이 한 글자 폭까지 짜부라졌고, 긴 한국어 문장이 세로로
                    // 한 자씩 흘러내렸다(실측). 모바일은 세로 스택, sm 이상에서만 가로 정렬한다.
                    // min-w-0을 주지 않으면 flex 자식이 콘텐츠 최소폭 아래로 줄지 않아 여전히 넘친다.
                    return (
                      <div key={step.node} className="flex flex-col sm:flex-row sm:items-start gap-1 sm:gap-3 py-1.5 border-b border-gray-200/70 dark:border-gray-700/60 last:border-0">
                        <div className="flex items-center gap-2 shrink-0">
                          <span className="text-gray-400 dark:text-gray-500 font-mono text-[11px] sm:min-w-[65px]">[{stepTime(step.node)}]</span>
                          <span className={`font-bold sm:min-w-[150px] ${ran ? 'text-purple-700 dark:text-purple-400' : 'text-gray-400 dark:text-gray-600'}`}>
                            {step.label} {step.icon}
                          </span>
                        </div>
                        {ran ? (
                          <span className={`leading-relaxed min-w-0 break-words ${step.tone}`}>{text || '(서술 미기록)'}</span>
                        ) : (
                          // HITL로 조기 종료된 건은 Report Agent에 도달하지 않는다.
                          <span className="text-gray-400 dark:text-gray-600 italic min-w-0 break-words">
                            미실행 — 이 건은 해당 단계에 도달하지 않았습니다 (HITL 이관 또는 조기 종료)
                          </span>
                        )}
                      </div>
                    );
                  })}
                </div>
              )}

              {/*
                [2026-08-09 신설] 1차 파이프라인 판독과 HITL 재검증을 같은 타임라인에 섞으면
                안 된다 - policy_text를 재산정 결과로 덮어쓰면 1차 판독 근거가 사라진다.
                logs.hitl_revalidation은 별도 필드라 여기 독립 섹션으로만 존재하며,
                BBox 편집이 있었던 건에만 생긴다(편집 없는 단순 승인은 재검증 자체가 없음).
              */}
              {logs.hitl_revalidation && (
                <div className="bg-sky-50/70 dark:bg-sky-950/30 p-4 rounded-xl text-xs space-y-2.5 border border-sky-200 dark:border-sky-800">
                  <div className="flex items-center gap-2 font-bold text-sky-800 dark:text-sky-300">
                    <span>🧑‍⚖️ HITL 재검증 (BBox 편집 후 2차)</span>
                    <span className="font-mono text-[10px] text-sky-600 dark:text-sky-400">
                      {logs.hitl_revalidation.revalidated_at?.split('T')[1]?.slice(0, 8) || ''} · {logs.hitl_revalidation.revalidated_by}
                    </span>
                  </div>
                  <div className="flex flex-col sm:flex-row sm:items-start gap-1 sm:gap-3 py-1 border-b border-sky-200/70 dark:border-sky-800/60">
                    <span className="font-bold sm:min-w-[150px] text-amber-700 dark:text-amber-300">Policy Agent 📜</span>
                    <span className="leading-relaxed min-w-0 break-words text-amber-700 dark:text-amber-300">
                      {logs.hitl_revalidation.policy_text
                        ? `${logs.hitl_revalidation.policy_text} (재산정 ${logs.hitl_revalidation.policy_score}점)`
                        : logs.hitl_revalidation.policy_error
                          ? `재산정 실패: ${logs.hitl_revalidation.policy_error}`
                          : '(서술 미기록)'}
                    </span>
                  </div>
                  <div className="flex flex-col sm:flex-row sm:items-start gap-1 sm:gap-3 py-1">
                    <span className="font-bold sm:min-w-[150px] text-emerald-700 dark:text-emerald-400">Critic Stage A 🛡️</span>
                    {logs.hitl_revalidation.critic_stage_a_passed === true ? (
                      <span className="leading-relaxed min-w-0 break-words text-emerald-700 dark:text-emerald-400">
                        정합성 대조 통과 - 결함 수·감점·BBox·image_index 모순 없음
                      </span>
                    ) : logs.hitl_revalidation.critic_stage_a_passed === false ? (
                      <span className="leading-relaxed min-w-0 break-words text-rose-700 dark:text-rose-400">
                        정합성 위반 감지: {(logs.hitl_revalidation.critic_stage_a_issues || []).join(' / ')}
                      </span>
                    ) : (
                      <span className="leading-relaxed min-w-0 break-words text-gray-500 dark:text-gray-400">
                        재검증 실패: {logs.hitl_revalidation.critic_stage_a_error}
                      </span>
                    )}
                  </div>
                </div>
              )}
            </div>
    </>
  );
}
