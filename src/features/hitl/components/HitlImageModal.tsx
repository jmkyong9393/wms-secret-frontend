"use client";

import { useState } from "react";
import { X, ChevronLeft, ChevronRight, Eye, BookOpen, AlertCircle, Bot, ScanSearch } from "lucide-react";
import { Button } from "@/components/ui/button";
import { bboxToPercent } from "@/features/inspection/utils/inspectionImageService";
import type { HitlTask } from "@/features/hitl/types/hitl";

interface HitlImageModalProps {
  task: HitlTask | null;
  onClose: () => void;
}

/** 파이프라인 노드별 서술 표시 정의 (agent_logs 키와 1:1) */
const AGENT_LOG_STEPS = [
  { key: "detector_text", label: "Detector (YOLO)", icon: "🔬" },
  { key: "vision_text", label: "Vision Agent", icon: "👁️" },
  { key: "policy_text", label: "Policy Agent", icon: "📜" },
  { key: "critic_text", label: "Critic Agent", icon: "🛡️" },
  { key: "supervisor_rationale", label: "Supervisor", icon: "🧭" },
  { key: "report_text", label: "Report Agent", icon: "💬" },
] as const;

/** defect_coordinates의 두 가지 포맷(Per-Image/Flat)에서 특정 이미지의 BBox 목록을 추출 */
function bboxesForIndex(rawList: any[], idx: number, imageUrl: string): any[] {
  const out: any[] = [];
  rawList.forEach((item: any) => {
    // 1) 구조화된 Per-Image 포맷: { image_index: 0, bboxes: [...] }
    if (item.image_index !== undefined && Number(item.image_index) === idx && Array.isArray(item.bboxes)) {
      out.push(...item.bboxes);
    } else if (item.image_url !== undefined && item.image_url === imageUrl && Array.isArray(item.bboxes)) {
      out.push(...item.bboxes);
    }
    // 2) 평탄화(Flat) BBox 포맷: { image_idx: 0, xmin: ..., ymin: ... }
    else if (item.xmin !== undefined && item.ymin !== undefined) {
      if (item.image_idx !== undefined && Number(item.image_idx) === idx) {
        out.push(item);
      } else if (item.image_index !== undefined && Number(item.image_index) === idx) {
        out.push(item);
      } else if (item.image_idx === undefined && item.image_index === undefined) {
        out.push(item);
      }
    }
  });
  return out;
}

