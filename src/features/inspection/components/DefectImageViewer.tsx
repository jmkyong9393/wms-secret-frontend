'use client';

/**
 * 검수 이미지 + AI 판독 결과 오버레이 뷰어 (공용)
 *
 * 재고 상세(/admin/inventory/[id])와 HITL 결재(/admin/hitl) 양쪽에서 같은 컴포넌트를 쓴다.
 * 종전에는 두 화면이 각자 BBox 렌더 코드를 복제하고 있었고, 좌표계를 값 크기로 추측하는
 * 로직(`xmin > 1 ? 1000 : ...`)까지 따로 들고 있어 한쪽만 고치면 다른 쪽이 어긋났다.
 *
 * [핵심 설계 - 두 판독 결과를 겹쳐 보여준다]
 *   - Vision 확정 결함 (빨강 실선) : GPT-4o VLM이 최종 확정해 UBCI 감점에 반영된 결함
 *   - YOLO 사전탐지 후보 (주황 점선) : WBF 3-YOLO 앙상블이 잡았으나 Vision이 채택하지 않은 후보
 *
 * 검수자가 "AI가 무엇을 봤고 무엇을 기각했는지"까지 확인해야 판단이 빨라진다.
 * 예를 들어 YOLO가 4건을 잡았는데 Vision이 0건으로 확정했다면, 그 4건이 인쇄물 오탐인지
 * Vision의 누락인지를 사람이 직접 눈으로 대조할 수 있다.
 */

import React, { useMemo, useState } from 'react';
import { Eye, EyeOff, ScanSearch, AlertCircle } from 'lucide-react';

import {
  resolveInspectionImages,
  resolveDefectCoordinates,
  bboxToPercent,
  type BBoxItem,
} from '@/features/inspection/utils/inspectionImageService';

export interface YoloCandidate {
  image_index?: number;
  type?: string;
  confidence?: number;
  bbox?: { xmin: number; ymin: number; xmax: number; ymax: number };
}

interface DefectImageViewerProps {
  /** agent_logs / image_urls를 담고 있는 원본 객체 (재고 상세 응답 또는 HITL task) */
  source: any;
  /** 이미지 영역 최소 높이 */
  minHeight?: string;
  /** 이미지 최대 높이 */
  maxImageHeight?: string;
  /** 우측 결함 상세 패널 노출 여부 (HITL 모달처럼 좁은 곳에서는 끈다) */
  showSidePanel?: boolean;
  className?: string;
}

/** YOLO 후보를 BBoxItem 형태로 정규화. 좌표가 없는 후보는 그릴 수 없으므로 제외한다. */
function normalizeYoloCandidates(raw: any, imageIndex: number): BBoxItem[] {
  if (!Array.isArray(raw)) return [];
  return raw
    .filter((c: YoloCandidate) => Number(c?.image_index ?? 0) === imageIndex && c?.bbox)
    .map((c: YoloCandidate) => ({
      xmin: c.bbox!.xmin,
      ymin: c.bbox!.ymin,
      xmax: c.bbox!.xmax,
      ymax: c.bbox!.ymax,
      coord_space: 1000,
      type: c.type,
      label: c.type || 'YOLO 후보',
      confidence: c.confidence,
    }));
}

