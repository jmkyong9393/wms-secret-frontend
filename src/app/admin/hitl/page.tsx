"use client";

import React, { useEffect, useState, useRef, useMemo } from "react";
import {
  RefreshCw,
  CheckCircle2,
  AlertTriangle,
  FileCheck,
  Search,
  Maximize2,
  Sliders,
  Sparkles,
  Bot,
  Shield as ShieldIcon
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { adminAPI } from "@/lib/api";
import type { HitlTask, HitlOverrideRequest } from "@/features/hitl/types/hitl";
import { HitlImageModal } from "@/features/hitl/components/HitlImageModal";

const DECISION_OPTIONS = [
  { value: "APPROVE_NORMAL", label: "정상 승인 (입고)" },
  { value: "APPROVE_DOWNGRADE", label: "등급 하향 승인" },
  { value: "REJECT_RETURN", label: "반려 (출판사/고객 반송)" },
  { value: "RE_CHECK", label: "재검수 요청 (재촬영)" },
];

const GRADE_OPTIONS = [
  { value: "S", label: "S급" },
  { value: "A", label: "A급" },
  { value: "B", label: "B급" },
  { value: "REJECT", label: "REJECT (폐기)" },
];

const REASON_OPTIONS = [
  { group: "오탐 방어 (정정)", items: [
    { value: "FP_SHADOW", label: "그림자 오탐" },
    { value: "FP_GLARE", label: "빛 반사 오탐" },
  ]},
  { group: "외부 손상", items: [
    { value: "DMG_EXT_CRUSH", label: "모서리 찌그러짐" },
    { value: "DMG_EXT_WET", label: "외부 습기/침수" },
    { value: "DMG_EXT_TEAR", label: "커버 찢어짐" },
  ]},
  { group: "내부 훼손", items: [
    { value: "DMG_INT_DOODLE", label: "내부 손글씨/낙서" },
    { value: "DMG_INT_STAIN", label: "내지 오염/이물질" },
    { value: "DMG_INT_DISCOLOR", label: "내지 황변/변색" },
  ]},
];

const REASON_CODE_MAP: Record<string, { label: string; category: string; color: string }> = {
  DMG_EXT_CRUSH: { label: '모서리 찌그러짐', category: '외부 손상', color: 'bg-amber-50 text-amber-700 border-amber-200 dark:bg-amber-950 dark:text-amber-300 dark:border-amber-800' },
  DMG_EXT_WET: { label: '외부 습기/침수', category: '외부 손상', color: 'bg-rose-50 text-rose-700 border-rose-200 dark:bg-rose-950 dark:text-rose-300 dark:border-rose-800' },
  DMG_EXT_TEAR: { label: '커버 찢어짐', category: '외부 손상', color: 'bg-rose-50 text-rose-700 border-rose-200 dark:bg-rose-950 dark:text-rose-300 dark:border-rose-800' },
  DMG_INT_DOODLE: { label: '내부 손글씨/낙서', category: '내부 훼손', color: 'bg-amber-50 text-amber-800 border-amber-300 dark:bg-amber-950 dark:text-amber-300 dark:border-amber-800' },
  DMG_INT_STAIN: { label: '내지 오염/이물질', category: '내부 훼손', color: 'bg-rose-50 text-rose-700 border-rose-200 dark:bg-rose-950 dark:text-rose-300 dark:border-rose-800' },
  DMG_INT_DISCOLOR: { label: '내지 황변/변색', category: '내부 훼손', color: 'bg-purple-50 text-purple-700 border-purple-200 dark:bg-purple-950 dark:text-purple-300 dark:border-purple-800' },
  FP_SHADOW: { label: '그림자 오탐', category: '오탐 방어', color: 'bg-emerald-50 text-emerald-700 border-emerald-200 dark:bg-emerald-950 dark:text-emerald-300 dark:border-emerald-800' },
  FP_GLARE: { label: '빛 반사 오탐', category: '오탐 방어', color: 'bg-emerald-50 text-emerald-700 border-emerald-200 dark:bg-emerald-950 dark:text-emerald-300 dark:border-emerald-800' },
};

export default function AdminHitlDashboard() {
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

  const [explainerLogs, setExplainerLogs] = useState<Array<{ time: string; agent: string; text: string; type: string }>>([]);
  const [isMounted, setIsMounted] = useState(false);

  useEffect(() => {
    setIsMounted(true);
    if (typeof window !== "undefined") {
      const saved = localStorage.getItem("hitl_explainer_logs");
      if (saved) {
        try {
          setExplainerLogs(JSON.parse(saved));
        } catch (e) {}
      }
    }
  }, []);

  useEffect(() => {
    if (isMounted && typeof window !== "undefined") {
      localStorage.setItem("hitl_explainer_logs", JSON.stringify(explainerLogs));
    }
  }, [explainerLogs, isMounted]);

  const handleClearLogs = () => {
    setExplainerLogs([]);
    if (typeof window !== "undefined") {
      localStorage.removeItem("hitl_explainer_logs");
    }
  };

  const handleTriggerAiReinspect = async (jobId: string) => {
    const targetTask = tasks.find((t) => t.id === jobId);
    const lpnStr = targetTask?.agent_logs?.lpn_barcode || targetTask?.lpn_barcode || `LPN-260728-${jobId.slice(0, 4).toUpperCase()}`;
    const titleStr = targetTask?.book_title || "수동 검수 요청 도서";

    setReinspectingIds((prev) => new Set(prev).add(jobId));
    setActiveReinspectionTask({
      id: jobId,
      lpn: lpnStr,
      title: titleStr,
      step: 1,
      logs: [
        `[${new Date().toLocaleTimeString()}] 🚀 Multi-Agent AI 비전 재검수 파이프라인 트리거 시작...`,
        `[${new Date().toLocaleTimeString()}] 👁️ [Vision Agent] 7개 검수 촬영 이미지 이미지 텐서 로딩 및 YOLOv8 3-Model Ensemble 디텍션 추론 중...`
      ],
      isDone: false,
    });

    try {
      const res = await adminAPI.triggerAiReinspection(jobId);
      const logs = res?.agent_logs || {};
      const score = res?.ubci_score !== undefined ? res.ubci_score : (logs?.ubci_score !== undefined ? logs.ubci_score : 75);
      const timeNow = new Date().toLocaleTimeString();

      const visionMsg = logs?.vision_text || `GPT-4o VLM 표지/속지 스캔 이미지 2차 검증 & GPT-4o-mini 예비 감점 산출 완료`;
      const policyMsg = logs?.policy_text || `사내 WMS 최우선 룰 적용 (B2B 타사 정책 교차 평가) ➔ UBCI ${score}점 도출`;
      const criticMsg = logs?.critic_text || `Critic Agent 파이프라인 검증 ➔ 전 과정 프로세스 무결성 확인 완공`;
      const reportMsg = logs?.report_text || `📜 [디지털 WMS 품질 검수 보증서] ➔ UBCI ${score}점 검수 보증서 발급 완료`;
      const humanMsg = logs?.human_node_text || `Human Node (HITL) ➔ 관리자 수동 개입 대기 및 오버라이드 폼 연동 완료`;
      const summaryMsg = logs?.explainer_summary || logs?.policy_text || `사내 WMS 수석 룰 연산 완료. UBCI ${score}점 입고 승인 추천`;

      setActiveReinspectionTask({
        id: jobId,
        lpn: lpnStr,
        title: titleStr,
        step: 5,
        isDone: true,
        logs: [
          `[${timeNow}] 🚀 백엔드 LangGraph Multi-Agent 실시간 추론 연산 완료`,
          `[${timeNow}] 👁️ [Vision Agent] ${visionMsg}`,
          `[${timeNow}] ⚖️ [Policy Agent] ${policyMsg}`,
          `[${timeNow}] 🛡️ [Critic Agent] ${criticMsg}`,
          `[${timeNow}] 📋 [Report Agent] ${reportMsg}`,
          `[${timeNow}] 👤 [Human Node (HITL)] ${humanMsg}`,
          `[${timeNow}] 💬 [Explainer Agent] "${summaryMsg}" DB 반영 완료!`,
        ],
      });

      setExplainerLogs((prev) => [
        {
          time: timeNow,
          agent: "Explainer Agent 💬",
          text: `[${lpnStr}] DB 연산 결과: "${summaryMsg}" DB 반영 완료!`,
          type: "success",
        },
        ...prev,
      ]);

      await fetchTasks();
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
  const [tasks, setTasks] = useState<HitlTask[]>([]);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [loading, setLoading] = useState(true);
  const [keyword, setKeyword] = useState("");
  const [modalTask, setModalTask] = useState<HitlTask | null>(null);
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
      setTasks(list);

      // 개별 라우별 initial state 미리 매핑
      const initDecisions: Record<string, string> = {};
      const initGrades: Record<string, string> = {};
      const initReasons: Record<string, string> = {};
      const initComments: Record<string, string> = {};

      list.forEach((t: HitlTask) => {
        initDecisions[t.id] = t.agent_logs?.suggested_decision || "APPROVE_DOWNGRADE";
        initGrades[t.id] = t.agent_logs?.suggested_grade || "B";
        initReasons[t.id] = t.agent_logs?.reason_code || t.agent_logs?.primary_reason_code || "DMG_INT_DOODLE";
        initComments[t.id] = t.human_issue_notes || "관리자 검수 오버라이드";
      });

      setDecisions(initDecisions);
      setGrades(initGrades);
      setReasons(initReasons);
      setComments(initComments);
    } catch (err: any) {
      console.error("Failed to fetch HITL tasks:", err);
      // alert() 팝업 대신 콘솔 로깅 및 401 로그인 리다이렉트 방어
      if (err?.response?.status === 401 && typeof window !== "undefined") {
        window.location.href = "/login";
      }
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchTasks();
  }, []);

  // 검색어 필터링
  const filteredTasks = useMemo(() => {
    if (!keyword.trim()) return tasks;
    const kw = keyword.trim().toLowerCase();
    return tasks.filter(
      (t) =>
        (t.book_title && t.book_title.toLowerCase().includes(kw)) ||
        (t.isbn && t.isbn.includes(kw)) ||
        (t.id && t.id.toLowerCase().includes(kw))
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

  const [masterDecision, setMasterDecision] = useState<string>("APPROVE_DOWNGRADE");
  const [masterGrade, setMasterGrade] = useState<string>("B");
  const [masterReasons, setMasterReasons] = useState<string[]>(["DMG_INT_DOODLE", "DMG_EXT_CRUSH"]);

  const handleMasterDecisionChange = (val: string | null) => {
    if (val) setMasterDecision(val);
  };

  const handleMasterGradeChange = (val: string | null) => {
    if (val) setMasterGrade(val);
  };

  const toggleMasterReason = (code: string) => {
    if (masterReasons.includes(code)) {
      if (masterReasons.length > 1) {
        setMasterReasons(masterReasons.filter((c) => c !== code));
      }
    } else {
      setMasterReasons([...masterReasons, code]);
    }
  };

  // 마스터 설정값을 선택된 항목들에 [폼에 세팅] 버튼 클릭 시 수동 반영
  const handleApplyMasterSettings = () => {
    if (selectedIds.size === 0) {
      alert("일괄 세팅할 항목의 체크박스를 먼저 선택해 주세요.");
      return;
    }
    const nextDecisions = { ...decisions };
    const nextGrades = { ...grades };
    const nextReasons = { ...reasons };

    selectedIds.forEach((id) => {
      nextDecisions[id] = masterDecision;
      nextGrades[id] = masterGrade;
      nextReasons[id] = [...masterReasons];
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
      const targetGrade = grades[id] || "B";
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
        reviewDurationMs: Math.floor((Date.now() - pageEnterTime.current)),
      });
    }

    try {
      const res = await adminAPI.submitHitlOverrides(payloadList);
      const timeNow = new Date().toLocaleTimeString();
      const firstPayload = payloadList[0];
      const summaryInfo = `총 ${payloadList.length}건 데이터베이스 오버라이드 승인 완료 (처분: ${firstPayload?.decision || 'APPROVE'}, 목표등급: ${firstPayload?.targetGrade || 'B'}, 사유: ${firstPayload?.primaryReasonCode || 'CLEAN'})`;

      // 1. 하단 실시간 모니터링 로그에 누적 기록
      setExplainerLogs((prev) => [
        {
          time: timeNow,
          agent: "Human Node (HITL) 👤",
          text: `🚀 [HITL 최종 결재 승인 성공] ${summaryInfo}`,
          type: "success",
        },
        ...prev,
      ]);

      // 2. 브라우저 alert 대신 고급 승인 완료 토스트 메시지 렌더링
      setApprovalToast(`🚀 [HITL 최종 결재 승인 완료] ${summaryInfo}`);
      setTimeout(() => setApprovalToast(null), 4500);

      setSelectedIds(new Set());
      fetchTasks();
    } catch (err: any) {
      console.error("Batch submit failed:", err);
      const timeNow = new Date().toLocaleTimeString();
      setExplainerLogs((prev) => [
        {
          time: timeNow,
          agent: "Human Node (HITL) 👤",
          text: `❌ [HITL 결재 처리 실패] ${err?.response?.data?.message || err?.message}`,
          type: "error",
        },
        ...prev,
      ]);
      setApprovalToast(`❌ 처리에 실패했습니다. (${err?.response?.data?.message || err?.message})`);
      setTimeout(() => setApprovalToast(null), 4500);
    }
  };

  return (
    <div className="w-full max-w-[1920px] mx-auto p-4 sm:p-6 lg:p-8 space-y-6 font-sans text-gray-900 dark:text-gray-100 transition-colors duration-200">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 bg-white dark:bg-gray-900 p-6 rounded-2xl border border-gray-200 dark:border-gray-800 shadow-xs">
        <div>
          <h2 className="text-2xl font-bold text-gray-900 dark:text-white flex items-center gap-2">
            <ShieldIcon className="w-6 h-6 text-blue-600 dark:text-blue-400" />
            HITL 예외 검수 대시보드
          </h2>
          <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">
            AI 보류 건(HITL_REQUIRED)에 대해 관리자가 이미지와 결함을 검증하여 최종 승인/반려/등급을 오버라이드합니다.
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Button variant="outline" onClick={fetchTasks} disabled={loading} className="dark:bg-gray-800 dark:border-gray-700 dark:text-gray-200">
            <RefreshCw className={`w-4 h-4 mr-2 ${loading ? "animate-spin" : ""}`} />
            새로고침
          </Button>
          <Button onClick={handleSubmit} disabled={selectedIds.size === 0} className="bg-blue-600 hover:bg-blue-700 font-bold text-xs shadow-md">
            <CheckCircle2 className="w-4 h-4 mr-1.5" />
            🚀 선택 {selectedIds.size}건 최종 결재 제출
          </Button>
        </div>
      </div>

      {/* Summary Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <div className="bg-white dark:bg-gray-900 p-4 rounded-xl border border-gray-200 dark:border-gray-800 shadow-sm flex items-center justify-between">
          <div>
            <p className="text-xs font-semibold text-gray-400 dark:text-gray-500 uppercase tracking-wider">검수 대기 총계</p>
            <p className="text-2xl font-extrabold text-gray-900 dark:text-white mt-1">{tasks.length}건</p>
          </div>
          <div className="p-3 bg-amber-50 dark:bg-amber-950/60 rounded-lg border border-amber-100 dark:border-amber-800">
            <AlertTriangle className="w-5 h-5 text-amber-600 dark:text-amber-400" />
          </div>
        </div>

        <div className="bg-white dark:bg-gray-900 p-4 rounded-xl border border-gray-200 dark:border-gray-800 shadow-sm flex items-center justify-between">
          <div>
            <p className="text-xs font-semibold text-gray-400 dark:text-gray-500 uppercase tracking-wider">선택된 처리 건</p>
            <p className="text-2xl font-extrabold text-blue-600 dark:text-blue-400 mt-1">{selectedIds.size}건</p>
          </div>
          <div className="p-3 bg-blue-50 dark:bg-blue-950/60 rounded-lg border border-blue-100 dark:border-blue-800">
            <FileCheck className="w-5 h-5 text-blue-600 dark:text-blue-400" />
          </div>
        </div>

        <div className="bg-white dark:bg-gray-900 p-4 rounded-xl border border-gray-200 dark:border-gray-800 shadow-sm flex items-center justify-between">
          <div>
            <p className="text-xs font-semibold text-gray-400 dark:text-gray-500 uppercase tracking-wider">검색 필터 적용 건</p>
            <p className="text-2xl font-extrabold text-gray-700 dark:text-gray-300 mt-1">{filteredTasks.length}건</p>
          </div>
          <div className="p-3 bg-gray-50 dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700">
            <Sparkles className="w-5 h-5 text-gray-500 dark:text-gray-400" />
          </div>
        </div>
      </div>

      {/* Control & Toolbar */}
      <div className="bg-white dark:bg-gray-900 p-4 rounded-xl border border-gray-200 dark:border-gray-800 shadow-sm space-y-4">
        <div className="flex flex-col md:flex-row gap-4 items-center justify-between">
          <div className="relative w-full md:w-80">
            <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 dark:text-gray-500" />
            <Input
              value={keyword}
              onChange={(e) => setKeyword(e.target.value)}
              placeholder="도서명, ISBN, Task ID 검색"
              className="pl-9 dark:bg-gray-800 dark:border-gray-700 dark:text-white"
            />
          </div>

          {/* Master Bulk Setting Toolbar */}
          <div className="flex flex-wrap items-center gap-2 bg-blue-50/70 dark:bg-blue-950/50 p-2 rounded-lg border border-blue-100 dark:border-blue-800 w-full md:w-auto">
            <div className="flex items-center text-xs font-bold text-blue-900 dark:text-blue-300 mr-1">
              <Sliders className="w-3.5 h-3.5 mr-1" />
              선택항목 일괄 설정:
            </div>
            <Select value={masterDecision} onValueChange={handleMasterDecisionChange}>
              <SelectTrigger className="h-8 text-xs bg-white dark:bg-gray-800 dark:border-gray-700 dark:text-white w-32">
                <SelectValue />
              </SelectTrigger>
              <SelectContent className="dark:bg-gray-800 dark:border-gray-700">
                {DECISION_OPTIONS.map((opt) => (
                  <SelectItem key={opt.value} value={opt.value}>
                    {opt.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>

            <Select value={masterGrade} onValueChange={handleMasterGradeChange}>
              <SelectTrigger className="h-8 text-xs bg-white dark:bg-gray-800 dark:border-gray-700 dark:text-white w-24">
                <SelectValue />
              </SelectTrigger>
              <SelectContent className="dark:bg-gray-800 dark:border-gray-700">
                {GRADE_OPTIONS.map((opt) => (
                  <SelectItem key={opt.value} value={opt.value}>
                    {opt.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>

            <div className="flex items-center gap-1.5 bg-gray-50 dark:bg-gray-800/80 p-1 rounded-lg border border-gray-200 dark:border-gray-700">
              {masterReasons.map((code) => {
                const meta = REASON_CODE_MAP[code] || { label: code, color: "bg-gray-100 text-gray-700 border-gray-200" };
                return (
                  <span
                    key={code}
                    className={`inline-flex items-center gap-1 px-2 py-0.5 rounded text-[11px] font-bold border transition-all ${meta.color}`}
                  >
                    {meta.label}
                    {masterReasons.length > 1 && (
                      <button
                        type="button"
                        onClick={() => toggleMasterReason(code)}
                        className="hover:text-red-500 font-bold ml-0.5 text-xs leading-none"
                        title="사유 제거"
                      >
                        ✕
                      </button>
                    )}
                  </span>
                );
              })}
              <Select
                onValueChange={(val: string) => {
                  if (!masterReasons.includes(val)) {
                    setMasterReasons([...masterReasons, val]);
                  }
                }}
              >
                <SelectTrigger className="h-6 w-24 text-[10px] font-bold px-2 bg-purple-50 text-purple-700 dark:bg-purple-950 dark:text-purple-300 border-dashed border-purple-300 dark:border-purple-800">
                  <span>+ 사유 선택</span>
                </SelectTrigger>
                <SelectContent className="dark:bg-gray-800 dark:border-gray-700">
                  {REASON_OPTIONS.map((grp) => (
                    <React.Fragment key={grp.group}>
                      <div className="px-2 py-1 text-[10px] font-bold text-gray-400 dark:text-gray-500 bg-gray-50 dark:bg-gray-800">{grp.group}</div>
                      {grp.items.map((opt) => (
                        <SelectItem key={opt.value} value={opt.value}>
                          <span className="flex items-center gap-1.5">
                            {masterReasons.includes(opt.value) ? "✓ " : ""}
                            {opt.label}
                          </span>
                        </SelectItem>
                      ))}
                    </React.Fragment>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <Button
              size="sm"
              onClick={handleApplyMasterSettings}
              disabled={selectedIds.size === 0}
              className="h-8 text-xs font-bold bg-blue-600 hover:bg-blue-700 text-white disabled:opacity-50 transition-all cursor-pointer shadow-xs"
            >
              ⚡ {selectedIds.size > 0 ? `선택 ${selectedIds.size}건 폼에 세팅` : '선택 항목 폼에 세팅'}
            </Button>
          </div>
        </div>
      </div>

      {/* Main Table */}
      <div className="bg-white dark:bg-gray-900 rounded-xl border border-gray-200 dark:border-gray-800 shadow-sm overflow-hidden">
        {loading ? (
          <div className="p-12 text-center text-gray-400 dark:text-gray-500 text-sm">데이터를 불러오는 중...</div>
        ) : filteredTasks.length === 0 ? (
          <div className="p-12 text-center text-gray-400 dark:text-gray-500 text-sm">대기 중인 검수 건이 없습니다.</div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm text-left">
              <thead className="bg-gray-50 dark:bg-gray-800/80 text-gray-600 dark:text-gray-400 border-b border-gray-200 dark:border-gray-800 text-xs font-semibold">
                <tr>
                  <th className="p-3 w-10 text-center">
                    <input
                      type="checkbox"
                      className="w-4 h-4 rounded border-gray-300 text-blue-600 cursor-pointer"
                      checked={selectedIds.size === filteredTasks.length && filteredTasks.length > 0}
                      onChange={toggleAll}
                    />
                  </th>
                  <th className="p-3 w-20 text-center">이미지</th>
                  <th className="p-3 w-56">도서 정보 및 바코드</th>
                  <th className="p-3 w-48">AI 비전 감지 사유</th>
                  <th className="p-3 w-36">처분 결정 (Decision)</th>
                  <th className="p-3 w-24">목표 등급</th>
                  <th className="p-3 w-40">오버라이드 사유</th>
                  <th className="p-3 w-48">관리자 메모</th>
                  <th className="p-3 w-28 text-center">AI 재검수</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100 dark:divide-gray-800 text-xs">
                {filteredTasks.map((t) => {
                  const isSelected = selectedIds.has(t.id);
                  const hasImage = t.image_urls && t.image_urls.length > 0;
                  const firstImage = hasImage ? t.image_urls[0] : t.cover_image_url;

                  return (
                    <tr
                      key={t.id}
                      className={`transition-colors ${
                        isSelected 
                          ? "bg-blue-50/40 dark:bg-blue-950/40" 
                          : "hover:bg-gray-50/80 dark:hover:bg-gray-800/50"
                      }`}
                    >
                      <td className="p-3 text-center">
                        <input
                          type="checkbox"
                          className="w-4 h-4 rounded border-gray-300 text-blue-600 cursor-pointer"
                          checked={isSelected}
                          onChange={() => toggleSelect(t.id)}
                        />
                      </td>

                      <td className="p-3">
                        <div
                          className="relative w-14 h-18 bg-gray-100 dark:bg-gray-800 rounded border border-gray-200 dark:border-gray-700 overflow-hidden cursor-pointer group shadow-sm"
                          onClick={() => setModalTask(t)}
                          title="클릭하여 원본 이미지 및 결함 박스 확대보기"
                        >
                          {firstImage ? (
                            <img src={firstImage} alt="book" className="w-full h-full object-cover" />
                          ) : (
                            <div className="w-full h-full flex items-center justify-center text-[10px] text-gray-400 dark:text-gray-500">
                              No Img
                            </div>
                          )}
                          <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 flex items-center justify-center transition-opacity">
                            <Maximize2 className="w-4 h-4 text-white" />
                          </div>
                        </div>
                      </td>

                      <td className="p-3">
                        <div className="font-bold text-gray-900 dark:text-white line-clamp-1">{t.book_title || "도서 정보 없음"}</div>
                        <div className="flex flex-wrap items-center gap-1.5 mt-1">
                          <span className="bg-indigo-50 dark:bg-indigo-950 text-indigo-700 dark:text-indigo-300 border border-indigo-200 dark:border-indigo-800 font-mono text-[11px] font-extrabold px-2 py-0.5 rounded shadow-2xs">
                            {t.agent_logs?.lpn_barcode || t.lpn_barcode || `LPN-260728-${t.id.slice(0, 4).toUpperCase()}`}
                          </span>
                          <span className="text-gray-500 dark:text-gray-400 font-mono text-[11px]">ISBN: {t.isbn || "-"}</span>
                        </div>
                        <div className="flex items-center gap-2 mt-1">
                          <span className="text-gray-400 dark:text-gray-500 font-mono text-[10px]">Task: {t.id.slice(0, 8)}...</span>
                          {t.ubci_score !== undefined && (
                            <span className="bg-amber-100 dark:bg-amber-950 text-amber-800 dark:text-amber-300 border border-amber-200 dark:border-amber-800 text-[10px] font-bold px-1.5 py-0.5 rounded">
                              UBCI: {t.ubci_score}점
                            </span>
                          )}
                        </div>
                      </td>

                      <td className="p-3">
                        {(() => {
                          const code = t.agent_logs?.reason_code || t.agent_logs?.primary_reason_code || "DMG_EXT_CRUSH";
                          const meta = REASON_CODE_MAP[code] || {
                            label: code,
                            category: 'AI 감지',
                            color: 'bg-gray-100 text-gray-800 border-gray-200 dark:bg-gray-800 dark:text-gray-200 dark:border-gray-700',
                          };
                          return (
                            <div className="space-y-1">
                              <span className={`inline-block px-2 py-0.5 rounded text-[10px] font-extrabold font-mono border ${meta.color}`}>
                                [{code}] {meta.label}
                              </span>
                              <p className="text-[10px] text-gray-400 font-mono truncate" title={t.agent_logs?.reason || "Vision Agent 1차 감지 완료"}>
                                {t.agent_logs?.reason || "Vision Agent 1차 감지 완료"}
                              </p>
                            </div>
                          );
                        })()}
                      </td>

                      <td className="p-3">
                        <Select
                          disabled={!isSelected}
                          value={decisions[t.id] || "APPROVE_DOWNGRADE"}
                          onValueChange={(val: any) => setDecisions({ ...decisions, [t.id]: val })}
                        >
                          <SelectTrigger className="w-full h-8 text-xs bg-white dark:bg-gray-800 dark:border-gray-700 dark:text-white">
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent className="dark:bg-gray-800 dark:border-gray-700">
                            {DECISION_OPTIONS.map((opt) => (
                              <SelectItem key={opt.value} value={opt.value}>
                                {opt.label}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </td>

                      <td className="p-3">
                        <Select
                          disabled={!isSelected || decisions[t.id] === "REJECT_RETURN" || decisions[t.id] === "RE_CHECK"}
                          value={grades[t.id] || "B"}
                          onValueChange={(val: any) => setGrades({ ...grades, [t.id]: val })}
                        >
                          <SelectTrigger className="w-full h-8 text-xs bg-white dark:bg-gray-800 dark:border-gray-700 dark:text-white">
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent className="dark:bg-gray-800 dark:border-gray-700">
                            {GRADE_OPTIONS.map((opt) => (
                              <SelectItem key={opt.value} value={opt.value}>
                                {opt.label}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </td>

                      <td className="p-3">
                        {(() => {
                          const rawVal = reasons[t.id];
                          const selectedList: string[] = Array.isArray(rawVal)
                            ? (rawVal as any)
                            : (rawVal ? [rawVal as any] : []);

                          const toggleReasonCode = (codeToToggle: string) => {
                            const current = selectedList.includes(codeToToggle)
                              ? selectedList.filter((c) => c !== codeToToggle)
                              : [...selectedList, codeToToggle];
                            setReasons({ ...reasons, [t.id]: current });
                          };

                          return (
                            <div className="flex flex-wrap items-center gap-1.5 min-w-[210px]">
                              {selectedList.length === 0 ? (
                                <span className="inline-flex items-center px-2 py-0.5 rounded text-[11px] font-bold bg-emerald-50 text-emerald-700 border border-emerald-200 dark:bg-emerald-950 dark:text-emerald-300 dark:border-emerald-800">
                                  [CLEAN] 결함 없음 (정상)
                                </span>
                              ) : (
                                selectedList.map((code) => {
                                  const meta = REASON_CODE_MAP[code] || { label: code, color: "bg-gray-100 text-gray-700 border-gray-200" };
                                  return (
                                    <span
                                      key={code}
                                      className={`inline-flex items-center gap-1 px-2 py-0.5 rounded text-[11px] font-bold border transition-all ${meta.color}`}
                                    >
                                      {meta.label}
                                      {isSelected && (
                                        <button
                                          type="button"
                                          onClick={() => toggleReasonCode(code)}
                                          className="hover:text-red-600 dark:hover:text-red-400 font-bold ml-1 text-xs leading-none p-0.5 rounded hover:bg-red-50 dark:hover:bg-red-950 transition-colors"
                                          title="AI 감지 사유 삭제/수정"
                                        >
                                          ✕
                                        </button>
                                      )}
                                    </span>
                                  );
                                })
                              )}
                              <Select
                                disabled={!isSelected}
                                onValueChange={(val: string) => {
                                  if (!selectedList.includes(val)) {
                                    setReasons({ ...reasons, [t.id]: [...selectedList, val] });
                                  }
                                }}
                              >
                                <SelectTrigger className="h-6 w-20 text-[10px] font-bold px-1.5 bg-purple-50 text-purple-700 dark:bg-purple-950 dark:text-purple-300 border-dashed border-purple-300 dark:border-purple-800">
                                  <span>+ 사유 추가</span>
                                </SelectTrigger>
                                <SelectContent className="dark:bg-gray-800 dark:border-gray-700">
                                  {REASON_OPTIONS.map((grp) => (
                                    <React.Fragment key={grp.group}>
                                      <div className="px-2 py-1 text-[10px] font-bold text-gray-400 dark:text-gray-500 bg-gray-50 dark:bg-gray-800">{grp.group}</div>
                                      {grp.items.map((opt) => (
                                        <SelectItem key={opt.value} value={opt.value}>
                                          <span className="flex items-center gap-1.5">
                                            {selectedList.includes(opt.value) ? "✓ " : ""}
                                            {opt.label}
                                          </span>
                                        </SelectItem>
                                      ))}
                                    </React.Fragment>
                                  ))}
                                </SelectContent>
                              </Select>
                            </div>
                          );
                        })()}
                      </td>

                      <td className="p-3">
                        <Input
                          disabled={!isSelected}
                          placeholder="사유 작성 (선택)"
                          value={comments[t.id] || ""}
                          onChange={(e) => setComments({ ...comments, [t.id]: e.target.value })}
                          className="h-8 text-xs bg-white dark:bg-gray-800 dark:border-gray-700 dark:text-white"
                        />
                      </td>

                      <td className="p-3 text-center">
                        <Button
                          size="sm"
                          variant="outline"
                          className="h-8 text-xs font-bold text-purple-700 bg-purple-50 hover:bg-purple-100 border-purple-200 dark:bg-purple-950 dark:text-purple-300 dark:border-purple-800 shadow-2xs whitespace-nowrap"
                          onClick={() => handleTriggerAiReinspect(t.id)}
                          disabled={reinspectingIds.has(t.id)}
                        >
                          <Sparkles className="w-3.5 h-3.5 mr-1 text-purple-600 dark:text-purple-400" />
                          {reinspectingIds.has(t.id) ? "재검수 중..." : "AI 재검수"}
                        </Button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Explainer Agent Real-time Live Monitoring Center (Bottom Panel) */}
      <div className="bg-white dark:bg-gray-900 p-6 rounded-2xl border border-gray-200 dark:border-gray-800 shadow-xs space-y-4">
        <div className="flex items-center justify-between border-b border-gray-100 dark:border-gray-800 pb-3">
          <div className="flex items-center gap-2">
            <div className="p-2 bg-purple-50 dark:bg-purple-950 rounded-lg text-purple-600 dark:text-purple-400">
              <Bot className="w-5 h-5" />
            </div>
            <div>
              <h3 className="text-base font-bold text-gray-900 dark:text-white flex items-center gap-2">
                Explainer Agent 실시간 Multi-Agent 파이프라인 모니터링
                <span className="inline-flex items-center px-2 py-0.5 rounded text-[10px] font-bold bg-green-100 dark:bg-green-950 text-green-700 dark:text-green-300 border border-green-200 dark:border-green-800">
                  <span className="w-1.5 h-1.5 rounded-full bg-green-500 mr-1 animate-pulse" /> Live Stream
                </span>
              </h3>
              <p className="text-xs text-gray-500 dark:text-gray-400">
                Vision Agent (YOLOv8 Ensemble) ➔ Policy Agent (WMS Rules) ➔ Critic Agent (Cross-Check) ➔ Explainer Agent (Final Diagnosis)
              </p>
            </div>
          </div>
          <Button size="xs" variant="ghost" className="text-xs text-gray-400 hover:text-gray-600 cursor-pointer hover:bg-gray-100 dark:hover:bg-gray-800" onClick={handleClearLogs}>
            로그 초기화
          </Button>
        </div>

        <div className="bg-gray-950 text-gray-200 p-4 rounded-xl font-mono text-xs space-y-2 max-h-48 overflow-y-auto border border-gray-800 shadow-inner">
          {explainerLogs.length === 0 ? (
            <div className="text-gray-500 italic text-center py-4">대기 중인 Multi-Agent 로그가 없습니다. [AI 재검수] 실행 시 실시간 스트리밍됩니다.</div>
          ) : (
            explainerLogs.map((log, idx) => (
              <div key={idx} className="flex items-start gap-3 py-1 border-b border-gray-900/60 last:border-0">
                <span className="text-gray-500 font-mono text-[11px] min-w-[65px]">[{log.time}]</span>
                <span className="font-bold text-purple-400 min-w-[120px]">{log.agent}</span>
                <span className={`flex-1 ${log.type === "success" ? "text-emerald-400" : log.type === "warning" ? "text-amber-300" : "text-gray-300"}`}>
                  {log.text}
                </span>
              </div>
            ))
          )}
        </div>
      </div>

      {/* HITL Image BBox Modal */}
      {modalTask && (
        <HitlImageModal task={modalTask} onClose={() => setModalTask(null)} />
      )}

      {/* Multi-Agent AI Re-inspection Live Modal */}
      {activeReinspectionTask && (
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
                    대상 LPN: <span className="font-mono font-bold text-yellow-300">{activeReinspectionTask.lpn}</span> ({activeReinspectionTask.title})
                  </p>
                </div>
              </div>
              {activeReinspectionTask.isDone && (
                <button
                  onClick={() => setActiveReinspectionTask(null)}
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
                  { step: 1, label: "Vision 👁️", desc: "VLM 2차검증+4o-mini예비" },
                  { step: 2, label: "Policy ⚖️", desc: "사내WMS룰+B2B평가" },
                  { step: 3, label: "Critic 🛡️", desc: "프로세스/루프검증" },
                  { step: 4, label: "Report 📋", desc: "디지털품질보증서" },
                  { step: 5, label: "HITL 👤", desc: "관리자오버라이드" },
                ].map((s) => {
                  const isActive = activeReinspectionTask.step >= s.step;
                  const isCurrent = activeReinspectionTask.step === s.step;

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
                  style={{ width: `${(activeReinspectionTask.step / 4) * 100}%` }}
                />
              </div>

              {/* Live Terminal Stream */}
              <div className="bg-gray-950 text-gray-100 p-5 rounded-xl font-mono text-xs sm:text-sm space-y-3 h-64 overflow-y-auto border border-gray-800 shadow-inner">
                {activeReinspectionTask.logs.map((log, i) => (
                  <div key={i} className="leading-relaxed border-b border-gray-900/60 pb-1.5 last:border-none">
                    {log}
                  </div>
                ))}
                {!activeReinspectionTask.isDone && (
                  <div className="text-purple-400 animate-pulse flex items-center gap-1.5 mt-2">
                    <span className="w-2 h-2 rounded-full bg-purple-400" /> Multi-Agent 비전 텐서 및 룰 엔진 계산 중...
                  </div>
                )}
              </div>
            </div>

            {/* Modal Footer */}
            <div className="bg-gray-50 dark:bg-gray-800/80 px-6 py-4 flex items-center justify-between border-t border-gray-200 dark:border-gray-800">
              <span className="text-xs text-gray-500 dark:text-gray-400">
                {activeReinspectionTask.isDone
                  ? "✅ Multi-Agent 비전 재검수 완료 (PostgreSQL DB 동기화 완료)"
                  : "⏳ 비전 검수 파이프라인 가동 중..."}
              </span>
              <Button
                disabled={!activeReinspectionTask.isDone}
                onClick={() => setActiveReinspectionTask(null)}
                className="bg-purple-600 hover:bg-purple-700 text-white font-bold text-xs px-5 py-2 rounded-lg"
              >
                {activeReinspectionTask.isDone ? "완료 및 결과 반영" : "재검수 진행 중..."}
              </Button>
            </div>
          </div>
        </div>
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
