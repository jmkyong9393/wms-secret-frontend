"use client";

import React, { useEffect, useState, useRef, useMemo } from "react";
import {
  RefreshCw,
  CheckCircle2,
  AlertTriangle,
  Search,
  Shield as ShieldIcon,
} from "lucide-react";
import { adminAPI } from "@/shared/api/api";
import { getSystemSettings, SETTINGS_CHANGE_EVENT } from "@/shared/lib/systemSettings";
import type { HitlTask, HitlOverrideRequest } from "@/features/hitl/types/hitl";
import { HitlImageModal, EMPTY_BBOX_EDITS, type BBoxEdits } from "@/features/hitl/components/HitlImageModal";
// 관리자 설정의 읽기 전용 정책 뷰와 같은 정의를 쓴다 (features/hitl/policy.ts)
import { gradeFromUbciScore, defaultDecisionForGrade } from "@/features/hitl/policy";
import { formatQueuedAt, getPrimaryDefectReason } from "@/features/hitl/utils";
import { useAiReinspection } from "@/features/hitl/hooks/useAiReinspection";
import { PipelineLogPanel } from "@/features/hitl/components/PipelineLogPanel";
import { ReinspectionLiveModal } from "@/features/hitl/components/ReinspectionLiveModal";
import { HitlSummaryCards } from "@/features/hitl/components/HitlSummaryCards";
import { HitlPolicyGuide } from "@/features/hitl/components/HitlPolicyGuide";
import { MasterBulkToolbar, type MasterBulkValues } from "@/features/hitl/components/MasterBulkToolbar";
import { HitlTaskTable } from "@/features/hitl/components/HitlTaskTable";

