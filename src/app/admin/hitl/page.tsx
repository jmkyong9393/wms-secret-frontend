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
      setTasks(data || []);
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
        (t.isbn && t.isbn.toLowerCase().includes(kw)) ||
        t.id.toLowerCase().includes(kw)
    );
  }, [tasks, keyword]);

  const toggleSelect = (id: string) => {
    const newSet = new Set(selectedIds);
    if (newSet.has(id)) {
      newSet.delete(id);
    } else {
      newSet.add(id);
      if (!decisions[id]) {
        setDecisions((prev) => ({ ...prev, [id]: masterDecision }));
        setGrades((prev) => ({ ...prev, [id]: masterGrade }));
        setReasons((prev) => ({ ...prev, [id]: masterReason }));
      }
    }
    setSelectedIds(newSet);
  };

  const toggleAll = () => {
    if (selectedIds.size === filteredTasks.length) {
      setSelectedIds(new Set());
    } else {
      const newSet = new Set(filteredTasks.map((t) => t.id));
      setSelectedIds(newSet);

      const d = { ...decisions },
        g = { ...grades },
        r = { ...reasons };
      filteredTasks.forEach((t) => {
        if (!d[t.id]) d[t.id] = masterDecision;
        if (!g[t.id]) g[t.id] = masterGrade;
        if (!r[t.id]) r[t.id] = masterReason;
      });
      setDecisions(d);
      setGrades(g);
      setReasons(r);
    }
  };

  // 마스터 컨트롤러 -> 선택된 항목 일괄 적용
  const handleApplyMasterSettings = () => {
    if (selectedIds.size === 0) return;
    const d = { ...decisions },
      g = { ...grades },
      r = { ...reasons };
    selectedIds.forEach((id) => {
      d[id] = masterDecision;
      g[id] = masterGrade;
      r[id] = masterReason;
    });
    setDecisions(d);
    setGrades(g);
    setReasons(r);
  };

  const handleSubmit = async () => {
    if (selectedIds.size === 0) return alert("처리할 항목을 1개 이상 선택해 주세요.");

    const duration = Date.now() - pageEnterTime.current;
    const items: HitlOverrideRequest[] = Array.from(selectedIds).map((id) => ({
      ticketId: id,
      decision: decisions[id] || "APPROVE_DOWNGRADE",
      targetGrade: grades[id] || "B",
      primaryReasonCode: reasons[id] || "DMG_EXT_CRUSH",
      reasonComment: comments[id] || "",
      defectCoordinates: [],
      reviewDurationMs: Math.max(1000, Math.floor(duration / selectedIds.size)),
    }));

    try {
      await adminAPI.submitHitlOverrides(items);
      alert(`총 ${items.length}건의 예외 처리(Override)가 완료되었습니다.`);
      setSelectedIds(new Set());
      fetchTasks();
    } catch (err) {
      console.error(err);
      alert("일괄 처리에 실패했습니다.");
    }
  };

  return (
    <div className="max-w-7xl mx-auto space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h2 className="text-2xl font-bold text-gray-900 flex items-center gap-2">
            <ShieldIcon className="w-6 h-6 text-blue-600" />
            HITL 예외 검수 대시보드
          </h2>
          <p className="text-sm text-gray-500 mt-1">
            AI 보류 건(HITL_REQUIRED)에 대해 관리자가 이미지와 결함을 검증하여 최종 승인/반려/등급을 오버라이드합니다.
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Button variant="outline" onClick={fetchTasks} disabled={loading}>
            <RefreshCw className={`w-4 h-4 mr-2 ${loading ? "animate-spin" : ""}`} />
            새로고침
          </Button>
          <Button onClick={handleSubmit} disabled={selectedIds.size === 0} className="bg-blue-600 hover:bg-blue-700">
            <CheckCircle2 className="w-4 h-4 mr-2" />
            선택 항목 일괄 처리 ({selectedIds.size}건)
          </Button>
        </div>
      </div>

      {/* Summary Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <div className="bg-white p-4 rounded-xl border border-gray-200 shadow-sm flex items-center justify-between">
          <div>
            <p className="text-xs font-semibold text-gray-400 uppercase tracking-wider">검수 대기 총계</p>
            <p className="text-2xl font-extrabold text-gray-900 mt-1">{tasks.length}건</p>
          </div>
          <div className="p-3 bg-amber-50 rounded-lg border border-amber-100">
            <AlertTriangle className="w-5 h-5 text-amber-600" />
          </div>
        </div>

        <div className="bg-white p-4 rounded-xl border border-gray-200 shadow-sm flex items-center justify-between">
          <div>
            <p className="text-xs font-semibold text-gray-400 uppercase tracking-wider">선택된 처리 건</p>
            <p className="text-2xl font-extrabold text-blue-600 mt-1">{selectedIds.size}건</p>
          </div>
          <div className="p-3 bg-blue-50 rounded-lg border border-blue-100">
            <FileCheck className="w-5 h-5 text-blue-600" />
          </div>
        </div>

        <div className="bg-white p-4 rounded-xl border border-gray-200 shadow-sm flex items-center justify-between">
          <div>
            <p className="text-xs font-semibold text-gray-400 uppercase tracking-wider">검색 필터 적용 건</p>
            <p className="text-2xl font-extrabold text-gray-700 mt-1">{filteredTasks.length}건</p>
          </div>
          <div className="p-3 bg-gray-50 rounded-lg border border-gray-200">
            <Sparkles className="w-5 h-5 text-gray-500" />
          </div>
        </div>
      </div>

      {/* Control & Toolbar */}
      <div className="bg-white p-4 rounded-xl border border-gray-200 shadow-sm space-y-4">
        <div className="flex flex-col md:flex-row gap-4 items-center justify-between">
          <div className="relative w-full md:w-80">
            <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
            <Input
              value={keyword}
              onChange={(e) => setKeyword(e.target.value)}
              placeholder="도서명, ISBN, Task ID 검색"
              className="pl-9"
            />
          </div>

          {/* Master Bulk Setting Toolbar */}
          <div className="flex flex-wrap items-center gap-2 bg-blue-50/70 p-2 rounded-lg border border-blue-100 w-full md:w-auto">
            <div className="flex items-center text-xs font-bold text-blue-900 mr-1">
              <Sliders className="w-3.5 h-3.5 mr-1" />
              선택항목 일괄 설정:
            </div>
            <Select value={masterDecision} onValueChange={setMasterDecision}>
              <SelectTrigger className="h-8 text-xs bg-white w-32">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {DECISION_OPTIONS.map((opt) => (
                  <SelectItem key={opt.value} value={opt.value}>
                    {opt.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>

            <Select value={masterGrade} onValueChange={setMasterGrade}>
              <SelectTrigger className="h-8 text-xs bg-white w-24">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {GRADE_OPTIONS.map((opt) => (
                  <SelectItem key={opt.value} value={opt.value}>
                    {opt.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>

            <Select value={masterReason} onValueChange={setMasterReason}>
              <SelectTrigger className="h-8 text-xs bg-white w-36">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {REASON_OPTIONS.map((grp) => (
                  <React.Fragment key={grp.group}>
                    <div className="px-2 py-1 text-[10px] font-bold text-gray-400 bg-gray-50">{grp.group}</div>
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
              variant="secondary"
              onClick={handleApplyMasterSettings}
              disabled={selectedIds.size === 0}
              className="h-8 text-xs font-semibold"
            >
              적용
            </Button>
          </div>
        </div>
      </div>

      {/* Main Table */}
      <div className="bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden">
        {loading ? (
          <div className="p-12 text-center text-gray-400 text-sm">데이터를 불러오는 중...</div>
        ) : filteredTasks.length === 0 ? (
          <div className="p-12 text-center text-gray-400 text-sm">대기 중인 검수 건이 없습니다.</div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm text-left">
              <thead className="bg-gray-50 text-gray-600 border-b border-gray-200 text-xs font-semibold">
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
                  <th className="p-3 w-56">도서 정보 / ISBN</th>
                  <th className="p-3 w-40">처분 결정 (Decision)</th>
                  <th className="p-3 w-28">목표 등급</th>
                  <th className="p-3 w-44">사유 코드 (Reason)</th>
                  <th className="p-3">관리자 사유 메모</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100 text-xs">
                {filteredTasks.map((t) => {
                  const isSelected = selectedIds.has(t.id);
                  const hasImage = t.image_urls && t.image_urls.length > 0;
                  const firstImage = hasImage ? t.image_urls[0] : t.cover_image_url;

                  return (
                    <tr
                      key={t.id}
                      className={`transition-colors ${isSelected ? "bg-blue-50/40" : "hover:bg-gray-50/80"}`}
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
                          className="relative w-14 h-18 bg-gray-100 rounded border border-gray-200 overflow-hidden cursor-pointer group shadow-sm"
                          onClick={() => setModalTask(t)}
                          title="클릭하여 원본 이미지 및 결함 박스 확대보기"
                        >
                          {firstImage ? (
                            <img src={firstImage} alt="book" className="w-full h-full object-cover" />
                          ) : (
                            <div className="w-full h-full flex items-center justify-center text-[10px] text-gray-400">
                              No Img
                            </div>
                          )}
                          <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 flex items-center justify-center transition-opacity">
                            <Maximize2 className="w-4 h-4 text-white" />
                          </div>
                        </div>
                      </td>

                      <td className="p-3">
                        <div className="font-bold text-gray-900 line-clamp-1">{t.book_title || "도서 정보 없음"}</div>
                        <div className="text-gray-500 font-mono text-[11px] mt-0.5">ISBN: {t.isbn || "-"}</div>
                        <div className="text-gray-400 font-mono text-[10px] mt-0.5">Task: {t.id.slice(0, 8)}...</div>
                        {t.ubci_score !== undefined && (
                          <span className="inline-block mt-1 bg-amber-100 text-amber-800 text-[10px] font-semibold px-1.5 py-0.5 rounded">
                            UBCI: {t.ubci_score}점
                          </span>
                        )}
                      </td>

                      <td className="p-3">
                        <Select
                          disabled={!isSelected}
                          value={decisions[t.id] || "APPROVE_DOWNGRADE"}
                          onValueChange={(val) => setDecisions({ ...decisions, [t.id]: val })}
                        >
                          <SelectTrigger className="w-full h-8 text-xs bg-white">
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
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
                          onValueChange={(val) => setGrades({ ...grades, [t.id]: val })}
                        >
                          <SelectTrigger className="w-full h-8 text-xs bg-white">
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
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
                          onValueChange={(val) => setReasons({ ...reasons, [t.id]: val })}
                        >
                          <SelectTrigger className="w-full h-8 text-xs bg-white">
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            {REASON_OPTIONS.map((grp) => (
                              <React.Fragment key={grp.group}>
                                <div className="px-2 py-1 text-[10px] font-bold text-gray-400 bg-gray-50">{grp.group}</div>
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
                          placeholder="사유 메모 (선택)"
                          value={comments[t.id] || ""}
                          onChange={(e) => setComments({ ...comments, [t.id]: e.target.value })}
                          className="h-8 text-xs bg-white"
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

      {/* Image Zoom Modal */}
      <HitlImageModal task={modalTask} onClose={() => setModalTask(null)} />
    </div>
  );
}

function ShieldIcon(props: React.SVGProps<SVGSVGElement>) {
  return (
    <svg
      {...props}
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      viewBox="0 0 24 24"
    >
      <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" />
    </svg>
  );
}
