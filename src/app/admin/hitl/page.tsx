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
    { value: "DMG_INT_STAIN", label: "내부 낙서/오염" },
    { value: "DMG_INT_DISCOLOR", label: "내지 황변/변색" },
  ]},
];

const REASON_CODE_MAP: Record<string, { label: string; category: string; color: string }> = {
  DMG_EXT_CRUSH: { label: '모서리 찌그러짐', category: '외부 손상', color: 'bg-amber-50 text-amber-700 border-amber-200 dark:bg-amber-950 dark:text-amber-300 dark:border-amber-800' },
  DMG_EXT_WET: { label: '외부 습기/침수', category: '외부 손상', color: 'bg-rose-50 text-rose-700 border-rose-200 dark:bg-rose-950 dark:text-rose-300 dark:border-rose-800' },
  DMG_EXT_TEAR: { label: '커버 찢어짐', category: '외부 손상', color: 'bg-rose-50 text-rose-700 border-rose-200 dark:bg-rose-950 dark:text-rose-300 dark:border-rose-800' },
  DMG_INT_STAIN: { label: '내부 낙서/오염', category: '내부 훼손', color: 'bg-amber-50 text-amber-700 border-amber-200 dark:bg-amber-950 dark:text-amber-300 dark:border-amber-800' },
  DMG_INT_DISCOLOR: { label: '내지 황변/변색', category: '내부 훼손', color: 'bg-purple-50 text-purple-700 border-purple-200 dark:bg-purple-950 dark:text-purple-300 dark:border-purple-800' },
  FP_SHADOW: { label: '그림자 오탐', category: '오탐 방어', color: 'bg-emerald-50 text-emerald-700 border-emerald-200 dark:bg-emerald-950 dark:text-emerald-300 dark:border-emerald-800' },
  FP_GLARE: { label: '빛 반사 오탐', category: '오탐 방어', color: 'bg-emerald-50 text-emerald-700 border-emerald-200 dark:bg-emerald-950 dark:text-emerald-300 dark:border-emerald-800' },
};

