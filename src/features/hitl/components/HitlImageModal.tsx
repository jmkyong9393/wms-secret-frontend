"use client";

import { useState, useRef, useEffect, useCallback } from "react";
import { X, ChevronLeft, ChevronRight, Eye, BookOpen, AlertCircle, Bot, ScanSearch } from "lucide-react";
import { Button } from "@/components/ui/button";
import { bboxToPercent } from "@/features/inspection/utils/inspectionImageService";
import type { HitlTask } from "@/features/hitl/types/hitl";

/**
 * 검수자가 화면에서 고친 판정. 인덱스는 agent_logs의 배열 기준이며, 결재 제출 시
 * 그대로 백엔드로 넘어가 감점이 재산정된다(admin/router.py의 BBox 편집 반영 블록).
 */
export interface EditedBbox {
  xmin: number;
  ymin: number;
  xmax: number;
  ymax: number;
}

export interface BBoxEdits {
  /** 오탐으로 판단해 감점에서 뺄 결함 (agent_logs.defects 인덱스) */
  excluded: number[];
  /** AI가 놓쳤으나 실제 결함으로 채택할 후보 (agent_logs.yolo_candidates 인덱스) */
  adopted: number[];
  /** 검수자가 드래그로 직접 고친 결함 좌표 (agent_logs.defects 인덱스, 0~1000 상대좌표) */
  edited: Record<number, EditedBbox>;
}

export const EMPTY_BBOX_EDITS: BBoxEdits = { excluded: [], adopted: [], edited: {} };

/** 리사이즈 핸들 4개의 위치 키. 드래그 중 어느 모서리를 끄는지 구분한다. */
type HandleCorner = "nw" | "ne" | "sw" | "se";

const clampCoord = (v: number) => Math.max(0, Math.min(1000, Math.round(v)));
/** 드래그로 박스가 한 점으로 찌그러져 사라지는 것을 막는 최소 폭/높이 (0~1000 기준). */
const MIN_BBOX_GAP = 10;

