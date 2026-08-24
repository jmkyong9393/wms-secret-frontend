"use client";

import type { RawBBox, DefectCoordinateGroup, AgentLogs } from "@/entities/inspection/model/types";
import { useState, useRef, useEffect, useCallback } from "react";
import { X, ChevronLeft, ChevronRight, Eye, BookOpen, AlertCircle, Bot, ScanSearch, PenSquare, Trash2, RotateCcw } from "lucide-react";
import { Button } from "@/shared/ui/button";
import { bboxToPercent } from "@/entities/inspection/api/inspectionImageService";
import type { HitlTask } from "@/features/hitl/types/hitl";
import { DEFECT_TYPE_OPTIONS } from "@/features/hitl/policy";
import { useScorePreview } from "@/features/hitl/hooks/useScorePreview";
import { ScorePreviewPanel } from "@/features/hitl/components/ScorePreviewPanel";

export interface EditedBbox {
  xmin: number;
  ymin: number;
  xmax: number;
  ymax: number;
}

/** 검수자가 직접 그려 넣은 신규 결함 (AI가 놓친 것을 보완). 제출 시 addedBboxes로 전송. */
export interface AddedBbox extends EditedBbox {
  tempId: string;
  type: string;
  imageIndex: number;
}

export interface BBoxEdits {
  /** 오탐으로 판단해 감점에서 뺄 결함 (agent_logs.defects 인덱스) */
  excluded: number[];
  /** AI가 놓쳤으나 실제 결함으로 채택할 후보 (agent_logs.yolo_candidates 인덱스) */
  adopted: number[];
  /** 검수자가 드래그로 직접 고친 결함 좌표 (agent_logs.defects 인덱스, 0~1000 상대좌표) */
  edited: Record<number, EditedBbox>;
  /** 검수자가 직접 그린 신규 결함 목록 */
  added: AddedBbox[];
}

export const EMPTY_BBOX_EDITS: BBoxEdits = { excluded: [], adopted: [], edited: {}, added: [] };

type HandleCorner = "nw" | "ne" | "sw" | "se";
type DragTarget =
  | { kind: "existing"; defectIndex: number }
  | { kind: "added"; tempId: string };

const clampCoord = (v: number) => Math.max(0, Math.min(1000, Math.round(v)));
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
type FlatOrGroup = Partial<DefectCoordinateGroup> & Partial<RawBBox>;

function bboxesForIndex(rawList: FlatOrGroup[], idx: number, imageUrl: string): RawBBox[] {
  const out: RawBBox[] = [];
  rawList.forEach((item) => {
    if (item.image_index !== undefined && Number(item.image_index) === idx && Array.isArray(item.bboxes)) {
      out.push(...item.bboxes);
    } else if (item.image_url !== undefined && item.image_url === imageUrl && Array.isArray(item.bboxes)) {
      out.push(...item.bboxes);
    } else if (item.xmin !== undefined && item.ymin !== undefined) {
      if (item.image_idx !== undefined && Number(item.image_idx) === idx) {
        out.push(item as RawBBox);
      } else if (item.image_index !== undefined && Number(item.image_index) === idx) {
        out.push(item as RawBBox);
      } else if (item.image_idx === undefined && item.image_index === undefined) {
        out.push(item as RawBBox);
      }
    }
  });
  return out;
}

const defectTypeLabel = (type: string) =>
  DEFECT_TYPE_OPTIONS.find((o) => o.value === type)?.label || type;