export default function AdminHitlDashboard() {
  const [tasks, setTasks] = useState<HitlTask[]>([]);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [loading, setLoading] = useState(true);
  const [keyword, setKeyword] = useState("");
  const [modalTask, setModalTask] = useState<HitlTask | null>(null);

  // 각 row별 선택 및 설정 상태
  const [decisions, setDecisions] = useState<Record<string, string>>({});
  const [grades, setGrades] = useState<Record<string, string>>({});
  const [reasons, setReasons] = useState<Record<string, string>>({});
  const [comments, setComments] = useState<Record<string, string>>({});

  // 일괄 변경용 마스터 컨트롤러 상태
  const [masterDecision, setMasterDecision] = useState("APPROVE_DOWNGRADE");
  const [masterGrade, setMasterGrade] = useState("B");
  const [masterReason, setMasterReason] = useState("DMG_EXT_CRUSH");

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
        initReasons[t.id] = t.agent_logs?.reason_code || t.agent_logs?.primary_reason_code || "DMG_EXT_CRUSH";
        initComments[t.id] = t.human_issue_notes || "관리자 검수 오버라이드";
      });

      setDecisions(initDecisions);
      setGrades(initGrades);
      setReasons(initReasons);
      setComments(initComments);
    } catch (err: any) {
      console.error("Failed to fetch HITL tasks:", err);
      alert(`HITL 대기 목록을 불러오지 못했습니다. (${err?.response?.data?.message || err?.message || "권한/서버 오류"})`);
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

  // 마스터 컨트롤러 프리셋 설정
  const handleMasterDecisionChange = (val: string | null) => {
    if (val) setMasterDecision(val);
  };

  const handleMasterGradeChange = (val: string | null) => {
    if (val) setMasterGrade(val);
  };

  const handleMasterReasonChange = (val: string | null) => {
    if (val) setMasterReason(val);
  };

  // 마스터 설정값을 선택된 항목들에 [일괄 적용] 버튼 클릭 시만 반영
  const handleApplyMasterSettings = () => {
    if (selectedIds.size === 0) {
      alert("일괄 적용할 항목의 체크박스를 먼저 선택해 주세요.");
      return;
    }
    const nextDecisions = { ...decisions };
    const nextGrades = { ...grades };
    const nextReasons = { ...reasons };

    selectedIds.forEach((id) => {
      nextDecisions[id] = masterDecision;
      nextGrades[id] = masterGrade;
      nextReasons[id] = masterReason;
    });

    setDecisions(nextDecisions);
    setGrades(nextGrades);
    setReasons(nextReasons);
  };

  // 개별/일괄 승인 제출
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
      const reasonCode = reasons[id] || "DMG_EXT_CRUSH";
      const comment = comments[id] || "관리자 HITL 일괄 처리 승인";

      payloadList.push({
        ticketId: id,
        decision,
        targetGrade: decision === "REJECT_RETURN" || decision === "RE_CHECK" ? "REJECT" : targetGrade,
        primaryReasonCode: reasonCode,
        reasonComment: comment,
        defectCoordinates: task.agent_logs?.defect_coordinates || [],
        reviewDurationMs: Math.floor((Date.now() - pageEnterTime.current)),
      });
    }

    try {
      const res = await adminAPI.submitHitlOverrides(payloadList);
      alert(`[HITL 승인 완료] 총 ${payloadList.length}건이 성공적으로 오버라이드 결제 처리되었습니다.`);
      setSelectedIds(new Set());
      fetchTasks();
    } catch (err: any) {
      console.error("Batch submit failed:", err);
      alert(`처리에 실패했습니다. (${err?.response?.data?.message || err?.message})`);
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

            <Select value={masterReason} onValueChange={handleMasterReasonChange}>
              <SelectTrigger className="h-8 text-xs bg-white dark:bg-gray-800 dark:border-gray-700 dark:text-white w-36">
                <SelectValue />
              </SelectTrigger>
              <SelectContent className="dark:bg-gray-800 dark:border-gray-700">
                {REASON_OPTIONS.map((grp) => (
                  <React.Fragment key={grp.group}>
                    <div className="px-2 py-1 text-[10px] font-bold text-gray-400 dark:text-gray-500 bg-gray-50 dark:bg-gray-800">{grp.group}</div>
                    {grp.items.map((opt) => (
                      <SelectItem key={opt.value} value={opt.value}>
                        {opt.label}
                      </SelectItem>
                    ))}
                  </React.Fragment>
                ))}
              </SelectContent>
            </Select>

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
                  <th className="p-3 w-20">이미지</th>
                  <th className="p-3 w-52">AI 비전 감지 사유 (Vision Agent Output)</th>
                  <th className="p-3 w-40">처분 결정 (Decision)</th>
                  <th className="p-3 w-28">목표 등급</th>
                  <th className="p-3 w-44">수동 오버라이드 사유 (Reason)</th>
                  <th className="p-3">관리자 메모</th>
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
                        <div className="text-gray-500 dark:text-gray-400 font-mono text-[11px] mt-0.5">ISBN: {t.isbn || "-"}</div>
                        <div className="text-gray-400 dark:text-gray-500 font-mono text-[10px] mt-0.5">Task: {t.id.slice(0, 8)}...</div>
                        {t.ubci_score !== undefined && (
                          <span className="inline-block mt-1 bg-amber-100 dark:bg-amber-950 text-amber-800 dark:text-amber-300 border border-amber-200 dark:border-amber-800 text-[10px] font-semibold px-1.5 py-0.5 rounded">
                            UBCI: {t.ubci_score}점
                          </span>
                        )}
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
                        <Select
                          disabled={!isSelected}
                          value={reasons[t.id] || "DMG_EXT_CRUSH"}
                          onValueChange={(val: any) => setReasons({ ...reasons, [t.id]: val })}
                        >
                          <SelectTrigger className="w-full h-8 text-xs bg-white dark:bg-gray-800 dark:border-gray-700 dark:text-white">
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent className="dark:bg-gray-800 dark:border-gray-700">
                            {REASON_OPTIONS.map((grp) => (
                              <React.Fragment key={grp.group}>
                                <div className="px-2 py-1 text-[10px] font-bold text-gray-400 dark:text-gray-500 bg-gray-50 dark:bg-gray-800">{grp.group}</div>
                                {grp.items.map((opt) => (
                                  <SelectItem key={opt.value} value={opt.value}>
                                    {opt.label}
                                  </SelectItem>
                                ))}
                              </React.Fragment>
                            ))}
                          </SelectContent>
                        </Select>
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
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* HITL Image BBox Modal */}
      {modalTask && (
        <HitlImageModal task={modalTask} onClose={() => setModalTask(null)} />
      )}
    </div>
  );
}
