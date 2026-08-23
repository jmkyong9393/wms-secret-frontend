import { useEffect, useState } from 'react';
import { adminAPI } from '@/shared/api/api';
import type { HitlTask } from '../types/hitl';

export interface ReinspectionView {
  id: string;
  lpn: string;
  title: string;
  step: number;
  logs: string[];
  isDone: boolean;
  error?: string;
}

export interface PipelineLogEntry { time: string; agent: string; text: string; type: string }

/**
 * AI 재검수 트리거·결과 폴링·라이브 로그 상태.
 * 완료 판정은 트리거 전 스냅샷 대비 policy_text/report_text 변화로만 한다
 * (agent_logs 전체 비교는 hitl_locked 기록만으로 완료 오판 - 90번 아카이브 참조).
 */
export function useAiReinspection(opts: {
  getTask: (jobId: string) => HitlTask | undefined;
  onCompleted: () => void | Promise<void>;
}) {
  const [reinspectingIds, setReinspectingIds] = useState<Set<string>>(new Set());
  const [activeReinspectionTask, setActiveReinspectionTask] = useState<{
    id: string;
    lpn: string;
    title: string;
    step: number;
    logs: string[];
    isDone: boolean;
    error?: string;
  } | null>(null);

  // 로그 패널은 실제 파이프라인 노드 명칭(Detector→Vision→Policy→Critic→Supervisor→Report)
  // 기준. 구 명칭("Explainer Agent") 저장 키는 마운트 시 청소한다.
  const [pipelineLogs, setPipelineLogs] = useState<PipelineLogEntry[]>([]);
  const [isMounted, setIsMounted] = useState(false);

  useEffect(() => {
    setIsMounted(true);
    if (typeof window !== "undefined") {
      localStorage.removeItem("hitl_explainer_logs");
      const saved = localStorage.getItem("hitl_pipeline_logs");
      if (saved) {
        try {
          setPipelineLogs(JSON.parse(saved));
        } catch (e) {}
      }
    }
  }, []);

  useEffect(() => {
    if (isMounted && typeof window !== "undefined") {
      localStorage.setItem("hitl_pipeline_logs", JSON.stringify(pipelineLogs));
    }
  }, [pipelineLogs, isMounted]);

  const handleClearLogs = () => {
    setPipelineLogs([]);
    if (typeof window !== "undefined") {
      localStorage.removeItem("hitl_pipeline_logs");
    }
  };

  const handleTriggerAiReinspect = async (jobId: string) => {
    const targetTask = opts.getTask(jobId) as any;
    const lpnStr = targetTask?.agent_logs?.lpn_barcode || targetTask?.lpn_barcode || "LPN 미발급";
    const titleStr = targetTask?.book_title || "수동 검수 요청 도서";

    setReinspectingIds((prev) => new Set(prev).add(jobId));
    setActiveReinspectionTask({
      id: jobId,
      lpn: lpnStr,
      title: titleStr,
      step: 1,
      logs: [
        // 이 시점에 확실한 사실은 "요청을 보냈다"뿐이다. 워커가 아직 작업을 집지도
        // 않았는데 "Detector 추론 중"이라고 쓰면 화면이 없는 사실을 말하게 된다.
        // 실제 단계별 서술은 파이프라인이 끝난 뒤 agent_logs에서 가져온다.
        `[${new Date().toLocaleTimeString()}] 재검수 요청 전송...`,
      ],
      isDone: false,
    });

    try {
      // 재검수는 Celery 비동기다. 큐 등록 응답에는 판독 결과가 없으므로(십수 초 뒤 완료),
      // 등록 직후에는 "진행 중"만 보여주고 **실제 결과가 DB에 반영되면 그때 렌더**한다.
      //
      // 완료 판정은 트리거 전 스냅샷 대비 policy_text/report_text 두 필드의 변화로만 한다.
      // agent_logs 전체 비교는 큐잉 직전 hitl_locked 기록만으로도 '완료'로 오판한다.
      // (경위: 90_코드_변경이력_설계배경_아카이브)
      const t = () => new Date().toLocaleTimeString();
      const baseline = await adminAPI.getInspectionResult(jobId).catch(() => null);
      const baselinePolicyText = baseline?.agent_logs?.policy_text;
      const baselineReportText = baseline?.agent_logs?.report_text;
      await adminAPI.triggerAiReinspection(jobId);

      setActiveReinspectionTask((prev) =>
        prev && prev.id === jobId
          ? { ...prev, step: 2, logs: [...prev.logs, `[${t()}] ⏳ 큐 등록 완료 - 파이프라인 실행을 기다리는 중...`] }
          : prev
      );

      // --- 결과 폴링 ---
      const POLL_MS = 2000;
      const MAX_WAIT_MS = 120000;
      const startedAt = Date.now();
      let result: Awaited<ReturnType<typeof adminAPI.getInspectionResult>> | null = null;

      while (Date.now() - startedAt < MAX_WAIT_MS) {
        await new Promise((r) => setTimeout(r, POLL_MS));
        try {
          const cur = await adminAPI.getInspectionResult(jobId);
          const lg = (cur?.agent_logs || {}) as Record<string, string | undefined>;
          // 재검수가 끝나면 Policy/Report 서술이 채워진다. 단, 그 값이 트리거 전 기준선과
          // 완전히 같으면(=옛 시도의 잔여 텍스트) 새 실행이 아직 반영 안 된 것이므로 기다린다.
          const changed = lg.policy_text !== baselinePolicyText || lg.report_text !== baselineReportText;
          if ((lg.policy_text || lg.report_text) && changed) {
            result = cur;
            break;
          }
        } catch {
          // 일시적 조회 실패는 무시하고 다음 주기에 재시도한다.
        }
      }

      if (!result) {
        setActiveReinspectionTask((prev) =>
          prev && prev.id === jobId
            ? {
                ...prev,
                isDone: true,
                logs: [...prev.logs, `[${t()}] ⚠️ 제한 시간(2분) 내에 결과가 반영되지 않았습니다. 목록을 새로고침해 확인하세요.`],
              }
            : prev
        );
        return;
      }

      const logs = (result.agent_logs || {}) as Record<string, string | undefined>;
      const score = result.ubci_score;
      const scoreStr = typeof score === "number" ? `UBCI ${score}점` : "UBCI 점수 보류";
      // 실제 서술만 싣는다. 없는 단계는 줄 자체를 만들지 않는다 - 문구를 지어내지 않기 위해서다.
      const realLines: Array<[string, string | undefined]> = [
        ["🔬 [Detector]", logs.detector_text],
        ["👁️ [Vision Agent]", logs.vision_text],
        ["⚖️ [Policy Agent]", logs.policy_text],
        ["🛡️ [Critic Agent]", logs.critic_text],
        ["🧭 [Supervisor]", logs.supervisor_rationale],
        ["💬 [Report Agent]", logs.report_text],
      ];
      const summaryMsg = logs.report_text || logs.policy_text || scoreStr;

      setActiveReinspectionTask((prev) =>
        prev && prev.id === jobId
          ? {
              ...prev,
              step: 5,
              isDone: true,
              logs: [
                ...prev.logs,
                `[${t()}] ✅ 파이프라인 완료 - ${scoreStr}`,
                ...realLines.filter(([, v]) => v && v.trim()).map(([tag, v]) => `[${t()}] ${tag} ${v}`),
              ],
            }
          : prev
      );

      const timeNow = t();
      setPipelineLogs((prev) => [
        {
          time: timeNow,
          agent: "Report Agent 💬",
          text: `[${lpnStr}] DB 연산 결과: "${summaryMsg}" DB 반영 완료!`,
          type: "success",
        },
        ...prev,
      ]);

      await opts.onCompleted();
    } catch (err: any) {
      console.error("AI Re-inspection failed:", err);
      setActiveReinspectionTask((prev) =>
        prev
          ? {
              ...prev,
              isDone: true,
              error: err?.message || "서버 통신 실패",
              logs: [...prev.logs, `[${new Date().toLocaleTimeString()}] ❌ 재검수 오류: ${err?.message || "서버 오류"}`],
            }
          : null
      );
    } finally {
      setReinspectingIds((prev) => {
        const next = new Set(prev);
        next.delete(jobId);
        return next;
      });
    }
  };

  const appendPipelineLog = (entry: PipelineLogEntry) => setPipelineLogs((prev) => [entry, ...prev]);

  return {
    reinspectingIds,
    appendPipelineLog,
    activeReinspectionTask,
    closeReinspection: () => setActiveReinspectionTask(null),
    pipelineLogs,
    handleClearLogs,
    handleTriggerAiReinspect,
  };
}