export function HitlImageModal({ task, onClose, edits, onEditsChange }: HitlImageModalProps) {
  const [currentIdx, setCurrentIdx] = useState(0);
  const [showOverlay, setShowOverlay] = useState(true);
  const [showYolo, setShowYolo] = useState(false);
  // 서빙 conf는 VLM 힌트용으로 의도적으로 낮다 - 저신뢰 대역은 별도 토글로만 연다.
  const [showLowConfYolo, setShowLowConfYolo] = useState(false);
  const [imgError, setImgError] = useState(false);
  const [hideInvalid, setHideInvalid] = useState(true);
  const [sidePanel, setSidePanel] = useState<"defects" | "agent">("defects");
  const [drawMode, setDrawMode] = useState(false);
  const [hoveredKey, setHoveredKey] = useState<string | null>(null);

  const editable = Boolean(edits && onEditsChange);
  const cur: BBoxEdits = edits ?? EMPTY_BBOX_EDITS;
  // 이 값들은 아직 DB에 반영되지 않은 임시 편집분이다 - 목록 화면의 처분결정 제출이 실제 저장 시점.
  const pendingEditCount = cur.excluded.length + cur.adopted.length + Object.keys(cur.edited).length + cur.added.length;
  const hasEdits = pendingEditCount > 0;
  // 편집분의 점수는 서버 Policy Agent가 계산한다 (LLM 미사용이라 호출 비용 없음).
  // 프론트가 UBCI 산식을 흉내 내면 화면과 실제 저장값이 갈린다.
  const scorePreview = useScorePreview(task?.id, edits, editable && hasEdits);

  const toggle = (list: number[], i: number) =>
    list.includes(i) ? list.filter((x) => x !== i) : [...list, i];
  const toggleExcluded = (i: number) =>
    onEditsChange?.({ ...cur, excluded: toggle(cur.excluded, i) });
  const toggleAdopted = (i: number) =>
    onEditsChange?.({ ...cur, adopted: toggle(cur.adopted, i) });
  const removeAdded = (tempId: string) =>
    onEditsChange?.({ ...cur, added: cur.added.filter((a) => a.tempId !== tempId) });

  // BBox 리사이즈 드래그: 로컬 state(liveDrag)로 미리보기하다 mouseup 시점에만 부모로 커밋.
  const imgRef = useRef<HTMLImageElement | null>(null);
  const [liveDrag, setLiveDrag] = useState<{ target: DragTarget; bbox: EditedBbox } | null>(null);
  const dragStateRef = useRef<{
    target: DragTarget;
    mode: HandleCorner | "move";
    startBbox: EditedBbox;
    startPx: number;
    startPy: number;
  } | null>(null);
  const liveDragRef = useRef(liveDrag);
  liveDragRef.current = liveDrag;
  const curRef = useRef(cur);
  curRef.current = cur;
  const onEditsChangeRef = useRef(onEditsChange);
  onEditsChangeRef.current = onEditsChange;

  // 새 결함 그리기: 빈 영역을 드래그하면 사각형이 자라난다.
  const drawStateRef = useRef<{ startPx: number; startPy: number; imageIndex: number } | null>(null);
  const [liveDrawBox, setLiveDrawBox] = useState<EditedBbox | null>(null);
  const liveDrawBoxRef = useRef(liveDrawBox);
  liveDrawBoxRef.current = liveDrawBox;
  const [pendingNewBox, setPendingNewBox] = useState<{ bbox: EditedBbox; imageIndex: number } | null>(null);
  const [pendingType, setPendingType] = useState<string>(DEFECT_TYPE_OPTIONS[0].value);

  const applyDrag = useCallback((clientX: number, clientY: number) => {
    const st = dragStateRef.current;
    const imgEl = imgRef.current;
    if (!st || !imgEl) return;
    const rect = imgEl.getBoundingClientRect();
    if (rect.width <= 0 || rect.height <= 0) return;
    const px = clampCoord(((clientX - rect.left) / rect.width) * 1000);
    const py = clampCoord(((clientY - rect.top) / rect.height) * 1000);
    let { xmin, ymin, xmax, ymax } = st.startBbox;
    if (st.mode === "move") {
      let dx = px - st.startPx;
      let dy = py - st.startPy;
      dx = Math.max(-xmin, Math.min(1000 - xmax, dx));
      dy = Math.max(-ymin, Math.min(1000 - ymax, dy));
      xmin += dx; xmax += dx; ymin += dy; ymax += dy;
    } else if (st.mode === "nw") {
      xmin = Math.min(px, xmax - MIN_BBOX_GAP);
      ymin = Math.min(py, ymax - MIN_BBOX_GAP);
    } else if (st.mode === "ne") {
      xmax = Math.max(px, xmin + MIN_BBOX_GAP);
      ymin = Math.min(py, ymax - MIN_BBOX_GAP);
    } else if (st.mode === "sw") {
      xmin = Math.min(px, xmax - MIN_BBOX_GAP);
      ymax = Math.max(py, ymin + MIN_BBOX_GAP);
    } else {
      xmax = Math.max(px, xmin + MIN_BBOX_GAP);
      ymax = Math.max(py, ymin + MIN_BBOX_GAP);
    }
    setLiveDrag({ target: st.target, bbox: { xmin, ymin, xmax, ymax } });
  }, []);

  const applyDraw = useCallback((clientX: number, clientY: number) => {
    const st = drawStateRef.current;
    const imgEl = imgRef.current;
    if (!st || !imgEl) return;
    const rect = imgEl.getBoundingClientRect();
    if (rect.width <= 0 || rect.height <= 0) return;
    const px = clampCoord(((clientX - rect.left) / rect.width) * 1000);
    const py = clampCoord(((clientY - rect.top) / rect.height) * 1000);
    setLiveDrawBox({
      xmin: Math.min(st.startPx, px),
      xmax: Math.max(st.startPx, px),
      ymin: Math.min(st.startPy, py),
      ymax: Math.max(st.startPy, py),
    });
  }, []);

  useEffect(() => {
    const onMove = (e: MouseEvent) => {
      if (dragStateRef.current) {
        applyDrag(e.clientX, e.clientY);
      } else if (drawStateRef.current) {
        applyDraw(e.clientX, e.clientY);
      }
    };
    const onUp = () => {
      const st = dragStateRef.current;
      const live = liveDragRef.current;
      if (st && live) {
        const c = curRef.current;
        if (live.target.kind === "existing") {
          onEditsChangeRef.current?.({
            ...c,
            edited: { ...c.edited, [live.target.defectIndex]: live.bbox },
          });
        } else {
          const tid = live.target.tempId;
          onEditsChangeRef.current?.({
            ...c,
            added: c.added.map((a) => (a.tempId === tid ? { ...a, ...live.bbox } : a)),
          });
        }
      }
      dragStateRef.current = null;
      setLiveDrag(null);

      const dst = drawStateRef.current;
      const box = liveDrawBoxRef.current;
      if (dst && box && box.xmax - box.xmin >= MIN_BBOX_GAP && box.ymax - box.ymin >= MIN_BBOX_GAP) {
        setPendingNewBox({ bbox: box, imageIndex: dst.imageIndex });
      }
      drawStateRef.current = null;
      setLiveDrawBox(null);
    };
    window.addEventListener("mousemove", onMove);
    window.addEventListener("mouseup", onUp);
    return () => {
      window.removeEventListener("mousemove", onMove);
      window.removeEventListener("mouseup", onUp);
    };
  }, [applyDrag, applyDraw]);

  const startDrag = (target: DragTarget, corner: HandleCorner, original: EditedBbox) => (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    const start =
      target.kind === "existing"
        ? cur.edited[target.defectIndex] ?? original
        : cur.added.find((a) => a.tempId === target.tempId) ?? original;
    const imgEl = imgRef.current;
    const rect = imgEl?.getBoundingClientRect();
    const startPx = rect && rect.width > 0 ? clampCoord(((e.clientX - rect.left) / rect.width) * 1000) : 0;
    const startPy = rect && rect.height > 0 ? clampCoord(((e.clientY - rect.top) / rect.height) * 1000) : 0;
    dragStateRef.current = { target, mode: corner, startBbox: start, startPx, startPy };
    setLiveDrag({ target, bbox: start });
  };

  /** BBox 본체를 눌러 통째로 이동시키는 드래그 (리사이즈와 동일한 커밋 경로를 공유). */
  const startMove = (target: DragTarget, original: EditedBbox) => (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    const imgEl = imgRef.current;
    const rect = imgEl?.getBoundingClientRect();
    if (!rect || rect.width <= 0 || rect.height <= 0) return;
    const start =
      target.kind === "existing"
        ? cur.edited[target.defectIndex] ?? original
        : cur.added.find((a) => a.tempId === target.tempId) ?? original;
    const startPx = clampCoord(((e.clientX - rect.left) / rect.width) * 1000);
    const startPy = clampCoord(((e.clientY - rect.top) / rect.height) * 1000);
    dragStateRef.current = { target, mode: "move", startBbox: start, startPx, startPy };
    setLiveDrag({ target, bbox: start });
  };

  const effectiveBboxFor = (target: DragTarget | null, original: EditedBbox): EditedBbox => {
    if (!target) return original;
    if (liveDrag && dragTargetEquals(liveDrag.target, target)) return liveDrag.bbox;
    if (target.kind === "existing") return cur.edited[target.defectIndex] ?? original;
    return original;
  };

  if (!task) return null;

  const images = task.image_urls && task.image_urls.length > 0 ? task.image_urls : [];
  const defectsMeta: RawBBox[] = Array.isArray(task.agent_logs?.defects) ? task.agent_logs.defects : [];
  // 좌표만으로 결함을 식별하면 서로 다른 컷의 결함이 같은 defectIndex로 묶인다.
  // VLM이 여러 컷에 동일 좌표를 반환하는 경우가 실제로 있고(LPN-260810-A030:
  // 컷 0·1·2 모두 xmin 0 / ymin 0 / xmax 1000 / ymax 100), 그때 한 BBox를 옮기면
  // 나머지 컷의 BBox까지 함께 움직였다. image_index를 매칭 키에 포함한다.
  const bboxEq = (a: { xmin?: number; ymin?: number; xmax?: number; ymax?: number } | null | undefined, b: typeof a) =>
    Number(a?.xmin) === Number(b?.xmin) &&
    Number(a?.ymin) === Number(b?.ymin) &&
    Number(a?.xmax) === Number(b?.xmax) &&
    Number(a?.ymax) === Number(b?.ymax);

  const metaIndexFor = (b: RawBBox, imageIndex: number, used: Set<number>) => {
    // 1순위 — 같은 컷의 결함 중 좌표가 같은 것
    let i = defectsMeta.findIndex(
      (d, idx) =>
        !used.has(idx) && d?.bbox && Number(d.image_index ?? 0) === Number(imageIndex) && bboxEq(d.bbox, b)
    );
    if (i >= 0) return i;
    // 2순위 — image_index가 없는 레거시 결함은 좌표로만 맞춘다. 단 이미 쓴 것은 건너뛴다.
    i = defectsMeta.findIndex(
      (d, idx) => !used.has(idx) && d?.bbox && d.image_index === undefined && bboxEq(d.bbox, b)
    );
    return i;
  };

  // defect_coordinates는 이미지별 그룹({image_index, bboxes:[...]})이라, 그룹이 아니라
  // 그 안의 개별 bboxes[]에 defectIndex를 매칭해야 한다.
  // 한 결함이 두 BBox에 중복 배정되지 않도록 사용한 인덱스를 그룹 간에 공유한다.
  const usedMeta = new Set<number>();
  const rawList = (task.agent_logs?.defect_coordinates || []).map((group) => {
    if (!group || !Array.isArray(group.bboxes)) return group;
    const gi = Number(group.image_index ?? 0);
    return {
      ...group,
      bboxes: group.bboxes.map((b) => {
        const mi = metaIndexFor(b, gi, usedMeta);
        if (mi < 0) return b;
        usedMeta.add(mi);
        const m = defectsMeta[mi];
        return { ...b, defectIndex: mi, evidence_suspect: m.evidence_suspect, conf_copied_from_candidate: m.conf_copied_from_candidate };
      }),
    };
  });
  const logs: AgentLogs = task.agent_logs || {};
  const agentEntries = AGENT_LOG_STEPS.filter((s) => { const v = logs[s.key]; return typeof v === "string" && v.trim().length > 0; });

  const invalidSet = new Set<number>(
    (Array.isArray(logs.invalid_image_indexes) ? logs.invalid_image_indexes : [])
      .map(Number)
      .filter((n: number) => Number.isInteger(n) && n >= 0 && n < images.length)
  );
  const allIdx = images.map((_, i) => i);
  const filteredIdx = hideInvalid ? allIdx.filter((i) => !invalidSet.has(i)) : allIdx;
  const shownIdx = filteredIdx.length > 0 ? filteredIdx : allIdx;
  const effIdx = shownIdx.includes(currentIdx) ? currentIdx : (shownIdx[0] ?? 0);
  const currentImageUrl = images[effIdx] || "";
  const currentBBoxes = bboxesForIndex(rawList, effIdx, currentImageUrl);
  const navPos = shownIdx.indexOf(effIdx);
  const currentAdded = cur.added.filter((a) => a.imageIndex === effIdx);

  const YOLO_DISPLAY_CONF = 0.4;
  const yoloCandidates: RawBBox[] = Array.isArray(logs.yolo_candidates) ? logs.yolo_candidates : [];
  const allYoloBoxes = yoloCandidates
    .map((c, candIndex) => ({ c, candIndex }))
    .filter(({ c }) => Number(c?.image_index ?? 0) === effIdx && c?.bbox)
    .map(({ c, candIndex }) => ({
      candIndex,
      xmin: c.bbox!.xmin,
      ymin: c.bbox!.ymin,
      xmax: c.bbox!.xmax,
      ymax: c.bbox!.ymax,
      coord_space: 1000,
      type: c.type,
      label: c.type || "YOLO 후보",
      confidence: c.confidence,
      isLowConf: typeof c.confidence === "number" && c.confidence < YOLO_DISPLAY_CONF,
    }));
  const lowConfCount = allYoloBoxes.filter((b) => b.isLowConf).length;
  const currentYoloBoxes = showLowConfYolo ? allYoloBoxes : allYoloBoxes.filter((b) => !b.isLowConf);

  const onImageMouseDown = (e: React.MouseEvent) => {
    if (!drawMode || !editable) return;
    e.preventDefault();
    const imgEl = imgRef.current;
    if (!imgEl) return;
    const rect = imgEl.getBoundingClientRect();
    const px = clampCoord(((e.clientX - rect.left) / rect.width) * 1000);
    const py = clampCoord(((e.clientY - rect.top) / rect.height) * 1000);
    drawStateRef.current = { startPx: px, startPy: py, imageIndex: effIdx };
    setLiveDrawBox({ xmin: px, ymin: py, xmax: px, ymax: py });
  };

  const confirmNewBox = () => {
    if (!pendingNewBox) return;
    const added: AddedBbox = {
      tempId: `new-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
      type: pendingType,
      imageIndex: pendingNewBox.imageIndex,
      ...pendingNewBox.bbox,
    };
    onEditsChange?.({ ...cur, added: [...cur.added, added] });
    setPendingNewBox(null);
    setDrawMode(false);
  };

  return (
    <div className="fixed inset-0 z-50 bg-white dark:bg-gray-950 flex flex-col text-gray-900 dark:text-gray-100">
      {/* Header */}
      <div className="flex items-center justify-between px-6 py-3 border-b border-gray-200 dark:border-gray-800 bg-gray-50 dark:bg-gray-900 shrink-0">
        <div className="flex items-center gap-3 min-w-0">
          <div className="p-2 bg-blue-50 dark:bg-blue-950 text-blue-600 dark:text-blue-400 rounded-lg border border-blue-200 dark:border-blue-900 shrink-0">
            <BookOpen className="w-5 h-5" />
          </div>
          <div className="min-w-0">
            <h3 className="text-sm font-bold text-gray-900 dark:text-white line-clamp-1">
              결함 검수 — {task.book_title || "도서"}
            </h3>
            <p className="text-xs text-gray-500 dark:text-gray-400 mt-0.5 font-mono">
              ISBN: {task.isbn || "-"} | Task ID: {task.id.slice(0, 8)}...
            </p>
          </div>
        </div>
        <div className="flex items-center gap-2 shrink-0">
          {editable && (
            <Button
              variant={drawMode ? "default" : "outline"}
              size="sm"
              className="text-xs font-semibold"
              onClick={() => setDrawMode((v) => !v)}
            >
              <PenSquare className="w-3.5 h-3.5 mr-1.5" />
              {drawMode ? "그리기 모드 끄기" : "+ 새 결함 영역 추가"}
            </Button>
          )}
          <Button variant="outline" size="sm" className="text-xs font-semibold" onClick={() => setShowOverlay(!showOverlay)}>
            <Eye className="w-3.5 h-3.5 mr-1.5 text-blue-400" />
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
            <ScanSearch className="w-3.5 h-3.5 mr-1.5 text-amber-400" />
            YOLO 후보 {yoloCandidates.length}건 {showYolo ? "숨기기" : "보기"}
          </Button>
          {showYolo && lowConfCount > 0 && (
            <Button variant="outline" size="sm" className="text-xs font-semibold text-gray-500 dark:text-gray-400" onClick={() => setShowLowConfYolo(!showLowConfYolo)}>
              저신뢰 {lowConfCount}건 {showLowConfYolo ? "숨기기" : "표시"}
            </Button>
          )}
          <button onClick={onClose} className="p-1.5 rounded-full hover:bg-gray-200 dark:hover:bg-gray-800 text-gray-500 dark:text-gray-400 hover:text-gray-900 dark:hover:text-white transition-colors ml-1">
            <X className="w-5 h-5" />
          </button>
        </div>
      </div>

      {/* 저장 시점 안내 - 이 화면의 편집은 로컬 임시 상태다. 실제 DB 반영은 목록 화면의 처분결정 제출 시점. */}
      {editable && (
        <div className="px-6 py-2 bg-amber-50 dark:bg-amber-950/40 border-b border-amber-200 dark:border-amber-800 text-[12px] text-amber-800 dark:text-amber-200 flex items-center gap-2 shrink-0">
          <AlertCircle className="w-3.5 h-3.5 shrink-0" />
          <span>
            여기서 수정한 내용은 이 창을 닫아도 임시 저장 상태입니다. <strong>목록 화면에서 처분결정을 확정·제출해야 DB에 최종 반영</strong>됩니다.
            {pendingEditCount > 0 && <span className="ml-1 font-bold">(현재 미저장 변경 {pendingEditCount}건)</span>}
          </span>
        </div>
      )}

      {/* Main: 이미지 + 우측 패널 */}
      <div className="flex-1 flex overflow-hidden min-h-0">
        {/* Image area */}
        <div className="flex-1 relative bg-gray-100 dark:bg-black flex items-center justify-center p-4 min-w-0">
          {drawMode && (
            <div className="absolute top-3 left-1/2 -translate-x-1/2 z-30 bg-blue-600 text-white text-xs font-bold px-3 py-1.5 rounded-full shadow-xl">
              그리기 모드 — 빈 영역을 드래그해 새 결함 영역을 그리세요
            </div>
          )}
          {!imgError && currentImageUrl ? (
            <div
              // 래퍼에 max-h를 걸면 모달 본문이 80vh보다 낮을 때 래퍼만 잘리고 이미지는
              // 삐져나와, 래퍼 % 기준인 BBox가 전부 위로 밀리고 하단부엔 그릴 수 없게 된다
              // (실측: 세로 촬영 A011). 래퍼는 이미지에 정확히 밀착시키고 높이 상한은
              // 이미지에만 건다 — 오버레이 좌표계 == 이미지 좌표계가 이 화면의 불변식이다.
              className={`relative max-w-full inline-block ${drawMode ? "cursor-crosshair" : ""}`}
              onMouseDown={onImageMouseDown}
            >
              {/* eslint-disable-next-line @next/next/no-img-element -- 서명 URL·외부 CDN·blob 원본은 next/image 서버 최적화를 태울 수 없다 */}
              <img
                ref={imgRef}
                src={currentImageUrl}
                alt={`defect-${effIdx}`}
                onError={() => setImgError(true)}
                // 고정 vh 상한(80vh→72vh)은 화면 높이에 따라 여전히 모달 본문을 넘겨 하단이
                // 잘렸고, 잘린 영역에는 BBox를 그릴 수 없었다(실측: 뒷표지·책등 하단).
                // 헤더+경고띠+패딩+썸네일 스트립 고정 높이(약 240px)를 빼서 항상 본문 안에 들어오게 한다.
                className="max-w-full max-h-[calc(100dvh-240px)] w-auto h-auto object-contain rounded shadow-lg block select-none"
                draggable={false}
              />

              {/* 그리는 중인 임시 사각형 */}
              {liveDrawBox && (() => {
                const { left, top, width, height } = bboxToPercent({ ...liveDrawBox, coord_space: 1000 });
                return (
                  <div
                    className="absolute border-2 border-dashed border-blue-400 bg-blue-400/20 pointer-events-none"
                    style={{ left: `${left}%`, top: `${top}%`, width: `${width}%`, height: `${height}%` }}
                  />
                );
              })()}

              {showYolo &&
                currentYoloBoxes.map((box, idx: number) => {
                  const { left, top, width, height } = bboxToPercent(box);
                  const yoloLabelPos = top + height > 92 ? "bottom-1" : "-bottom-6";
                  const yoloLabelAnchor = left > 50 ? "right-0" : "left-0";
                  const adopted = cur.adopted.includes(box.candIndex);
                  const key = `yolo-${box.candIndex}`;
                  return (
                    <div
                      key={`y-${idx}`}
                      onMouseEnter={() => setHoveredKey(key)}
                      onMouseLeave={() => setHoveredKey((k) => (k === key ? null : k))}
                      className={[
                        "absolute border-2 rounded pointer-events-none transition-shadow",
                        adopted
                          ? "border-solid border-red-500 bg-red-500/25 shadow-lg"
                          : box.isLowConf
                            ? "border-dashed border-gray-400/70 bg-gray-400/5"
                            : "border-dashed border-amber-400 bg-amber-400/10",
                        hoveredKey === key ? "ring-2 ring-white" : "",
                      ].join(" ")}
                      style={{ left: `${left}%`, top: `${top}%`, width: `${width}%`, height: `${height}%` }}
                    >
                      <span
                        className={`absolute ${yoloLabelPos} ${yoloLabelAnchor} text-white text-[10px] px-2 py-0.5 font-bold rounded whitespace-nowrap ${
                          adopted ? "bg-red-600" : box.isLowConf ? "bg-gray-500/90" : "bg-amber-500"
                        }`}
                      >
                        {adopted ? "검수자 채택" : box.isLowConf ? "저신뢰 후보" : "YOLO 후보"}: {box.type}
                      </span>
                    </div>
                  );
                })}

              {showOverlay &&
                currentBBoxes.map((box, idx: number) => {
                  const di = box.defectIndex;
                  const target: DragTarget | null = typeof di === "number" ? { kind: "existing", defectIndex: di } : null;
                  const effBox = effectiveBboxFor(target, {
                    xmin: Number(box.xmin),
                    ymin: Number(box.ymin),
                    xmax: Number(box.xmax),
                    ymax: Number(box.ymax),
                  });
                  const { left, top, width, height } = bboxToPercent({ ...box, ...effBox });
                  const label = box.label || box.type || `결함 #${idx + 1}`;
                  const labelPos = top < 8 ? "top-1" : "-top-6";
                  const labelAnchor = left > 50 ? "right-0" : "left-0";
                  const suspect = Boolean(box.evidence_suspect || box.conf_copied_from_candidate);
                  const excluded = typeof di === "number" && cur.excluded.includes(di);
                  const editableBox = editable && typeof di === "number" && !excluded;
                  const wasEdited = typeof di === "number" && Boolean(cur.edited[di]);
                  const key = `defect-${di}`;
                  return (
                    <div
                      key={idx}
                      onMouseEnter={() => setHoveredKey(key)}
                      onMouseLeave={() => setHoveredKey((k) => (k === key ? null : k))}
                      onMouseDown={
                        editableBox && !drawMode
                          ? startMove(target!, {
                              xmin: Number(box.xmin),
                              ymin: Number(box.ymin),
                              xmax: Number(box.xmax),
                              ymax: Number(box.ymax),
                            })
                          : undefined
                      }
                      title={box.deduction_note || undefined}
                      className={[
                        "absolute rounded transition-shadow",
                        editableBox && !drawMode ? "pointer-events-auto cursor-move" : "pointer-events-none",
                        excluded
                          ? "border-2 border-dashed border-slate-500 bg-slate-500/10 opacity-60"
                          : suspect
                            ? "border-2 border-dashed border-gray-400 bg-gray-400/15"
                            : wasEdited
                              ? "border-2 border-solid border-sky-500 bg-sky-500/25 shadow-lg"
                              : "border-2 border-red-500 bg-red-500/30 shadow-lg",
                        hoveredKey === key ? "ring-2 ring-white" : "",
                      ].join(" ")}
                      style={{
                        left: `${left}%`, top: `${top}%`, width: `${width}%`, height: `${height}%`,
                        zIndex: hoveredKey === key ? 20 : 10,
                      }}
                    >
                      {editableBox &&
                        (["nw", "ne", "sw", "se"] as HandleCorner[]).map((corner) => (
                          <span
                            key={corner}
                            onMouseDown={startDrag(target!, corner, {
                              xmin: Number(box.xmin),
                              ymin: Number(box.ymin),
                              xmax: Number(box.xmax),
                              ymax: Number(box.ymax),
                            })}
                            className={[
                              "absolute w-3.5 h-3.5 rounded-full bg-white pointer-events-auto shadow",
                              wasEdited ? "border-2 border-sky-600" : "border-2 border-red-600",
                              corner === "nw" ? "-left-1.5 -top-1.5 cursor-nwse-resize" : "",
                              corner === "ne" ? "-right-1.5 -top-1.5 cursor-nesw-resize" : "",
                              corner === "sw" ? "-left-1.5 -bottom-1.5 cursor-nesw-resize" : "",
                              corner === "se" ? "-right-1.5 -bottom-1.5 cursor-nwse-resize" : "",
                            ].join(" ")}
                          />
                        ))}
                      <span
                        className={`absolute ${labelPos} ${labelAnchor} ${
                          suspect ? "bg-gray-500" : wasEdited ? "bg-sky-600" : "bg-red-600"
                        } text-white text-[10px] px-2 py-0.5 font-extrabold rounded shadow-md whitespace-nowrap`}
                      >
                        {label}
                        {typeof box.deduction === "number"
                          ? box.deduction_scope === "group"
                            ? ` 묶음 -${box.deduction}점`
                            : box.deduction_scope === "excluded"
                              ? " 감점 제외"
                              : ` -${box.deduction}점`
                          : ""}
                        {excluded ? " · 제외됨" : ""}
                        {wasEdited ? " · 수정됨" : ""}
                      </span>
                      {editable && typeof di === "number" && (
                        <button
                          onMouseDown={(e) => e.stopPropagation()}
                          onClick={() => toggleExcluded(di)}
                          title={excluded ? "감점에 다시 포함" : "결함 삭제 (감점에서 제외, 감사 기록은 보존)"}
                          className={`absolute ${labelPos} ${labelAnchor === "left-0" ? "right-0" : "left-0"} pointer-events-auto w-5 h-5 rounded-full flex items-center justify-center shadow-md ${
                            excluded ? "bg-emerald-600 hover:bg-emerald-500" : "bg-white hover:bg-red-50 border border-red-300"
                          }`}
                        >
                          {excluded ? <RotateCcw className="w-3 h-3 text-white" /> : <Trash2 className="w-3 h-3 text-red-600" />}
                        </button>
                      )}
                    </div>
                  );
                })}

              {/* 검수자가 직접 그린 신규 결함 */}
              {currentAdded.map((a) => {
                const target: DragTarget = { kind: "added", tempId: a.tempId };
                const effBox = effectiveBboxFor(target, a);
                const { left, top, width, height } = bboxToPercent({ ...effBox, coord_space: 1000 });
                const key = `added-${a.tempId}`;
                return (
                  <div
                    key={a.tempId}
                    onMouseEnter={() => setHoveredKey(key)}
                    onMouseLeave={() => setHoveredKey((k) => (k === key ? null : k))}
                    onMouseDown={editable && !drawMode ? startMove(target, a) : undefined}
                    className={[
                      "absolute rounded border-2 border-solid border-emerald-500 bg-emerald-500/25 shadow-lg transition-shadow",
                      editable && !drawMode ? "pointer-events-auto cursor-move" : "pointer-events-none",
                      hoveredKey === key ? "ring-2 ring-white" : "",
                    ].join(" ")}
                    style={{
                      left: `${left}%`, top: `${top}%`, width: `${width}%`, height: `${height}%`,
                      zIndex: hoveredKey === key ? 20 : 10,
                    }}
                  >
                    {editable &&
                      (["nw", "ne", "sw", "se"] as HandleCorner[]).map((corner) => (
                        <span
                          key={corner}
                          onMouseDown={startDrag(target, corner, a)}
                          className={[
                            "absolute w-3.5 h-3.5 rounded-full bg-white border-2 border-emerald-600 pointer-events-auto shadow",
                            corner === "nw" ? "-left-1.5 -top-1.5 cursor-nwse-resize" : "",
                            corner === "ne" ? "-right-1.5 -top-1.5 cursor-nesw-resize" : "",
                            corner === "sw" ? "-left-1.5 -bottom-1.5 cursor-nesw-resize" : "",
                            corner === "se" ? "-right-1.5 -bottom-1.5 cursor-nwse-resize" : "",
                          ].join(" ")}
                        />
                      ))}
                    <span className="absolute -top-6 left-0 bg-emerald-600 text-white text-[10px] px-2 py-0.5 font-extrabold rounded shadow-md whitespace-nowrap">
                      {defectTypeLabel(a.type)} · 검수자 추가
                    </span>
                  </div>
                );
              })}
            </div>
          ) : (
            <div className="relative w-72 h-96 bg-gray-100 dark:bg-gray-900 border-2 border-dashed border-gray-300 dark:border-gray-700 rounded-xl flex flex-col items-center justify-center p-6 text-center shadow-inner">
              <div className="w-16 h-16 rounded-full bg-red-100 dark:bg-red-500/10 border border-red-300 dark:border-red-500/30 flex items-center justify-center mb-4">
                <AlertCircle className="w-8 h-8 text-red-500 dark:text-red-400" />
              </div>
              <h4 className="text-sm font-bold text-gray-800 dark:text-gray-200">{task.book_title || "검수 이미지"}</h4>
              <p className="text-xs text-gray-500 dark:text-gray-400 mt-1 font-mono">ISBN: {task.isbn || "-"}</p>
              <p className="text-[11px] text-amber-700 dark:text-amber-400 mt-3 bg-amber-100 dark:bg-amber-950/60 px-3 py-1 rounded border border-amber-300 dark:border-amber-800/40">
                이미지 없음
              </p>
            </div>
          )}

          {shownIdx.length > 1 && (
            <>
              <button
                onClick={() => {
                  setImgError(false);
                  setCurrentIdx(shownIdx[(navPos - 1 + shownIdx.length) % shownIdx.length]);
                }}
                className="absolute left-4 p-2.5 rounded-full bg-black/10 hover:bg-black/20 text-gray-900 dark:bg-white/10 dark:hover:bg-white/20 dark:text-white transition-all"
              >
                <ChevronLeft className="w-5 h-5" />
              </button>
              <button
                onClick={() => {
                  setImgError(false);
                  setCurrentIdx(shownIdx[(navPos + 1) % shownIdx.length]);
                }}
                className="absolute right-4 p-2.5 rounded-full bg-black/10 hover:bg-black/20 text-gray-900 dark:bg-white/10 dark:hover:bg-white/20 dark:text-white transition-all"
              >
                <ChevronRight className="w-5 h-5" />
              </button>
            </>
          )}

          {/* 새 결함 확정 팝오버 */}
          {pendingNewBox && (
            <div className="absolute inset-0 bg-black/60 flex items-center justify-center z-40" onClick={() => setPendingNewBox(null)}>
              <div
                className="bg-white dark:bg-gray-900 border border-gray-300 dark:border-gray-700 rounded-xl shadow-2xl p-4 w-72 space-y-3"
                onClick={(e) => e.stopPropagation()}
              >
                <p className="text-sm font-bold text-gray-900 dark:text-white">새 결함 영역 — 유형 선택</p>
                <select
                  value={pendingType}
                  onChange={(e) => setPendingType(e.target.value)}
                  className="w-full bg-gray-50 dark:bg-gray-800 border border-gray-300 dark:border-gray-600 rounded-lg px-3 py-2 text-sm text-gray-900 dark:text-white"
                >
                  {DEFECT_TYPE_OPTIONS.map((o) => (
                    <option key={o.value} value={o.value}>{o.label}</option>
                  ))}
                </select>
                <div className="flex gap-2 justify-end">
                  <Button variant="outline" size="sm" onClick={() => setPendingNewBox(null)}>취소</Button>
                  <Button size="sm" onClick={confirmNewBox}>추가</Button>
                </div>
              </div>
            </div>
          )}
        </div>

        {/* 우측 사이드 패널 */}
        <aside className="w-96 shrink-0 border-l border-gray-200 dark:border-gray-800 bg-gray-50 dark:bg-gray-900 flex flex-col min-h-0">
          <div className="flex border-b border-gray-200 dark:border-gray-800 shrink-0">
            <button
              onClick={() => setSidePanel("defects")}
              className={`flex-1 py-2.5 text-xs font-black transition-colors ${
                sidePanel === "defects"
                  ? "text-gray-900 dark:text-white border-b-2 border-blue-500 bg-blue-50 dark:bg-gray-800/50"
                  : "text-gray-500 hover:text-gray-700 dark:hover:text-gray-300"
              }`}
            >
              결함 목록
            </button>
            <button
              onClick={() => setSidePanel("agent")}
              className={`flex-1 py-2.5 text-xs font-black transition-colors flex items-center justify-center gap-1 ${
                sidePanel === "agent"
                  ? "text-gray-900 dark:text-white border-b-2 border-purple-500 bg-purple-50 dark:bg-gray-800/50"
                  : "text-gray-500 hover:text-gray-700 dark:hover:text-gray-300"
              }`}
            >
              <Bot className="w-3.5 h-3.5" /> AI 판정 근거
            </button>
          </div>

          {/* 편집 반영 점수. 탭과 무관하게 항상 보여야 결재자가 판단할 수 있다. */}
          {editable && hasEdits && (
            <div className="p-3 pb-0 shrink-0">
              <ScorePreviewPanel
                preview={scorePreview.preview}
                loading={scorePreview.loading}
                error={scorePreview.error}
                hasEdits={hasEdits}
              />
            </div>
          )}

          <div className="flex-1 overflow-y-auto p-3 space-y-2">
            {sidePanel === "defects" ? (
              <>
                <p className="text-[11px] text-gray-600 dark:text-gray-500 font-bold px-1">현재 이미지 #{effIdx + 1} 기준</p>
                {currentBBoxes.length === 0 && currentAdded.length === 0 && (!showYolo || currentYoloBoxes.length === 0) && (
                  <p className="text-xs text-gray-500 dark:text-gray-500 px-1 py-4 text-center">이 이미지엔 결함 표시가 없습니다.</p>
                )}
                {currentBBoxes.map((box, idx: number) => {
                  const di = box.defectIndex;
                  const excluded = typeof di === "number" && cur.excluded.includes(di);
                  const wasEdited = typeof di === "number" && Boolean(cur.edited[di]);
                  const key = `defect-${di}`;
                  return (
                    <div
                      key={`list-${idx}`}
                      onMouseEnter={() => setHoveredKey(key)}
                      onMouseLeave={() => setHoveredKey((k) => (k === key ? null : k))}
                      className={`p-2.5 rounded-lg border text-xs ${
                        excluded
                          ? "bg-gray-100 dark:bg-gray-800/40 border-gray-300 dark:border-gray-700 opacity-60"
                          : hoveredKey === key
                            ? "bg-gray-100 dark:bg-gray-800 border-gray-400 dark:border-gray-500"
                            : "bg-white dark:bg-gray-800/70 border-gray-200 dark:border-gray-700"
                      }`}
                    >
                      <div className="flex items-center justify-between gap-2">
                        <span className="font-bold text-gray-900 dark:text-gray-100">{box.label || box.type}</span>
                        {typeof di === "number" && editable && (
                          <button
                            onClick={() => toggleExcluded(di)}
                            title={excluded ? "감점에 다시 포함" : "오탐으로 판단해 감점에서 제외"}
                            className={`p-1 rounded hover:bg-gray-200 dark:hover:bg-gray-700 ${excluded ? "text-emerald-600 dark:text-emerald-400" : "text-slate-500 dark:text-slate-400"}`}
                          >
                            {excluded ? <RotateCcw className="w-3.5 h-3.5" /> : <X className="w-3.5 h-3.5" />}
                          </button>
                        )}
                      </div>
                      <div className="text-[10px] text-gray-600 dark:text-gray-400 mt-1 flex flex-wrap gap-x-2">
                        {typeof box.deduction === "number" && <span>감점 {box.deduction}점</span>}
                        {typeof box.confidence === "number" && <span>신뢰도 {Math.round(box.confidence * 100)}%</span>}
                        {excluded && <span className="text-slate-600 dark:text-slate-400 font-bold">검수자 제외</span>}
                        {wasEdited && <span className="text-sky-600 dark:text-sky-400 font-bold">좌표 수정됨</span>}
                        {box.evidence_suspect && <span className="text-gray-500 dark:text-gray-500">오탐 의심</span>}
                      </div>
                    </div>
                  );
                })}

                {currentAdded.map((a) => {
                  const key = `added-${a.tempId}`;
                  return (
                    <div
                      key={a.tempId}
                      onMouseEnter={() => setHoveredKey(key)}
                      onMouseLeave={() => setHoveredKey((k) => (k === key ? null : k))}
                      className={`p-2.5 rounded-lg border text-xs ${hoveredKey === key ? "bg-emerald-100 dark:bg-emerald-950/60 border-emerald-400 dark:border-emerald-600" : "bg-emerald-50 dark:bg-emerald-950/30 border-emerald-300 dark:border-emerald-800"}`}
                    >
                      <div className="flex items-center justify-between gap-2">
                        <span className="font-bold text-emerald-700 dark:text-emerald-300">{defectTypeLabel(a.type)}</span>
                        {editable && (
                          <button
                            onClick={() => removeAdded(a.tempId)}
                            title="이 신규 결함 삭제"
                            className="p-1 rounded hover:bg-emerald-200 dark:hover:bg-emerald-900 text-emerald-700 dark:text-emerald-400"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        )}
                      </div>
                      <div className="text-[10px] text-emerald-700/80 dark:text-emerald-400/80 mt-1">검수자가 직접 추가한 결함</div>
                    </div>
                  );
                })}

                {showYolo && currentYoloBoxes.map((box) => {
                  const adopted = cur.adopted.includes(box.candIndex);
                  const key = `yolo-${box.candIndex}`;
                  return (
                    <div
                      key={key}
                      onMouseEnter={() => setHoveredKey(key)}
                      onMouseLeave={() => setHoveredKey((k) => (k === key ? null : k))}
                      className={`p-2.5 rounded-lg border text-xs ${adopted ? "bg-red-50 dark:bg-red-950/40 border-red-300 dark:border-red-800" : "bg-amber-50 dark:bg-amber-950/20 border-amber-300 dark:border-amber-900/60"}`}
                    >
                      <div className="flex items-center justify-between gap-2">
                        <span className="font-bold text-amber-700 dark:text-amber-300">{box.type} (YOLO 후보)</span>
                        {editable && (
                          <button
                            onClick={() => toggleAdopted(box.candIndex)}
                            title={adopted ? "채택 취소" : "실제 결함으로 채택"}
                            className={`text-[10px] font-bold px-2 py-1 rounded ${adopted ? "bg-red-600 dark:bg-red-800 text-white" : "bg-amber-600 dark:bg-amber-800 text-white"}`}
                          >
                            {adopted ? "채택됨" : "채택"}
                          </button>
                        )}
                      </div>
                      {typeof box.confidence === "number" && (
                        <div className="text-[10px] text-amber-700/80 dark:text-amber-400/80 mt-1">신뢰도 {Math.round(box.confidence * 100)}%</div>
                      )}
                    </div>
                  );
                })}
              </>
            ) : (
              <>
                <div
                  className={`p-2.5 rounded-lg border text-[11px] font-bold ${
                    invalidSet.has(effIdx)
                      ? "bg-amber-50 dark:bg-amber-950/40 text-amber-700 dark:text-amber-300 border-amber-300 dark:border-amber-800"
                      : currentBBoxes.length > 0
                        ? "bg-rose-50 dark:bg-rose-950/40 text-rose-700 dark:text-rose-300 border-rose-300 dark:border-rose-800"
                        : "bg-gray-100 dark:bg-gray-800 text-gray-700 dark:text-gray-300 border-gray-300 dark:border-gray-700"
                  }`}
                >
                  현재 이미지 #{effIdx + 1}: {invalidSet.has(effIdx)
                    ? "👤 도서 미식별 컷"
                    : currentBBoxes.length > 0
                      ? `결함 BBox ${currentBBoxes.length}건 검출`
                      : "AI 결함 미검출"}
                </div>
                {agentEntries.length === 0 ? (
                  <div className="p-3 bg-amber-50 dark:bg-amber-950/30 border border-amber-300 dark:border-amber-800 rounded-lg text-[11px] text-amber-800 dark:text-amber-200 leading-relaxed">
                    저장된 Agent 판정 서술이 없습니다. <strong>[AI 재검수]</strong> 실행 시 기록됩니다.
                  </div>
                ) : (
                  agentEntries.map((s) => (
                    <div key={s.key} className="p-2.5 bg-gray-50 dark:bg-gray-800/70 border border-gray-200 dark:border-gray-700 rounded-lg">
                      <p className="text-[11px] font-black text-purple-600 dark:text-purple-400 mb-1">{s.icon} {s.label}</p>
                      <p className="text-[11px] text-gray-700 dark:text-gray-300 leading-relaxed whitespace-pre-wrap">{logs[s.key]}</p>
                    </div>
                  ))
                )}
                {typeof logs.retry_count === "number" && logs.retry_count > 0 && (
                  <p className="text-[11px] font-bold text-amber-700 dark:text-amber-300">⟳ 파이프라인 재검수 {logs.retry_count}회 수행됨</p>
                )}
              </>
            )}
          </div>
        </aside>
      </div>

      {/* Footer: 썸네일 + 요약 */}
      <div className="px-6 py-3 bg-gray-50 dark:bg-gray-900 border-t border-gray-200 dark:border-gray-800 flex flex-col gap-2 shrink-0">
        {task.special_notes && (
          <div className="flex items-center gap-2 px-3 py-1.5 bg-amber-50 dark:bg-amber-950/40 border border-amber-300 dark:border-amber-800 rounded-lg text-xs text-amber-800 dark:text-amber-200">
            <span className="font-bold bg-amber-200 dark:bg-amber-900 text-amber-900 dark:text-amber-100 px-2 py-0.5 rounded text-[11px]">AI 시각 특이사항</span>
            <span className="line-clamp-1">{task.special_notes}</span>
          </div>
        )}
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2 overflow-x-auto py-1">
            {shownIdx.map((idx) => {
              const url = images[idx];
              const cnt = bboxesForIndex(rawList, idx, url).length + cur.added.filter((a) => a.imageIndex === idx).length;
              const isInvalid = invalidSet.has(idx);
              return (
                <button
                  key={idx}
                  onClick={() => {
                    setImgError(false);
                    setCurrentIdx(idx);
                  }}
                  className={`relative w-12 h-16 rounded overflow-hidden border-2 transition-all bg-gray-200 dark:bg-gray-800 shrink-0 ${
                    effIdx === idx ? "border-blue-500 ring-2 ring-blue-200 dark:ring-blue-900 scale-105" : "border-gray-300 dark:border-gray-700 opacity-60 hover:opacity-100"
                  }`}
                >
                  {/* eslint-disable-next-line @next/next/no-img-element -- 서명 URL·외부 CDN·blob 원본은 next/image 서버 최적화를 태울 수 없다 */}
                  <img
                    src={url}
                    alt={`thumb-${idx}`}
                    className={`w-full h-full object-cover ${isInvalid ? "grayscale opacity-50" : ""}`}
                    onError={(e) => { (e.target as HTMLElement).style.display = "none"; }}
                  />
                  {cnt > 0 && (
                    <span className="absolute top-0.5 right-0.5 min-w-4 h-4 px-0.5 bg-red-600 text-white text-[9px] font-black rounded-full flex items-center justify-center shadow z-10">
                      {cnt}
                    </span>
                  )}
                  {isInvalid && (
                    <span className="absolute bottom-0 inset-x-0 bg-amber-500/95 text-white text-[8px] font-black text-center py-0.5 z-10">미식별</span>
                  )}
                </button>
              );
            })}
            {invalidSet.size > 0 && (
              <button
                onClick={() => setHideInvalid(!hideInvalid)}
                className="shrink-0 px-2.5 py-1.5 rounded-lg border border-dashed border-amber-400 dark:border-amber-700 bg-amber-50 dark:bg-amber-950/40 text-amber-700 dark:text-amber-300 text-[10px] font-black hover:bg-amber-100 dark:hover:bg-amber-900/60 transition-colors"
              >
                {hideInvalid ? `👤 미식별 ${invalidSet.size}컷 숨김 · 보기` : `👤 미식별 ${invalidSet.size}컷 표시 중 · 숨기기`}
              </button>
            )}
          </div>
          <div className="text-right text-xs text-gray-600 dark:text-gray-400">
            <div className="flex items-center justify-end gap-2">
              {task.inspection_type && (
                <span className={`px-2 py-0.5 text-[11px] font-bold rounded ${
                  task.inspection_type === "BUYBACK"
                    ? "bg-purple-100 dark:bg-purple-950 text-purple-700 dark:text-purple-300 border border-purple-300 dark:border-purple-800"
                    : "bg-blue-100 dark:bg-blue-950 text-blue-700 dark:text-blue-300 border border-blue-300 dark:border-blue-800"
                }`}>
                  {task.inspection_type === "BUYBACK" ? "중고 바이백 정산" : "고객 반품 환불"}
                </span>
              )}
              <span>이미지 <strong className="text-gray-900 dark:text-white">{shownIdx.length > 0 ? navPos + 1 : 0}</strong> / {shownIdx.length}</span>
            </div>
            {logs.score_unverified ? (
              <div className="mt-1 text-amber-600 dark:text-amber-400 font-bold">
                UBCI 점수: <span className="text-sm">판정 보류</span>
                <span className="ml-1 font-normal text-[11px]">(증거 대조 전건 반려 — 관리자 확인 필요)</span>
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
  );
}

function dragTargetEquals(a: DragTarget, b: DragTarget): boolean {
  if (a.kind !== b.kind) return false;
  if (a.kind === "existing" && b.kind === "existing") return a.defectIndex === b.defectIndex;
  if (a.kind === "added" && b.kind === "added") return a.tempId === b.tempId;
  return false;
}