export default function AdminHitlDashboard() {
  const [tasks, setTasks] = useState<HitlTask[]>([]);

  const {
    reinspectingIds,
    appendPipelineLog,
    activeReinspectionTask,
    closeReinspection,
    pipelineLogs,
    handleClearLogs,
    handleTriggerAiReinspect,
  } = useAiReinspection({
    getTask: (jobId) => tasks.find((t) => t.id === jobId),
    onCompleted: () => fetchTasks(),
  });
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());

  // 시스템 설정의 HITL 대기열 경보 임계값 (설정 페이지에서 변경 시 실시간 반영)
  const [alertThreshold, setAlertThreshold] = useState<number>(10);
  useEffect(() => {
    setAlertThreshold(getSystemSettings().hitlAlertThreshold);
    const onSettingsChange = (e: Event) => {
      const evt = e as CustomEvent<{ hitlAlertThreshold?: number }>;
      if (evt.detail && Number.isFinite(evt.detail.hitlAlertThreshold)) {
        setAlertThreshold(evt.detail.hitlAlertThreshold as number);
      }
    };
    window.addEventListener(SETTINGS_CHANGE_EVENT, onSettingsChange);
    return () => window.removeEventListener(SETTINGS_CHANGE_EVENT, onSettingsChange);
  }, []);
  const [loading, setLoading] = useState(true);
  const [keyword, setKeyword] = useState("");
  const [modalTask, setModalTask] = useState<HitlTask | null>(null);
  // 결재 건별 BBox 채택/제외. 모달을 닫아도 유지되어야 제출까지 이어진다.
  const [bboxEdits, setBboxEdits] = useState<Record<string, BBoxEdits>>({});
  const [approvalToast, setApprovalToast] = useState<string | null>(null);

  // 각 row별 선택 및 설정 상태
  const [decisions, setDecisions] = useState<Record<string, string>>({});
  const [grades, setGrades] = useState<Record<string, string>>({});
  const [reasons, setReasons] = useState<Record<string, string>>({});
  const [comments, setComments] = useState<Record<string, string>>({});

  const pageEnterTime = useRef(Date.now());

  const fetchTasks = async () => {
    setLoading(true);
    try {
      const data = await adminAPI.getPendingHitlTasks();
      const list = data || [];
      // 재검수를 누르면 백엔드가 status를 PENDING으로 바꿔 큐에 넣는다. 이 목록은
      // HITL_REQUIRED만 조회하므로 그 사이 해당 도서가 목록에서 통째로 사라졌다가
      // 파이프라인이 끝나면 다시 나타난다 - 결재자에게는 "누르니까 사라졌다"로 보인다.
      // 데이터가 늦게 오는 문제가 아니라서 새로고침으로는 해결되지 않는다(오히려 더 빨리
      // 사라진다). 재검수 중인 건은 직전 목록의 행을 그대로 붙잡아 둔다.
      setTasks((prev) => {
        if (reinspectingIds.size === 0) return list;
        const returned = new Set(list.map((t: HitlTask) => t.id));
        const pinned = prev.filter((t) => reinspectingIds.has(t.id) && !returned.has(t.id));
        return pinned.length > 0 ? [...pinned, ...list] : list;
      });

      // 개별 라우별 initial state 미리 매핑
      const initDecisions: Record<string, string> = {};
      const initGrades: Record<string, string> = {};
      const initReasons: Record<string, string> = {};
      const initComments: Record<string, string> = {};

      list.forEach((t: HitlTask) => {
        // AI가 이미 산출한 UBCI 점수(t.ubci_score)를 등급 경계에 대입해
        // 처분/목표등급 기본값을 추천한다. suggested_grade/suggested_decision이 있으면
        // (파이프라인이 명시적으로 내려준 값) 그쪽을 우선한다.
        const scoreGrade = gradeFromUbciScore(t.ubci_score);
        const recommendedGrade = t.agent_logs?.suggested_grade || scoreGrade || "NORMAL";
        initDecisions[t.id] =
          t.agent_logs?.suggested_decision || defaultDecisionForGrade(recommendedGrade);
        initGrades[t.id] = recommendedGrade;
        // 실제로 검증된 결함(agent_logs.defects) 중 감점 비중이 가장 큰 유형을 사유
        // 기본값으로 쓴다("AI 비전 감지 사유" 컬럼과 동일 소스 - §하단 렌더링 참조).
        // defects가 빈 건(NO_VALID_IMAGE_HITL 등)은 결함 코드를 기본 선택하지 않는다 —
        // 기본값이 있으면 검수자가 안 고치고 제출할 위험이 있어 빈 값으로 둔다.
        initReasons[t.id] = getPrimaryDefectReason(t) || "";
        // 회수 사유/직전 결재 코멘트는 서버의 human_issue_notes를 그대로 쓴다.
        // 메모가 없으면 빈 칸 — 제출 시 폴백 문구는 handleSubmit이 따로 갖는다.
        initComments[t.id] = t.human_issue_notes || "";
      });

      setDecisions(initDecisions);
      setGrades(initGrades);
      setReasons(initReasons);
      setComments(initComments);
    } catch (err: any) {
      // 401(세션 만료) 처리는 apiClient의 전역 response 인터셉터(lib/api-client.ts)가
      // 이미 담당한다 - 여기서 중복으로 리다이렉트하지 않는다.
      console.error("Failed to fetch HITL tasks:", err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchTasks();
  }, []);

  // 검색어 필터링
  // PENDING = AI 파이프라인이 아직 도는 중(판정 전). 결재 대상(HITL_REQUIRED)이 아니므로
  // 결재 목록에 섞지 않는다. 섞으면 "판정 정보 없음" 행이 결재 대기처럼 보여, 워커 장애로
  // 검수가 멈춘 것을 HITL 이관으로 오인하게 된다.
  const inFlightTasks = useMemo(
    () => tasks.filter((t) => t.status === 'PENDING'),
    [tasks],
  );

  const filteredTasks = useMemo(() => {
    const decidable = tasks.filter((t) => t.status !== 'PENDING');
    if (!keyword.trim()) return decidable;
    const kw = keyword.trim().toLowerCase();
    return decidable.filter(
      (t) =>
        (t.book_title && t.book_title.toLowerCase().includes(kw)) ||
        (t.isbn && t.isbn.includes(kw)) ||
        (t.id && t.id.toLowerCase().includes(kw)) ||
        (t.agent_logs?.lpn_barcode && String(t.agent_logs.lpn_barcode).toLowerCase().includes(kw))
    );
  }, [tasks, keyword]);

  // 체크박스 제어
  const toggleSelect = (id: string) => {
    const next = new Set(selectedIds);
    if (next.has(id)) {
      next.delete(id);
    } else {
      next.add(id);
    }
    setSelectedIds(next);
  };

  const toggleAll = () => {
    if (selectedIds.size === filteredTasks.length && filteredTasks.length > 0) {
      setSelectedIds(new Set());
    } else {
      setSelectedIds(new Set(filteredTasks.map((t) => t.id)));
    }
  };

  // 마스터 설정값을 선택된 항목들에 [폼에 세팅] 버튼 클릭 시 수동 반영
  const handleApplyMasterSettings = (values: MasterBulkValues) => {
    if (selectedIds.size === 0) {
      alert("일괄 세팅할 항목의 체크박스를 먼저 선택해 주세요.");
      return;
    }
    const nextDecisions = { ...decisions };
    const nextGrades = { ...grades };
    const nextReasons = { ...reasons } as Record<string, any>;

    selectedIds.forEach((id) => {
      nextDecisions[id] = values.decision;
      nextGrades[id] = values.grade;
      nextReasons[id] = values.reasons.length > 0 ? values.reasons.join(", ") : "";
    });

    setDecisions(nextDecisions);
    setGrades(nextGrades);
    setReasons(nextReasons);
  };

  // 개별/일괄 승인 제출 (테이블에 설정된 실제 row 데이터 최종 제출)
  const handleSubmit = async () => {
    if (selectedIds.size === 0) {
      alert("최종 처리할 항목을 하나 이상 선택해 주세요.");
      return;
    }

    const payloadList: HitlOverrideRequest[] = [];
    for (const id of Array.from(selectedIds)) {
      const task = tasks.find((t) => t.id === id);
      if (!task) continue;

      const decision = decisions[id] || "APPROVE_DOWNGRADE";
      const targetGrade = grades[id] || "NORMAL";
      const rawReason = reasons[id];
      const reasonList: string[] = Array.isArray(rawReason)
        ? (rawReason as any)
        : (rawReason ? [rawReason as any] : []);
      const primaryReasonCode = reasonList.join(",");
      const comment = comments[id] || "관리자 HITL 최종 결재 승인";

      payloadList.push({
        ticketId: id,
        decision,
        targetGrade: decision === "REJECT_RETURN" || decision === "RE_CHECK" ? "REJECT" : targetGrade,
        primaryReasonCode,
        reasonComment: comment,
        defectCoordinates: task.agent_logs?.defect_coordinates || [],
        // 건당 검토 시간 = 페이지 체류시간 ÷ 배치 건수. 전 건에 체류시간을 그대로 실으면
        // FDS R1(블라인드 결재)이 보는 값이 배치 크기만큼 부풀어 탐지가 무력화된다.
        reviewDurationMs: Math.max(
          1,
          Math.floor((Date.now() - pageEnterTime.current) / Math.max(1, selectedIds.size)),
        ),
        // 검수자가 고친 판정. 백엔드가 이 목록으로 감점을 재산정한다.
        excludedDefectIndexes: bboxEdits[id]?.excluded ?? [],
        adoptedCandidateIndexes: bboxEdits[id]?.adopted ?? [],
        editedBboxes: Object.entries(bboxEdits[id]?.edited ?? {}).map(([index, bbox]) => ({
          index: Number(index),
          ...bbox,
        })),
        addedBboxes: (bboxEdits[id]?.added ?? []).map(({ tempId, imageIndex, ...bbox }) => ({
          imageIndex,
          ...bbox,
        })),
      });
    }

    try {
      const res = await adminAPI.submitHitlOverrides(payloadList);
      const timeNow = new Date().toLocaleTimeString();
      const firstPayload = payloadList[0];
      const summaryInfo = `총 ${payloadList.length}건 데이터베이스 오버라이드 승인 완료 (처분: ${firstPayload?.decision || 'APPROVE'}, 목표등급: ${firstPayload?.targetGrade || 'B'}, 사유: ${firstPayload?.primaryReasonCode || 'CLEAN'})`;

      // 1. 하단 실시간 모니터링 로그에 누적 기록
      appendPipelineLog({
        time: timeNow,
        agent: "Human Node (HITL) 👤",
        text: `🚀 [HITL 최종 결재 승인 성공] ${summaryInfo}`,
        type: "success",
      });

      // 2. 브라우저 alert 대신 고급 승인 완료 토스트 메시지 렌더링
      setApprovalToast(`🚀 [HITL 최종 결재 승인 완료] ${summaryInfo}`);
      setTimeout(() => setApprovalToast(null), 4500);

      setSelectedIds(new Set());
      fetchTasks();
    } catch (err: any) {
      console.error("Batch submit failed:", err);
      const timeNow = new Date().toLocaleTimeString();
      appendPipelineLog({
        time: timeNow,
        agent: "Human Node (HITL) 👤",
        text: `❌ [HITL 결재 처리 실패] ${err?.response?.data?.message || err?.message}`,
        type: "error",
      });
      setApprovalToast(`❌ 처리에 실패했습니다. (${err?.response?.data?.message || err?.message})`);
      setTimeout(() => setApprovalToast(null), 4500);
    }
  };

  return (
    <div className="w-full max-w-[1920px] mx-auto p-4 sm:p-6 lg:p-8 space-y-6 font-sans text-gray-900 dark:text-gray-100 transition-colors duration-200">
      {/* Top Banner Header (admin/inspections, admin/inventory 등 다른 관제 페이지와 동일 패턴) */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-white dark:bg-gray-900 p-6 rounded-2xl border border-gray-200 dark:border-gray-800 shadow-xs">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <span className="px-2.5 py-0.5 bg-blue-50 dark:bg-blue-950 text-blue-700 dark:text-blue-300 border border-blue-200 dark:border-blue-800 rounded-full text-xs font-bold font-mono flex items-center gap-1">
              <ShieldIcon className="w-3.5 h-3.5 text-blue-600 dark:text-blue-400" /> HUMAN-IN-THE-LOOP OVERRIDE CONSOLE
            </span>
            <span className="text-xs text-gray-400 dark:text-gray-500 font-mono">Supervisor 이관 건 수동 결재</span>
          </div>
          <h1 className="text-2xl font-extrabold text-gray-900 dark:text-white tracking-tight flex items-center gap-2">
            <ShieldIcon className="w-6 h-6 text-blue-600 dark:text-blue-400" />
            HITL 예외 검수 대시보드
          </h1>
          <p className="text-gray-500 dark:text-gray-400 text-xs mt-1">
            Supervisor가 자동 확정이 부적절하다고 판단해 이관한 건(HITL_REQUIRED)을 관리자가 직접 검증하여 최종 승인/반려/등급을 확정합니다.
          </p>
        </div>
        <div className="flex items-center gap-2 self-start sm:self-auto">
          <button
            onClick={fetchTasks}
            disabled={loading}
            className="px-4 py-2.5 bg-gray-100 dark:bg-gray-800 hover:bg-gray-200 dark:hover:bg-gray-700 text-gray-800 dark:text-gray-200 border border-gray-200 dark:border-gray-700 font-extrabold text-xs rounded-xl transition-all shadow-2xs flex items-center gap-1.5 cursor-pointer disabled:opacity-50"
          >
            <RefreshCw className={`w-4 h-4 ${loading ? "animate-spin" : ""}`} />
            새로고침
          </button>
          <button
            onClick={handleSubmit}
            disabled={selectedIds.size === 0}
            className="px-4 py-2.5 bg-blue-600 hover:bg-blue-700 text-white font-bold text-xs rounded-xl transition-all shadow-xs flex items-center gap-1.5 cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed"
          >
            <CheckCircle2 className="w-4 h-4" />
            선택 {selectedIds.size}건 최종 결재 제출
          </button>
        </div>
      </div>

      {/* HITL 대기열 누적 경보 (시스템 설정의 임계값과 실연동) */}
      {tasks.length >= alertThreshold && (
        <div className="flex items-center gap-3 bg-rose-50 dark:bg-rose-950/50 border border-rose-300 dark:border-rose-800 rounded-2xl px-5 py-3.5 shadow-xs animate-in fade-in slide-in-from-top-2">
          <AlertTriangle className="w-5 h-5 text-rose-600 dark:text-rose-400 shrink-0 animate-pulse" />
          <p className="text-xs font-bold text-rose-800 dark:text-rose-200">
            HITL 승인 대기열 누적 경보 — 대기 <strong className="font-mono text-sm">{tasks.length}</strong>건이
            설정 임계값(<strong className="font-mono">{alertThreshold}건</strong>)에 도달했습니다. 결재 지연 시 입고 리드타임에 영향을 줍니다.
          </p>
        </div>
      )}

      <HitlSummaryCards total={tasks.length} selected={selectedIds.size} filtered={filteredTasks.length} alertThreshold={alertThreshold} />

      <HitlPolicyGuide />

      {/* Control & Toolbar */}
      <div className="bg-white dark:bg-gray-900 p-5 rounded-2xl border border-gray-200 dark:border-gray-800 shadow-xs space-y-4">
        <div className="flex flex-col md:flex-row gap-4 items-center justify-between">
          <div className="relative w-full md:w-80">
            <Search className="w-4 h-4 absolute left-3.5 top-1/2 -translate-y-1/2 text-gray-400 dark:text-gray-500" />
            <input
              type="text"
              value={keyword}
              onChange={(e) => setKeyword(e.target.value)}
              placeholder="도서명, ISBN, LPN, Task ID 검색..."
              className="w-full pl-10 pr-4 py-2.5 text-xs border border-gray-200 dark:border-gray-700 rounded-xl outline-none focus:ring-2 focus:ring-blue-500 bg-gray-50/50 dark:bg-gray-800 dark:text-white font-medium"
            />
          </div>

          <MasterBulkToolbar selectedCount={selectedIds.size} onApply={handleApplyMasterSettings} />
        </div>
      </div>

      <HitlTaskTable
        tasks={filteredTasks}
        inFlightCount={inFlightTasks.length}
        loading={loading}
        selectedIds={selectedIds}
        onToggleSelect={toggleSelect}
        onToggleAll={toggleAll}
        decisions={decisions}
        grades={grades}
        reasons={reasons}
        comments={comments}
        setDecisions={setDecisions}
        setGrades={setGrades}
        setReasons={setReasons}
        setComments={setComments}
        reinspectingIds={reinspectingIds}
        onReinspect={handleTriggerAiReinspect}
        onOpenImage={setModalTask}
      />

      <PipelineLogPanel logs={pipelineLogs} onClear={handleClearLogs} />

      {/* HITL Image BBox Modal */}
      {modalTask && (
        <HitlImageModal
          task={modalTask}
          onClose={() => setModalTask(null)}
          edits={bboxEdits[String(modalTask.id)] ?? EMPTY_BBOX_EDITS}
          onEditsChange={(next) =>
            setBboxEdits((prev) => ({ ...prev, [String(modalTask.id)]: next }))
          }
        />
      )}

      {/* Multi-Agent AI Re-inspection Live Modal */}
      {activeReinspectionTask && (
        <ReinspectionLiveModal task={activeReinspectionTask} onClose={closeReinspection} />
      )}
      {/* Floating Approval Toast Notification */}
      {approvalToast && (
        <div className="fixed bottom-6 right-6 z-50 flex items-center gap-3 bg-gray-900 text-white dark:bg-blue-950 dark:text-blue-100 border border-blue-500/30 px-5 py-3.5 rounded-xl shadow-2xl animate-in slide-in-from-bottom-5 duration-300">
          <CheckCircle2 className="w-5 h-5 text-emerald-400 shrink-0" />
          <span className="text-xs font-bold font-sans tracking-tight">{approvalToast}</span>
          <button 
            onClick={() => setApprovalToast(null)} 
            className="ml-2 text-gray-400 hover:text-white text-sm font-bold"
          >
            ✕
          </button>
        </div>
      )}
    </div>
  );
}