export function HitlImageModal({ task, onClose }: HitlImageModalProps) {
  const [currentIdx, setCurrentIdx] = useState(0);
  const [showOverlay, setShowOverlay] = useState(true);
  // WBF YOLO 사전탐지 후보 레이어. Vision 확정 결함과 별도로 껐다 켠다 - 결재자가
  // "AI가 무엇을 보고 무엇을 기각했는지"까지 대조해야 판단이 빨라지기 때문.
  const [showYolo, setShowYolo] = useState(false);
  // [2026-08-05] 서빙 conf는 VLM 힌트용으로 의도적으로 낮다(0.12~0.25). 그 원시 후보를
  // 전부 그리면 저신뢰 오탐이 화면을 뒤덮어 결재자의 모델 신뢰를 깎으므로, 표시 기본값은
  // conf 0.4 이상으로 제한하고 저신뢰 대역은 별도 토글로만 연다 (데이터는 그대로 보존).
  const [showLowConfYolo, setShowLowConfYolo] = useState(false);
  const [imgError, setImgError] = useState(false);
  const [isZoomed, setIsZoomed] = useState(false);
  // Vision Agent가 "도서 미식별"로 판정한 컷은 기본으로 숨긴다 (증거 보존을 위해 토글로 열람 가능)
  const [hideInvalid, setHideInvalid] = useState(true);

  if (!task) return null;

  const images = task.image_urls && task.image_urls.length > 0 ? task.image_urls : [];
  const rawList: any[] = task.agent_logs?.defect_coordinates || [];
  const logs: Record<string, any> = task.agent_logs || {};
  const agentEntries = AGENT_LOG_STEPS.filter((s) => typeof logs[s.key] === "string" && logs[s.key].trim().length > 0);

  // [2026-08-04 조장 승인 확장] Vision Agent(GPT-4o) 산출 invalid_image_indexes —
  // 도서가 식별되지 않는 촬영 컷(얼굴만 찍힘, 빈 배경 등)의 자동 필터링 근거
  const invalidSet = new Set<number>(
    (Array.isArray(logs.invalid_image_indexes) ? logs.invalid_image_indexes : [])
      .map(Number)
      .filter((n: number) => Number.isInteger(n) && n >= 0 && n < images.length)
  );
  const allIdx = images.map((_, i) => i);
  const filteredIdx = hideInvalid ? allIdx.filter((i) => !invalidSet.has(i)) : allIdx;
  // 전 컷이 미식별이면 숨길 수 없으므로 전체를 보여준다
  const shownIdx = filteredIdx.length > 0 ? filteredIdx : allIdx;
  const effIdx = shownIdx.includes(currentIdx) ? currentIdx : (shownIdx[0] ?? 0);
  const currentImageUrl = images[effIdx] || "";
  const currentBBoxes = bboxesForIndex(rawList, effIdx, currentImageUrl);
  const navPos = shownIdx.indexOf(effIdx);

  // WBF 3-YOLO 앙상블 사전탐지 후보 (Vision이 채택하지 않은 것도 포함)
  const YOLO_DISPLAY_CONF = 0.4;
  const yoloCandidates: any[] = Array.isArray(logs.yolo_candidates) ? logs.yolo_candidates : [];
  const allYoloBoxes = yoloCandidates
    .filter((c) => Number(c?.image_index ?? 0) === effIdx && c?.bbox)
    .map((c) => ({
      xmin: c.bbox.xmin,
      ymin: c.bbox.ymin,
      xmax: c.bbox.xmax,
      ymax: c.bbox.ymax,
      coord_space: 1000,
      type: c.type,
      label: c.type || "YOLO 후보",
      confidence: c.confidence,
      isLowConf: typeof c.confidence === "number" && c.confidence < YOLO_DISPLAY_CONF,
    }));
  const lowConfCount = allYoloBoxes.filter((b) => b.isLowConf).length;
  const currentYoloBoxes = showLowConfYolo ? allYoloBoxes : allYoloBoxes.filter((b) => !b.isLowConf);

  return (
    <>
      <div
        className="fixed inset-0 z-50 bg-gray-900/60 backdrop-blur-sm flex items-center justify-center p-4 transition-all"
        onClick={onClose}
      >
        <div
          className="bg-white dark:bg-gray-900 rounded-2xl shadow-2xl border border-gray-200 dark:border-gray-800 w-full max-w-6xl max-h-[90vh] flex flex-col overflow-hidden text-gray-900 dark:text-gray-100"
          onClick={(e) => e.stopPropagation()}
        >
          {/* Header */}
          <div className="flex items-center justify-between px-6 py-4 border-b border-gray-100 dark:border-gray-800 bg-gray-50/50 dark:bg-gray-900">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-blue-50 dark:bg-blue-950 text-blue-600 dark:text-blue-400 rounded-lg border border-blue-100 dark:border-blue-900">
                <BookOpen className="w-5 h-5" />
              </div>
              <div>
                <h3 className="text-base font-bold text-gray-900 dark:text-white line-clamp-1">
                  결함 원본 이미지 검수 — {task.book_title || "도서"}
                </h3>
                <p className="text-xs text-gray-500 dark:text-gray-400 mt-0.5 font-mono">
                  ISBN: {task.isbn || "-"} | Task ID: {task.id.slice(0, 8)}...
                </p>
              </div>
            </div>
            <div className="flex items-center gap-3">
              <Button
                variant="outline"
                size="sm"
                className="text-xs font-semibold bg-gray-50 hover:bg-gray-100"
                onClick={() => setIsZoomed(true)}
              >
                <Eye className="w-3.5 h-3.5 mr-1.5 text-purple-600" />
                🔍 고화질 확대 검수
              </Button>
              <Button
                variant="outline"
                size="sm"
                className="text-xs font-semibold"
                onClick={() => setShowOverlay(!showOverlay)}
              >
                <Eye className="w-3.5 h-3.5 mr-1.5 text-blue-600" />
                {showOverlay ? "AI 결함 영역 숨기기" : "AI 결함 영역 표시"}
              </Button>
              <Button
                variant="outline"
                size="sm"
                disabled={yoloCandidates.length === 0}
                className="text-xs font-semibold"
                onClick={() => setShowYolo(!showYolo)}
                title="WBF 3-YOLO 앙상블 사전탐지 후보 (Vision이 채택하지 않은 것 포함)"
              >
                <ScanSearch className="w-3.5 h-3.5 mr-1.5 text-amber-600" />
                YOLO 후보 {yoloCandidates.length}건 {showYolo ? "숨기기" : "보기"}
              </Button>
              {showYolo && lowConfCount > 0 && (
                <Button
                  variant="outline"
                  size="sm"
                  className="text-xs font-semibold text-gray-500"
                  onClick={() => setShowLowConfYolo(!showLowConfYolo)}
                  title={`신뢰도 ${Math.round(YOLO_DISPLAY_CONF * 100)}% 미만의 고재현율(High-Recall) 원시 후보 - VLM 힌트용이라 오탐이 많음`}
                >
                  저신뢰 {lowConfCount}건 {showLowConfYolo ? "숨기기" : "표시"}
                </Button>
              )}
              <button
                onClick={onClose}
                className="p-1.5 rounded-full hover:bg-gray-200 text-gray-400 hover:text-gray-700 transition-colors"
              >
                <X className="w-5 h-5" />
              </button>
            </div>
          </div>

          {/* Main Content: 이미지 뷰어 + Agent 판정 로그 사이드 패널 */}
          <div className="flex-1 flex flex-col lg:flex-row overflow-hidden">
          {/* Main Image View Area */}
          <div className="flex-1 overflow-hidden relative bg-gray-950 flex items-center justify-center min-h-[420px] p-4">
            {!imgError && currentImageUrl ? (
              <div
                className="relative max-w-full max-h-[65vh] inline-block cursor-zoom-in group"
                onClick={() => setIsZoomed(true)}
                title="클릭하여 고화질 2.5X 정밀 확대보기"
              >
                <img
                  src={currentImageUrl}
                  alt={`defect-${effIdx}`}
                  onError={() => setImgError(true)}
                  className="max-w-full max-h-[65vh] w-auto h-auto object-contain rounded shadow-lg group-hover:opacity-95 transition-opacity block"
                />
                <div className="absolute bottom-3 right-3 bg-black/70 backdrop-blur-md text-white text-xs px-3 py-1.5 rounded-lg opacity-0 group-hover:opacity-100 transition-opacity font-extrabold flex items-center gap-1.5 shadow-xl pointer-events-none">
                  <span>🔍 클릭하여 확대검수</span>
                </div>
                {/* YOLO 사전탐지 후보 - 주황 점선. Vision이 기각한 것도 포함되어 있어
                    결재자가 "AI가 무엇을 보고 무엇을 걸렀는지"를 대조할 수 있다. */}
                {showYolo &&
                  currentYoloBoxes.map((box: any, idx: number) => {
                    const { left, top, width, height } = bboxToPercent(box);
                    return (
                      <div
                        key={`y-${idx}`}
                        className={`absolute border-2 border-dashed rounded pointer-events-none z-10 ${
                          box.isLowConf
                            ? "border-gray-400/70 bg-gray-400/5"
                            : "border-amber-400 bg-amber-400/10"
                        }`}
                        style={{ left: `${left}%`, top: `${top}%`, width: `${width}%`, height: `${height}%` }}
                      >
                        <span
                          className={`absolute -bottom-6 left-0 text-white text-[10px] px-2 py-0.5 font-bold rounded whitespace-nowrap ${
                            box.isLowConf ? "bg-gray-500/90" : "bg-amber-500"
                          }`}
                        >
                          {box.isLowConf ? "저신뢰 후보" : "YOLO 후보"}: {box.type}
                          {box.confidence ? ` (${Math.round(box.confidence * 100)}%)` : ""}
                        </span>
                      </div>
                    );
                  })}

                {showOverlay &&
                  currentBBoxes.map((box: any, idx: number) => {
                    // [수정 이력] 좌표계를 값 크기로 추측(xmin>1이면 1000, ...)하던 로직을 제거했다.
                    // xmin이 0인 결함은 스케일이 100으로 잘못 잡히는 등 좌표가 어긋났다.
                    // 백엔드가 coord_space를 명시해 내려주므로 공용 유틸이 그대로 환산한다.
                    const { left, top, width, height } = bboxToPercent(box);
                    const label = box.label || box.type || `결함 #${idx + 1}`;

                    return (
                      <div
                        key={idx}
                        className="absolute border-2 border-red-500 bg-red-500/30 rounded shadow-lg animate-pulse pointer-events-none"
                        style={{
                          left: `${left}%`,
                          top: `${top}%`,
                          width: `${width}%`,
                          height: `${height}%`,
                        }}
                      >
                        <span className="absolute -top-6 left-0 bg-red-600 text-white text-[10px] px-2 py-0.5 font-extrabold rounded shadow-md whitespace-nowrap z-10">
                          {label}
                        </span>
                      </div>
                    );
                  })}
              </div>
            ) : (
              /* Fallback Graphic when external image fails or is missing */
              <div className="relative w-72 h-96 bg-gray-900 border-2 border-dashed border-gray-700 rounded-xl flex flex-col items-center justify-center p-6 text-center shadow-inner">
                <div className="w-16 h-16 rounded-full bg-red-500/10 border border-red-500/30 flex items-center justify-center mb-4">
                  <AlertCircle className="w-8 h-8 text-red-400" />
                </div>
                <h4 className="text-sm font-bold text-gray-200">{task.book_title || "검수 이미지"}</h4>
                <p className="text-xs text-gray-400 mt-1 font-mono">ISBN: {task.isbn || "-"}</p>
                <p className="text-[11px] text-amber-400 mt-3 bg-amber-950/60 px-3 py-1 rounded border border-amber-800/40">
                  AI 비전 탐지 샘플 이미지 모드
                </p>

                {/* Virtual Defect Overlay on Fallback Canvas */}
                {showOverlay &&
                  currentBBoxes.map((box: any, idx: number) => (
                    <div
                      key={idx}
                      className="absolute border-2 border-red-500 bg-red-500/30 rounded animate-pulse"
                      style={{
                        left: `${box.xmin || 20}%`,
                        top: `${box.ymin || 20}%`,
                        width: `${(box.xmax || 50) - (box.xmin || 20)}%`,
                        height: `${(box.ymax || 50) - (box.ymin || 20)}%`,
                      }}
                    >
                      <span className="absolute -top-5 left-0 bg-red-600 text-white text-[10px] px-1.5 py-0.5 font-bold rounded shadow-sm">
                        {box.label || `결함 #${idx + 1}`}
                      </span>
                    </div>
                  ))}
              </div>
            )}

            {/* Navigation Controls — 숨김 처리된 미식별 컷은 순회에서 제외 */}
            {shownIdx.length > 1 && (
              <>
                <button
                  onClick={() => {
                    setImgError(false);
                    setCurrentIdx(shownIdx[(navPos - 1 + shownIdx.length) % shownIdx.length]);
                  }}
                  className="absolute left-4 p-2.5 rounded-full bg-white/80 text-gray-800 hover:bg-white transition-all shadow-md"
                >
                  <ChevronLeft className="w-5 h-5" />
                </button>
                <button
                  onClick={() => {
                    setImgError(false);
                    setCurrentIdx(shownIdx[(navPos + 1) % shownIdx.length]);
                  }}
                  className="absolute right-4 p-2.5 rounded-full bg-white/80 text-gray-800 hover:bg-white transition-all shadow-md"
                >
                  <ChevronRight className="w-5 h-5" />
                </button>
              </>
            )}
          </div>

          {/*
            Agent 판정 로그 사이드 패널 — 관리자가 이미지와 AI 판정 근거를 한 화면에서
            대조하며 결재할 수 있게 한다 (하단 실시간 로그 패널과 달리 이 건의 DB 기록 기반).
          */}
          <aside className="w-full lg:w-96 shrink-0 border-t lg:border-t-0 lg:border-l border-gray-100 dark:border-gray-800 bg-gray-50/70 dark:bg-gray-900 p-4 overflow-y-auto max-h-56 lg:max-h-none space-y-3">
            <h4 className="text-xs font-black text-gray-700 dark:text-gray-300 uppercase tracking-wide flex items-center gap-1.5">
              <Bot className="w-4 h-4 text-purple-600 dark:text-purple-400" />
              Multi-Agent 판정 근거 (DB 기록)
            </h4>

            {/* 현재 이미지 결함 요약 */}
            <div
              className={`p-2.5 rounded-lg border text-[11px] font-bold ${
                invalidSet.has(effIdx)
                  ? "bg-amber-50 dark:bg-amber-950/60 text-amber-800 dark:text-amber-300 border-amber-200 dark:border-amber-800"
                  : currentBBoxes.length > 0
                  ? "bg-rose-50 dark:bg-rose-950/60 text-rose-800 dark:text-rose-300 border-rose-200 dark:border-rose-800"
                  : "bg-gray-100 dark:bg-gray-800 text-gray-600 dark:text-gray-300 border-gray-200 dark:border-gray-700"
              }`}
            >
              현재 이미지 #{effIdx + 1}: {invalidSet.has(effIdx)
                ? "👤 도서 미식별 컷 (Vision Agent 판정 — 결함 판정 제외 대상)"
                : currentBBoxes.length > 0
                ? `결함 BBox ${currentBBoxes.length}건 검출`
                : "AI 결함 미검출"}
            </div>

            {agentEntries.length === 0 ? (
              <div className="p-3 bg-amber-50 dark:bg-amber-950/40 border border-amber-200 dark:border-amber-800 rounded-lg text-[11px] text-amber-900 dark:text-amber-200 leading-relaxed">
                이 건에는 저장된 Agent 판정 서술이 없습니다. 목록의 <strong>[AI 재검수]</strong>를
                실행하면 각 Agent의 판정 근거가 DB에 기록되어 여기에 표시됩니다.
              </div>
            ) : (
              <div className="space-y-2">
                {agentEntries.map((s) => (
                  <div key={s.key} className="p-2.5 bg-white dark:bg-gray-800/70 border border-gray-200 dark:border-gray-700 rounded-lg">
                    <p className="text-[11px] font-black text-purple-700 dark:text-purple-400 mb-1">
                      {s.icon} {s.label}
                    </p>
                    <p className="text-[11px] text-gray-700 dark:text-gray-300 leading-relaxed whitespace-pre-wrap">
                      {logs[s.key]}
                    </p>
                  </div>
                ))}
              </div>
            )}

            {typeof logs.retry_count === "number" && logs.retry_count > 0 && (
              <p className="text-[11px] font-bold text-amber-700 dark:text-amber-300">
                ⟳ 파이프라인 재검수 {logs.retry_count}회 수행됨
              </p>
            )}
          </aside>
          </div>

          {/* Footer & Notes Section */}
          <div className="px-6 py-4 bg-gray-50 dark:bg-gray-900 border-t border-gray-100 dark:border-gray-800 flex flex-col gap-3">
            {/* AI Special Notes Badge */}
            {task.special_notes && (
              <div className="flex items-center gap-2 px-3.5 py-2 bg-amber-50 dark:bg-amber-950/60 border border-amber-200 dark:border-amber-800 rounded-lg text-xs text-amber-900 dark:text-amber-200">
                <span className="font-bold bg-amber-200/80 dark:bg-amber-900 px-2 py-0.5 rounded text-[11px] text-amber-950 dark:text-amber-200">
                  AI 시각 특이사항 (special_notes)
                </span>
                <span className="line-clamp-1">{task.special_notes}</span>
              </div>
            )}

            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2 overflow-x-auto py-1">
                {shownIdx.map((idx) => {
                  const url = images[idx];
                  // 썸네일마다 결함 건수를 표기해, 결함 없는 촬영 컷을 열어보지 않고 건너뛸 수 있게 한다.
                  const cnt = bboxesForIndex(rawList, idx, url).length;
                  const isInvalid = invalidSet.has(idx);
                  return (
                    <button
                      key={idx}
                      onClick={() => {
                        setImgError(false);
                        setCurrentIdx(idx);
                      }}
                      title={isInvalid ? "도서 미식별 컷 (Vision Agent 판정)" : cnt > 0 ? `결함 ${cnt}건 검출` : "AI 결함 미검출"}
                      className={`relative w-12 h-16 rounded overflow-hidden border-2 transition-all bg-gray-200 dark:bg-gray-800 shrink-0 ${
                        effIdx === idx ? "border-blue-600 ring-2 ring-blue-100 dark:ring-blue-900 scale-105" : "border-gray-200 dark:border-gray-700 opacity-60 hover:opacity-100"
                      }`}
                    >
                      <img
                        src={url}
                        alt={`thumb-${idx}`}
                        className={`w-full h-full object-cover ${isInvalid ? "grayscale opacity-50" : ""}`}
                        onError={(e) => {
                          (e.target as HTMLElement).style.display = "none";
                        }}
                      />
                      {cnt > 0 && (
                        <span className="absolute top-0.5 right-0.5 min-w-4 h-4 px-0.5 bg-red-600 text-white text-[9px] font-black rounded-full flex items-center justify-center shadow z-10">
                          {cnt}
                        </span>
                      )}
                      {isInvalid && (
                        <span className="absolute bottom-0 inset-x-0 bg-amber-500/95 text-white text-[8px] font-black text-center py-0.5 z-10">
                          미식별
                        </span>
                      )}
                    </button>
                  );
                })}

                {/* 도서 미식별 컷 자동 필터 토글 (Vision Agent invalid_image_indexes 기반) */}
                {invalidSet.size > 0 && (
                  <button
                    onClick={() => setHideInvalid(!hideInvalid)}
                    className="shrink-0 px-2.5 py-1.5 rounded-lg border border-dashed border-amber-400 dark:border-amber-700 bg-amber-50 dark:bg-amber-950/50 text-amber-800 dark:text-amber-300 text-[10px] font-black hover:bg-amber-100 dark:hover:bg-amber-900/60 transition-colors"
                    title="Vision Agent가 도서를 식별하지 못한 컷 (얼굴/빈 배경 등)"
                  >
                    {hideInvalid ? `👤 미식별 ${invalidSet.size}컷 숨김 · 보기` : `👤 미식별 ${invalidSet.size}컷 표시 중 · 숨기기`}
                  </button>
                )}
              </div>

              <div className="text-right text-xs text-gray-500 dark:text-gray-400">
                <div className="flex items-center justify-end gap-2">
                  {task.inspection_type && (
                    <span className={`px-2 py-0.5 text-[11px] font-bold rounded ${
                      task.inspection_type === "BUYBACK" ? "bg-purple-100 dark:bg-purple-950 text-purple-700 dark:text-purple-300 border border-purple-200 dark:border-purple-800" : "bg-blue-100 dark:bg-blue-950 text-blue-700 dark:text-blue-300 border border-blue-200 dark:border-blue-800"
                    }`}>
                      {task.inspection_type === "BUYBACK" ? "중고 바이백 정산" : "고객 반품 환불"}
                    </span>
                  )}
                  <span>이미지 <strong className="text-gray-900 dark:text-white">{shownIdx.length > 0 ? navPos + 1 : 0}</strong> / {shownIdx.length}{invalidSet.size > 0 && hideInvalid ? ` (미식별 ${invalidSet.size}컷 제외)` : ""}</span>
                </div>
                {task.ubci_score !== undefined && (
                  <div className="mt-1 text-blue-600 dark:text-blue-400 font-bold">
                    UBCI 점수: <span className="text-sm">{task.ubci_score}</span>점
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* High-Resolution Full-Screen Image Lightbox Modal */}
      {isZoomed && currentImageUrl && (
        <div
          className="fixed inset-0 z-[100] bg-black/90 backdrop-blur-md flex items-center justify-center p-4 transition-all"
          onClick={() => setIsZoomed(false)}
        >
          <div className="absolute top-4 right-6 flex items-center gap-3">
            <span className="text-xs text-gray-300 font-mono bg-gray-800/80 px-3 py-1.5 rounded-full border border-gray-700">
              🔍 2.5X 초고화질 정밀 검수 모드 (ESC 또는 클릭하여 닫기)
            </span>
            <button
              onClick={() => setIsZoomed(false)}
              className="p-2 rounded-full bg-gray-800 text-white hover:bg-gray-700 transition-colors shadow-2xl"
            >
              <X className="w-6 h-6" />
            </button>
          </div>

          <div
            className="relative inline-block max-w-[92vw] max-h-[85vh] cursor-zoom-out overflow-auto rounded-xl shadow-2xl border-2 border-gray-700 bg-gray-900"
            onClick={(e) => e.stopPropagation()}
          >
            <img
              src={currentImageUrl}
              alt="enlarged-defect"
              className="h-[82vh] w-auto max-w-[90vw] object-contain rounded-lg block mx-auto"
            />
            {showOverlay &&
              currentBBoxes.map((box: any, idx: number) => {
                const { left, top, width, height } = bboxToPercent(box);
                const label = box.label || box.type || `결함 #${idx + 1}`;

                return (
                  <div
                    key={idx}
                    className="absolute border-2 border-red-500 bg-red-500/35 rounded shadow-2xl animate-pulse pointer-events-none"
                    style={{
                      left: `${left}%`,
                      top: `${top}%`,
                      width: `${width}%`,
                      height: `${height}%`,
                    }}
                  >
                    <span className="absolute -top-7 left-0 bg-red-600 text-white text-xs px-2.5 py-1 font-extrabold rounded shadow-xl whitespace-nowrap border border-red-400 z-20">
                      {label}
                    </span>
                  </div>
                );
              })}
          </div>
        </div>
      )}
    </>
  );
}