export default function DefectImageViewer({
  source,
  minHeight = '420px',
  maxImageHeight = '520px',
  showSidePanel = true,
  className = '',
}: DefectImageViewerProps) {
  const [selectedIdx, setSelectedIdx] = useState(0);
  const [showVision, setShowVision] = useState(true);
  const [showYolo, setShowYolo] = useState(false);
  const [hovered, setHovered] = useState<{ layer: 'vision' | 'yolo'; idx: number } | null>(null);

  const images = useMemo(() => resolveInspectionImages(source), [source]);
  const defectCoords = useMemo(() => resolveDefectCoordinates(source), [source]);
  const logs = source?.agent_logs || {};

  const visionBoxes: BBoxItem[] =
    defectCoords.find((c) => c.image_index === selectedIdx)?.bboxes || [];
  const yoloBoxes = useMemo(
    () => normalizeYoloCandidates(logs.yolo_candidates, selectedIdx),
    [logs.yolo_candidates, selectedIdx]
  );

  const totalVision = defectCoords.reduce((n, c) => n + c.bboxes.length, 0);
  const totalYolo = Array.isArray(logs.yolo_candidates) ? logs.yolo_candidates.length : 0;

  if (images.length === 0) {
    return (
      <div className="py-14 text-center text-sm text-gray-400 bg-gray-50 dark:bg-gray-900/40 rounded-xl border border-dashed border-gray-200 dark:border-gray-700">
        이 건에 연결된 검수 촬영 이미지가 없습니다.
      </div>
    );
  }

  return (
    <div className={`space-y-3 ${className}`}>
      {/* 오버레이 토글 */}
      <div className="flex items-center gap-2 flex-wrap">
        <button
          type="button"
          onClick={() => setShowVision((v) => !v)}
          className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-[11px] font-bold border transition-colors cursor-pointer ${
            showVision
              ? 'bg-red-50 dark:bg-red-950/50 text-red-700 dark:text-red-300 border-red-300 dark:border-red-800'
              : 'bg-gray-50 dark:bg-gray-800 text-gray-500 border-gray-200 dark:border-gray-700'
          }`}
          title="GPT-4o Vision이 최종 확정해 UBCI 감점에 반영된 결함"
        >
          {showVision ? <Eye className="w-3.5 h-3.5" /> : <EyeOff className="w-3.5 h-3.5" />}
          Vision 확정 결함 {totalVision}건
        </button>

        <button
          type="button"
          onClick={() => setShowYolo((v) => !v)}
          disabled={totalYolo === 0}
          className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-[11px] font-bold border transition-colors ${
            totalYolo === 0
              ? 'bg-gray-50 dark:bg-gray-800/50 text-gray-300 dark:text-gray-600 border-gray-200 dark:border-gray-800 cursor-not-allowed'
              : showYolo
              ? 'bg-amber-50 dark:bg-amber-950/50 text-amber-700 dark:text-amber-300 border-amber-300 dark:border-amber-800 cursor-pointer'
              : 'bg-gray-50 dark:bg-gray-800 text-gray-500 border-gray-200 dark:border-gray-700 cursor-pointer'
          }`}
          title="WBF 3-YOLO 앙상블 사전탐지 후보. Vision이 채택하지 않은 것도 포함된다."
        >
          <ScanSearch className="w-3.5 h-3.5" />
          YOLO 사전탐지 후보 {totalYolo}건
        </button>

        {showYolo && totalYolo > 0 && totalVision === 0 && (
          <span className="text-[11px] text-amber-700 dark:text-amber-400 font-medium">
            YOLO가 {totalYolo}건을 잡았으나 Vision이 전부 기각했습니다 (인쇄물 오탐 가능성).
          </span>
        )}
      </div>

      {/* 썸네일 */}
      {images.length > 1 && (
        <div className="flex items-center gap-2 overflow-x-auto pb-1">
          {images.map((url, idx) => {
            const cnt = defectCoords.find((c) => c.image_index === idx)?.bboxes.length || 0;
            return (
              <button
                key={idx}
                type="button"
                onClick={() => setSelectedIdx(idx)}
                className={`flex flex-col items-center p-1.5 rounded-xl border text-[10px] font-bold transition-all shrink-0 cursor-pointer ${
                  selectedIdx === idx
                    ? 'bg-indigo-50 dark:bg-indigo-950/50 border-indigo-600 text-indigo-700 dark:text-indigo-300 ring-2 ring-indigo-500/20'
                    : 'bg-gray-50 dark:bg-gray-800 border-gray-200 dark:border-gray-700 text-gray-600 dark:text-gray-400'
                }`}
              >
                <img
                  src={url}
                  alt={`검수 ${idx}`}
                  className="w-14 h-18 object-cover rounded mb-0.5 border border-gray-200 dark:border-gray-700 bg-gray-200"
                />
                #{idx} {cnt > 0 ? `결함 ${cnt}` : '정상'}
              </button>
            );
          })}
        </div>
      )}

      <div className={`grid grid-cols-1 ${showSidePanel ? 'md:grid-cols-3' : ''} gap-4 items-start`}>
        {/* 이미지 + 오버레이 */}
        <div
          className={`${showSidePanel ? 'md:col-span-2' : ''} relative bg-gray-900 rounded-xl overflow-hidden border border-gray-800 flex justify-center items-center p-2`}
          style={{ minHeight }}
        >
          <div className="relative inline-block max-w-full">
            <img
              src={images[selectedIdx] || images[0]}
              alt={`검수 이미지 ${selectedIdx}`}
              className="w-auto object-contain block"
              style={{ maxHeight: maxImageHeight }}
            />

            {/* YOLO 후보 - 주황 점선 (Vision 확정보다 아래 레이어) */}
            {showYolo &&
              yoloBoxes.map((box, i) => {
                const { left, top, width, height } = bboxToPercent(box);
                const isHovered = hovered?.layer === 'yolo' && hovered.idx === i;
                return (
                  <div
                    key={`y-${i}`}
                    onMouseEnter={() => setHovered({ layer: 'yolo', idx: i })}
                    onMouseLeave={() => setHovered(null)}
                    className="absolute border-2 border-dashed border-amber-400 bg-amber-400/10 rounded z-10"
                    style={{ left: `${left}%`, top: `${top}%`, width: `${width}%`, height: `${height}%` }}
                  >
                    {isHovered && (
                      <span className="absolute -bottom-6 left-0 bg-amber-500 text-white text-[10px] px-2 py-0.5 font-bold rounded whitespace-nowrap z-30">
                        YOLO 후보: {box.type}
                        {box.confidence ? ` (${Math.round(box.confidence * 100)}%)` : ''}
                      </span>
                    )}
                  </div>
                );
              })}

            {/* Vision 확정 결함 - 빨강 실선 */}
            {showVision &&
              visionBoxes.map((box, i) => {
                const { left, top, width, height } = bboxToPercent(box);
                return (
                  <div
                    key={`v-${i}`}
                    onMouseEnter={() => setHovered({ layer: 'vision', idx: i })}
                    onMouseLeave={() => setHovered(null)}
                    className="absolute border-2 border-red-500 bg-red-500/25 rounded shadow-lg z-20 cursor-help"
                    style={{ left: `${left}%`, top: `${top}%`, width: `${width}%`, height: `${height}%` }}
                  >
                    <span className="absolute -top-6 left-0 bg-red-600 text-white text-[10px] px-2 py-0.5 font-extrabold rounded shadow-md whitespace-nowrap z-30">
                      {box.label}
                      {box.deduction ? ` -${box.deduction}점` : ''}
                      {box.confidence ? ` (${Math.round(box.confidence * 100)}%)` : ''}
                    </span>
                  </div>
                );
              })}
          </div>
        </div>

        {/* 결함 상세 패널 */}
        {showSidePanel && (
          <div className="space-y-3 bg-gray-50 dark:bg-gray-900/60 p-4 rounded-xl border border-gray-200 dark:border-gray-700">
            <h4 className="text-xs font-bold text-gray-700 dark:text-gray-300 uppercase tracking-wide flex items-center justify-between">
              <span>선택 이미지 판독 결과</span>
              <span className="text-[10px] font-mono bg-gray-200 dark:bg-gray-700 px-1.5 py-0.5 rounded">
                #{selectedIdx}
              </span>
            </h4>

            {visionBoxes.length === 0 ? (
              <div className="p-3 bg-emerald-50 dark:bg-emerald-950/40 text-emerald-800 dark:text-emerald-300 border border-emerald-200 dark:border-emerald-900 rounded-lg text-xs font-bold">
                [CLEAN] Vision 확정 결함 없음
              </div>
            ) : (
              <div className="space-y-2 text-xs">
                {visionBoxes.map((box, i) => (
                  <div
                    key={i}
                    onMouseEnter={() => setHovered({ layer: 'vision', idx: i })}
                    onMouseLeave={() => setHovered(null)}
                    className="p-2.5 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg space-y-1 cursor-help"
                  >
                    <p className="text-gray-900 dark:text-white font-bold">{box.label}</p>
                    <p className="text-[11px] text-gray-500 dark:text-gray-400 font-mono">
                      {box.type}
                      {box.deduction ? ` · -${box.deduction}점` : ''}
                      {box.confidence ? ` · conf ${box.confidence.toFixed(2)}` : ''}
                    </p>
                  </div>
                ))}
              </div>
            )}

            {showYolo && yoloBoxes.length > 0 && (
              <div className="space-y-1.5 pt-1">
                <p className="text-[11px] font-bold text-amber-700 dark:text-amber-400">
                  YOLO 후보 {yoloBoxes.length}건 (미채택 포함)
                </p>
                {yoloBoxes.map((box, i) => (
                  <div
                    key={i}
                    className="text-[11px] text-amber-900 dark:text-amber-200 bg-amber-50 dark:bg-amber-950/40 border border-amber-200 dark:border-amber-900 rounded px-2 py-1 font-mono"
                  >
                    {box.type}
                    {box.confidence ? ` · ${Math.round(box.confidence * 100)}%` : ''}
                  </div>
                ))}
              </div>
            )}

            {logs.special_notes && (
              <div className="p-2.5 bg-amber-50 dark:bg-amber-950/40 border border-amber-200 dark:border-amber-900 rounded-lg text-[11px] text-amber-900 dark:text-amber-200 flex gap-1.5">
                <AlertCircle className="w-3.5 h-3.5 shrink-0 mt-0.5" />
                <span>
                  <span className="font-bold">AI 특이사항: </span>
                  {logs.special_notes}
                </span>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