interface HitlImageModalProps {
  task: HitlTask | null;
  onClose: () => void;
  /** 편집 기능을 쓰려면 두 prop을 함께 넘긴다. 없으면 읽기 전용으로 동작한다. */
  edits?: BBoxEdits;
  onEditsChange?: (next: BBoxEdits) => void;
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

export function HitlImageModal({ task, onClose, edits, onEditsChange }: HitlImageModalProps) {
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

  const editable = Boolean(edits && onEditsChange);
  const cur: BBoxEdits = edits ?? EMPTY_BBOX_EDITS;
  const toggle = (list: number[], i: number) =>
    list.includes(i) ? list.filter((x) => x !== i) : [...list, i];
  const toggleExcluded = (i: number) =>
    onEditsChange?.({ ...cur, excluded: toggle(cur.excluded, i) });
  const toggleAdopted = (i: number) =>
    onEditsChange?.({ ...cur, adopted: toggle(cur.adopted, i) });

  // --- BBox 좌표 드래그 편집 (2026-08-08) ---
  // 새 라이브러리(react-konva 등) 없이 기존 % 기반 div 오버레이에 리사이즈 핸들 4개만
  // 얹는다. 드래그 중에는 로컬 state(liveDrag)로만 미리보기하고, 마우스를 떼는 순간에만
  // 부모(cur.edited)로 커밋한다 - 매 mousemove마다 부모 state를 갱신하면 상위 컴포넌트
  // 전체가 리렌더되어 드래그가 버벅인다.
  // 작은 미리보기 뷰와 2.5X 확대 라이트박스 양쪽에서 편집이 가능하므로, 드래그가
  // 시작된 <img> 엘리먼트를 그때그때 가리키는 참조를 둔다(좌표 환산 기준이 서로 다름).
  const smallImgRef = useRef<HTMLImageElement | null>(null);
  const zoomedImgRef = useRef<HTMLImageElement | null>(null);
  const activeImgElRef = useRef<HTMLImageElement | null>(null);
  const [liveDrag, setLiveDrag] = useState<{ defectIndex: number; bbox: EditedBbox } | null>(null);
  const dragStateRef = useRef<{ defectIndex: number; corner: HandleCorner; startBbox: EditedBbox } | null>(null);
  // 이벤트 리스너를 마운트 시 한 번만 붙이기 위해 최신 값을 ref로 미러링한다
  // (매 렌더마다 리스너를 떼고 다시 붙이면 드래그 중 손실이 생길 수 있다).
  const liveDragRef = useRef(liveDrag);
  liveDragRef.current = liveDrag;
  const curRef = useRef(cur);
  curRef.current = cur;
  const onEditsChangeRef = useRef(onEditsChange);
  onEditsChangeRef.current = onEditsChange;

  const applyDrag = useCallback((clientX: number, clientY: number) => {
    const st = dragStateRef.current;
    const imgEl = activeImgElRef.current;
    if (!st || !imgEl) return;
    const rect = imgEl.getBoundingClientRect();
    if (rect.width <= 0 || rect.height <= 0) return;
    const px = clampCoord(((clientX - rect.left) / rect.width) * 1000);
    const py = clampCoord(((clientY - rect.top) / rect.height) * 1000);
    let { xmin, ymin, xmax, ymax } = st.startBbox;
    if (st.corner === "nw") {
      xmin = Math.min(px, xmax - MIN_BBOX_GAP);
      ymin = Math.min(py, ymax - MIN_BBOX_GAP);
    } else if (st.corner === "ne") {
      xmax = Math.max(px, xmin + MIN_BBOX_GAP);
      ymin = Math.min(py, ymax - MIN_BBOX_GAP);
    } else if (st.corner === "sw") {
      xmin = Math.min(px, xmax - MIN_BBOX_GAP);
      ymax = Math.max(py, ymin + MIN_BBOX_GAP);
    } else {
      xmax = Math.max(px, xmin + MIN_BBOX_GAP);
      ymax = Math.max(py, ymin + MIN_BBOX_GAP);
    }
    setLiveDrag({ defectIndex: st.defectIndex, bbox: { xmin, ymin, xmax, ymax } });
  }, []);

  useEffect(() => {
    const onMove = (e: MouseEvent) => {
      if (!dragStateRef.current) return;
      applyDrag(e.clientX, e.clientY);
    };
    const onUp = () => {
      const st = dragStateRef.current;
      const live = liveDragRef.current;
      if (st && live) {
        const c = curRef.current;
        onEditsChangeRef.current?.({
          ...c,
          edited: { ...c.edited, [live.defectIndex]: live.bbox },
        });
      }
      dragStateRef.current = null;
      setLiveDrag(null);
    };
    window.addEventListener("mousemove", onMove);
    window.addEventListener("mouseup", onUp);
    return () => {
      window.removeEventListener("mousemove", onMove);
      window.removeEventListener("mouseup", onUp);
    };
  }, [applyDrag]);

  const startDrag = (
    di: number,
    corner: HandleCorner,
    original: EditedBbox,
    imgElRef: React.RefObject<HTMLImageElement | null>
  ) => (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    activeImgElRef.current = imgElRef.current;
    const start = cur.edited[di] ?? original;
    dragStateRef.current = { defectIndex: di, corner, startBbox: start };
    setLiveDrag({ defectIndex: di, bbox: start });
  };

  /** 편집(드래그 중 미리보기 또는 커밋된 edited)이 있으면 그 좌표로, 없으면 원본 그대로. */
  const effectiveBbox = (di: number | undefined, original: EditedBbox): EditedBbox => {
    if (typeof di !== "number") return original;
    if (liveDrag && liveDrag.defectIndex === di) return liveDrag.bbox;
    return cur.edited[di] ?? original;
  };

  if (!task) return null;

  const images = task.image_urls && task.image_urls.length > 0 ? task.image_urls : [];
  // defect_coordinates에는 오탐 표식이 없다. 같은 결함의 판정 메타(evidence_suspect,
  // conf_copied_from_candidate)는 defects 쪽에 있으므로 좌표로 맞춰 합쳐 준다.
  // 이 표식이 없으면 **증거 대조가 반려한 건도 확정 결함과 똑같이** 빨간 실선으로 보여,
  // 결재자가 이미 기각된 판독을 근거로 결재하게 된다.
  const defectsMeta: any[] = Array.isArray(task.agent_logs?.defects) ? task.agent_logs.defects : [];
  const metaIndexFor = (b: any) =>
    defectsMeta.findIndex(
      (d) =>
        d?.bbox &&
        Number(d.bbox.xmin) === Number(b.xmin) &&
        Number(d.bbox.ymin) === Number(b.ymin) &&
        Number(d.bbox.xmax) === Number(b.xmax) &&
        Number(d.bbox.ymax) === Number(b.ymax)
    );
  const rawList: any[] = (task.agent_logs?.defect_coordinates || []).map((b: any) => {
    const mi = metaIndexFor(b);
    const m = mi >= 0 ? defectsMeta[mi] : null;
    return m
      ? {
          ...b,
          defectIndex: mi,
          evidence_suspect: m.evidence_suspect,
          conf_copied_from_candidate: m.conf_copied_from_candidate,
        }
      : b;
  });
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
    .map((c, candIndex) => ({ c, candIndex }))
    .filter(({ c }) => Number(c?.image_index ?? 0) === effIdx && c?.bbox)
    .map(({ c, candIndex }) => ({
      candIndex,
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
                  ref={smallImgRef}
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
                    // [수정 이력 2026-08-06] 이미지 가장자리 박스의 라벨이 프레임 밖으로 나가
                    // 잘리던 문제 - 가장자리 근처면 박스 안쪽/반대 앵커로 뒤집는다
                    // (admin/inventory/[id] 상세 페이지 오버레이와 동일 규칙).
                    const yoloLabelPos = top + height > 92 ? "bottom-1" : "-bottom-6";
                    const yoloLabelAnchor = left > 50 ? "right-0" : "left-0";
                    // AI가 채택하지 않은 후보를 검수자가 실제 결함으로 승격시킬 수 있다.
                    // (AI 미탐을 사람이 메우는 경로 - 제외의 반대 방향)
                    const adopted = cur.adopted.includes(box.candIndex);
                    return (
                      <div
                        key={`y-${idx}`}
                        onClick={editable ? () => toggleAdopted(box.candIndex) : undefined}
                        title={editable ? (adopted ? "클릭하면 채택 취소" : "클릭하면 결함으로 채택") : undefined}
                        className={[
                          "absolute border-2 rounded z-10",
                          editable ? "cursor-pointer" : "pointer-events-none",
                          adopted
                            ? "border-solid border-red-500 bg-red-500/25 shadow-lg"
                            : box.isLowConf
                              ? "border-dashed border-gray-400/70 bg-gray-400/5"
                              : "border-dashed border-amber-400 bg-amber-400/10",
                        ].join(" ")}
                        style={{ left: `${left}%`, top: `${top}%`, width: `${width}%`, height: `${height}%` }}
                      >
                        <span
                          className={`absolute ${yoloLabelPos} ${yoloLabelAnchor} text-white text-[10px] px-2 py-0.5 font-bold rounded whitespace-nowrap ${
                            adopted ? "bg-red-600" : box.isLowConf ? "bg-gray-500/90" : "bg-amber-500"
                          }`}
                        >
                          {adopted ? "검수자 채택" : box.isLowConf ? "저신뢰 후보" : "YOLO 후보"}: {box.type}
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
                    // 검수자가 직접 제외한 결함. AI 판정(suspect)과 구분해서 보여야
                    // "누가 뺐는지"가 화면에서 드러난다.
                    const di = box.defectIndex;
                    // 드래그로 고친 좌표(또는 드래그 중 미리보기)가 있으면 그걸로 그린다 -
                    // 원본 AI 좌표가 아니라 "지금 확정된" 위치를 화면과 제출값이 항상 같이 본다.
                    const effBox = effectiveBbox(di, {
                      xmin: Number(box.xmin),
                      ymin: Number(box.ymin),
                      xmax: Number(box.xmax),
                      ymax: Number(box.ymax),
                    });
                    const { left, top, width, height } = bboxToPercent({ ...box, ...effBox });
                    const label = box.label || box.type || `결함 #${idx + 1}`;
                    // 상단 8% 이내 박스는 라벨을 박스 안쪽으로 내려 잘림 방지
                    const visionLabelPos = top < 8 ? "top-1" : "-top-6";
                    const visionLabelAnchor = left > 50 ? "right-0" : "left-0";

                    // 증거 대조가 반려했거나 확신도를 제보에서 베낀 판독은 '확정'이 아니다.
                    // 회색 점선으로 낮춰 그려 확정 결함(빨강 실선)과 한눈에 구분되게 한다.
                    const suspect = Boolean(box.evidence_suspect || box.conf_copied_from_candidate);
                    const excluded = typeof di === "number" && cur.excluded.includes(di);
                    const clickable = editable && typeof di === "number";
                    const wasEdited = typeof di === "number" && Boolean(cur.edited[di]);
                    // [2026-08-09] 리사이즈 핸들은 이 작은 뷰에서 뺐다 - 이미지가 작아
                    // 드래그로 정밀 조정이 사실상 불가능했다(실사용 피드백). 좌표 편집은
                    // 2.5X 확대 라이트박스(아래 isZoomed 블록)에서만 하고, 여기서는
                    // 제외/채택 클릭만 남긴다. "🔍 클릭하여 확대검수"가 그 진입점이다.
                    return (
                      <div
                        key={idx}
                        onClick={clickable ? () => toggleExcluded(di) : undefined}
                        title={
                          [
                            // Policy가 이 감점을 어떻게 산정했는지(부위 합산 / 면적 구간 /
                            // 가중치)를 그대로 보여준다. 숫자만 보여주면 결재자가 왜 그
                            // 점수인지 확인할 방법이 없다.
                            box.deduction_note,
                            clickable
                              ? excluded
                                ? "클릭하면 감점에 다시 포함"
                                : "클릭하면 감점에서 제외 · 영역 좌표 수정은 확대검수에서"
                              : null,
                          ]
                            .filter(Boolean)
                            .join("\n") || undefined
                        }
                        className={[
                          "absolute rounded",
                          clickable ? "cursor-pointer" : "pointer-events-none",
                          excluded
                            ? "border-2 border-dashed border-slate-500 bg-slate-500/10 opacity-60"
                            : suspect
                              ? "border-2 border-dashed border-gray-400 bg-gray-400/15"
                              : wasEdited
                                ? "border-2 border-solid border-sky-500 bg-sky-500/25 shadow-lg"
                                : "border-2 border-red-500 bg-red-500/30 shadow-lg animate-pulse",
                        ].join(" ")}
                        style={{
                          left: `${left}%`,
                          top: `${top}%`,
                          width: `${width}%`,
                          height: `${height}%`,
                        }}
                      >
                        {/* 신뢰도를 함께 노출한다. 검수자가 "이 판독을 믿을지"를 판단하는
                            1차 근거인데 종전에는 라벨만 보여, 낮은 신뢰도의 오탐과 확실한
                            결함이 화면에서 구분되지 않았다(YOLO 후보 오버레이에는 이미 있었다). */}
                        <span
                          className={`absolute ${visionLabelPos} ${visionLabelAnchor} ${
                            suspect ? "bg-gray-500" : wasEdited ? "bg-sky-600" : "bg-red-600"
                          } text-white text-[10px] px-2 py-0.5 font-extrabold rounded shadow-md whitespace-nowrap z-10`}
                        >
                          {label}
                          {/* 감점은 유형에 따라 건당이 아니라 부위 묶음으로 산정된다
                              (모서리 마모: 부위 N곳 합산 / 수험서 낙서: -15점 Cap).
                              종전에는 그룹 감점을 상자마다 그대로 찍어, 마모 5건에
                              "-5점"이 5번 떠 총 -25점처럼 읽혔다(실제 감점 -7점). */}
                          {typeof box.deduction === "number"
                            ? box.deduction_scope === "group"
                              ? ` 묶음 -${box.deduction}점`
                              : box.deduction_scope === "excluded"
                                ? " 감점 제외"
                                : ` -${box.deduction}점`
                            : ""}
                          {typeof box.confidence === "number"
                            ? ` (${Math.round(box.confidence * 100)}%${
                                box.conf_source === "vlm" ? " 추정" : ""
                              })`
                            : ""}
                          {box.evidence_suspect ? " · 오탐 의심(감점 제외)" : ""}
                          {box.conf_flat_selfreported
                            ? " · 확신도 미산출"
                            : box.conf_copied_from_candidate
                              ? " · 판독 미검증"
                              : ""}
                          {excluded ? " · 검수자 제외" : ""}
                          {wasEdited ? " · 검수자 영역 수정" : ""}
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
                {/* 증거 대조가 판독을 전건 기각하면 감점이 0이 되어 산식상 100점이 나오지만,
                    그것은 "무결점"이 아니라 "판정 못 함"이다. 점수를 그대로 띄우면 5곳이
                    검출된 책이 화면에서 만점으로 보인다(실측: LPN-260806-A001). */}
                {logs.score_unverified ? (
                  <div className="mt-1 text-amber-600 dark:text-amber-400 font-bold">
                    UBCI 점수: <span className="text-sm">판정 보류</span>
                    <span className="ml-1 font-normal text-[11px]">
                      (증거 대조 전건 반려 — 관리자 확인 필요)
                    </span>
                  </div>
                ) : (
                  task.ubci_score !== undefined && (
                    <div className="mt-1 text-blue-600 dark:text-blue-400 font-bold">
                      UBCI 점수: <span className="text-sm">{task.ubci_score}</span>점
                    </div>
                  )
                )}
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* High-Resolution Full-Screen Image Lightbox Modal — BBox 편집의 실제 작업 화면.
          [2026-08-09] 작은 미리보기에서는 이미지가 작아 모서리 드래그가 실사용 불가능했다
          (조장 피드백). 좌표 편집·제외/채택 클릭 전부 여기로 옮기고, 안내 툴바를 새로 얹었다. */}
      {isZoomed && currentImageUrl && (
        <div
          className="fixed inset-0 z-[100] bg-black/90 backdrop-blur-md flex items-center justify-center p-4 transition-all"
          onClick={() => setIsZoomed(false)}
        >
          <div className="absolute top-4 left-1/2 -translate-x-1/2 flex flex-col items-center gap-1.5 max-w-[92vw]">
            <div className="flex items-center gap-3">
              <span className="text-xs text-gray-300 font-mono bg-gray-800/80 px-3 py-1.5 rounded-full border border-gray-700">
                🔍 2.5X 초고화질 정밀 검수 모드 (ESC 또는 배경 클릭하여 닫기)
              </span>
              <button
                onClick={() => setIsZoomed(false)}
                className="p-2 rounded-full bg-gray-800 text-white hover:bg-gray-700 transition-colors shadow-2xl"
              >
                <X className="w-6 h-6" />
              </button>
            </div>
            {editable && (
              <div
                className="flex flex-wrap items-center justify-center gap-x-3 gap-y-1 text-[11px] text-gray-300 bg-gray-800/80 px-3 py-1.5 rounded-full border border-gray-700"
                onClick={(e) => e.stopPropagation()}
              >
                <span className="flex items-center gap-1">
                  <span className="w-2.5 h-2.5 rounded-sm border-2 border-red-500 bg-red-500/30 inline-block" />
                  확정 결함 (클릭: 제외)
                </span>
                <span className="flex items-center gap-1">
                  <span className="w-2.5 h-2.5 rounded-sm border-2 border-dashed border-slate-500 bg-slate-500/10 inline-block" />
                  제외됨 (클릭: 포함)
                </span>
                <span className="flex items-center gap-1">
                  <span className="w-2.5 h-2.5 rounded-sm border-2 border-sky-500 bg-sky-500/25 inline-block" />
                  좌표 수정됨
                </span>
                {showYolo && (
                  <span className="flex items-center gap-1">
                    <span className="w-2.5 h-2.5 rounded-sm border-2 border-dashed border-amber-400 bg-amber-400/10 inline-block" />
                    YOLO 후보 (클릭: 채택)
                  </span>
                )}
                <span className="text-gray-500">·</span>
                <span>흰 원(●) 드래그로 영역 크기/위치 수정</span>
              </div>
            )}
          </div>

          <div
            className="relative inline-block max-w-[92vw] max-h-[85vh] overflow-auto rounded-xl shadow-2xl border-2 border-gray-700 bg-gray-900"
            onClick={(e) => e.stopPropagation()}
          >
            <img
              ref={zoomedImgRef}
              src={currentImageUrl}
              alt="enlarged-defect"
              className="h-[82vh] w-auto max-w-[90vw] object-contain rounded-lg block mx-auto"
            />

            {showYolo &&
              currentYoloBoxes.map((box: any, idx: number) => {
                const { left, top, width, height } = bboxToPercent(box);
                const yoloLabelPos = top + height > 92 ? "bottom-1" : "-bottom-7";
                const yoloLabelAnchor = left > 50 ? "right-0" : "left-0";
                const adopted = cur.adopted.includes(box.candIndex);
                return (
                  <div
                    key={`zy-${idx}`}
                    onClick={editable ? () => toggleAdopted(box.candIndex) : undefined}
                    title={editable ? (adopted ? "클릭하면 채택 취소" : "클릭하면 결함으로 채택") : undefined}
                    className={[
                      "absolute border-2 rounded",
                      editable ? "cursor-pointer" : "pointer-events-none",
                      adopted
                        ? "border-solid border-red-500 bg-red-500/25 shadow-lg"
                        : box.isLowConf
                          ? "border-dashed border-gray-400/70 bg-gray-400/5"
                          : "border-dashed border-amber-400 bg-amber-400/10",
                    ].join(" ")}
                    style={{ left: `${left}%`, top: `${top}%`, width: `${width}%`, height: `${height}%` }}
                  >
                    <span
                      className={`absolute ${yoloLabelPos} ${yoloLabelAnchor} text-white text-[11px] px-2 py-0.5 font-bold rounded whitespace-nowrap ${
                        adopted ? "bg-red-600" : box.isLowConf ? "bg-gray-500/90" : "bg-amber-500"
                      }`}
                    >
                      {adopted ? "검수자 채택" : box.isLowConf ? "저신뢰 후보" : "YOLO 후보"}: {box.type}
                      {box.confidence ? ` (${Math.round(box.confidence * 100)}%)` : ""}
                    </span>
                  </div>
                );
              })}

            {showOverlay &&
              currentBBoxes.map((box: any, idx: number) => {
                const di = box.defectIndex;
                const effBox = effectiveBbox(di, {
                  xmin: Number(box.xmin),
                  ymin: Number(box.ymin),
                  xmax: Number(box.xmax),
                  ymax: Number(box.ymax),
                });
                const { left, top, width, height } = bboxToPercent({ ...box, ...effBox });
                const label = box.label || box.type || `결함 #${idx + 1}`;
                const zoomLabelPos = top < 8 ? "top-1" : "-top-7";
                const zoomLabelAnchor = left > 50 ? "right-0" : "left-0";
                const suspect = Boolean(box.evidence_suspect || box.conf_copied_from_candidate);
                const excluded = typeof di === "number" && cur.excluded.includes(di);
                const clickable = editable && typeof di === "number";
                const resizable = clickable && !excluded;
                const wasEdited = typeof di === "number" && Boolean(cur.edited[di]);

                return (
                  <div
                    key={idx}
                    onClick={clickable ? () => toggleExcluded(di) : undefined}
                    title={
                      [
                        box.deduction_note,
                        clickable
                          ? excluded
                            ? "클릭하면 감점에 다시 포함"
                            : "클릭하면 감점에서 제외 · 흰 원을 드래그하면 영역 수정"
                          : null,
                      ]
                        .filter(Boolean)
                        .join("\n") || undefined
                    }
                    className={[
                      "absolute rounded shadow-2xl",
                      clickable ? "cursor-pointer" : "pointer-events-none",
                      excluded
                        ? "border-2 border-dashed border-slate-500 bg-slate-500/10 opacity-60"
                        : suspect
                          ? "border-2 border-dashed border-gray-400 bg-gray-400/15"
                          : wasEdited
                            ? "border-2 border-solid border-sky-500 bg-sky-500/25"
                            : "border-2 border-red-500 bg-red-500/35 animate-pulse",
                    ].join(" ")}
                    style={{
                      left: `${left}%`,
                      top: `${top}%`,
                      width: `${width}%`,
                      height: `${height}%`,
                    }}
                  >
                    {resizable &&
                      (["nw", "ne", "sw", "se"] as HandleCorner[]).map((corner) => (
                        <span
                          key={corner}
                          onMouseDown={startDrag(
                            di,
                            corner,
                            {
                              xmin: Number(box.xmin),
                              ymin: Number(box.ymin),
                              xmax: Number(box.xmax),
                              ymax: Number(box.ymax),
                            },
                            zoomedImgRef
                          )}
                          onClick={(e) => e.stopPropagation()}
                          title="드래그해서 결함 영역 수정"
                          className={[
                            "absolute w-4 h-4 rounded-full bg-white z-20 shadow-lg",
                            wasEdited ? "border-2 border-sky-600" : "border-2 border-red-600",
                            corner === "nw" ? "-left-2 -top-2 cursor-nwse-resize" : "",
                            corner === "ne" ? "-right-2 -top-2 cursor-nesw-resize" : "",
                            corner === "sw" ? "-left-2 -bottom-2 cursor-nesw-resize" : "",
                            corner === "se" ? "-right-2 -bottom-2 cursor-nwse-resize" : "",
                          ].join(" ")}
                        />
                      ))}
                    <span
                      className={`absolute ${zoomLabelPos} ${zoomLabelAnchor} ${
                        suspect ? "bg-gray-500" : wasEdited ? "bg-sky-600" : "bg-red-600"
                      } text-white text-xs px-2.5 py-1 font-extrabold rounded shadow-xl whitespace-nowrap border border-white/20 z-10`}
                    >
                      {label}
                      {typeof box.deduction === "number"
                        ? box.deduction_scope === "group"
                          ? ` 묶음 -${box.deduction}점`
                          : box.deduction_scope === "excluded"
                            ? " 감점 제외"
                            : ` -${box.deduction}점`
                        : ""}
                      {excluded ? " · 검수자 제외" : ""}
                      {wasEdited ? " · 검수자 영역 수정" : ""}
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
