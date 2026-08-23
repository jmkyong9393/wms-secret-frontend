'use client';

// 검수 증거 뷰어 - 촬영 컷 썸네일, AI 판정 오버레이(확정/오탐제외/YOLO 후보) 토글,
// 선택 컷의 결함 메타 패널을 한 단위로 묶는다. 재고 상세·감사 화면 공용을 전제로 분리.
import React, { useState } from 'react';
import { Eye, EyeOff, ScanSearch } from 'lucide-react';
import {
  bboxToPercent,
  type PerImageDefectCoordinate,
} from '@/features/inspection/utils/inspectionImageService';

interface InspectionEvidenceViewerProps {
  images: string[];
  defectCoords: PerImageDefectCoordinate[];
  excludedCoords: PerImageDefectCoordinate[];
  yoloCandidates: any[];
  invalidImageIndexes: number[];
  totalDefects: number;
  specialNotes?: string | null;
}

export function InspectionEvidenceViewer({
  images,
  defectCoords,
  excludedCoords,
  yoloCandidates,
  invalidImageIndexes,
  totalDefects,
  specialNotes,
}: InspectionEvidenceViewerProps) {
  const [selectedImgIdx, setSelectedImgIdx] = useState<number>(0);
  // 확정 결함과 YOLO 후보 오버레이를 따로 껐다 켤 수 있다
  // (원본 대조와 "AI가 무엇을 기각했는지" 검토가 별개 작업이라 분리).
  const [showVisionBoxes, setShowVisionBoxes] = useState<boolean>(true);
  const [showYoloBoxes, setShowYoloBoxes] = useState<boolean>(false);

  const currentCoords = defectCoords.find((c) => c.image_index === selectedImgIdx);
  const currentBBoxes = currentCoords?.bboxes || [];
  const currentExcludedBBoxes =
    excludedCoords.find((c) => c.image_index === selectedImgIdx)?.bboxes || [];
  const currentYoloBoxes = yoloCandidates
    .filter((c) => Number(c?.image_index ?? 0) === selectedImgIdx && c?.bbox)
    .map((c) => ({
      xmin: c.bbox.xmin,
      ymin: c.bbox.ymin,
      xmax: c.bbox.xmax,
      ymax: c.bbox.ymax,
      coord_space: 1000,
      type: c.type,
      label: c.type || 'YOLO 후보',
      confidence: c.confidence,
    }));

  return (
    <>
                  {/* AI 판독 오버레이 on/off (HITL 모달의 "AI 결함 영역 숨기기"와 동일 개념) */}
                  <div className="flex items-center gap-2 flex-wrap">
                    <button
                      type="button"
                      onClick={() => setShowVisionBoxes((v) => !v)}
                      className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-[11px] font-bold border transition-colors cursor-pointer ${
                        showVisionBoxes
                          ? 'bg-red-50 dark:bg-red-950/50 text-red-700 dark:text-red-300 border-red-300 dark:border-red-800'
                          : 'bg-gray-50 dark:bg-gray-800 text-gray-500 border-gray-200 dark:border-gray-700'
                      }`}
                      title="UBCI 감점에 실제로 반영된 확정 결함. AI 증거 대조 검증·HITL 관리자가 오탐으로 제외한 건은 빠져 있다."
                    >
                      {showVisionBoxes ? <Eye className="w-3.5 h-3.5" /> : <EyeOff className="w-3.5 h-3.5" />}
                      {showVisionBoxes ? '확정 결함 숨기기' : '확정 결함 표시'} ({totalDefects}건)
                    </button>

                    <button
                      type="button"
                      onClick={() => setShowYoloBoxes((v) => !v)}
                      disabled={yoloCandidates.length === 0}
                      className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-[11px] font-bold border transition-colors ${
                        yoloCandidates.length === 0
                          ? 'bg-gray-50 dark:bg-gray-800/50 text-gray-300 dark:text-gray-600 border-gray-200 dark:border-gray-800 cursor-not-allowed'
                          : showYoloBoxes
                          ? 'bg-amber-50 dark:bg-amber-950/50 text-amber-700 dark:text-amber-300 border-amber-300 dark:border-amber-800 cursor-pointer'
                          : 'bg-gray-50 dark:bg-gray-800 text-gray-500 border-gray-200 dark:border-gray-700 cursor-pointer'
                      }`}
                      title="WBF 3-YOLO 앙상블 사전탐지 후보 (Vision이 채택하지 않은 것 포함)"
                    >
                      <ScanSearch className="w-3.5 h-3.5" />
                      YOLO 사전탐지 후보 ({yoloCandidates.length}건)
                    </button>

                    {showYoloBoxes && yoloCandidates.length > 0 && totalDefects === 0 && (
                      <span className="text-[11px] text-amber-700 dark:text-amber-400 font-medium">
                        YOLO가 {yoloCandidates.length}건을 잡았으나 Vision이 전부 기각했습니다 (인쇄물 오탐 가능성).
                      </span>
                    )}
                  </div>

                  {/* Thumbnail Bar - 라벨은 결함 유무에 따라 실제 데이터로 생성한다 */}
                  <div className="flex items-center gap-2 overflow-x-auto pb-2">
                    {images.map((imgUrl, idx) => {
                      const coords = defectCoords.find((c) => c.image_index === idx);
                      const defectCnt = coords?.bboxes.length || 0;
                      const isSelected = selectedImgIdx === idx;
                      // Vision Agent가 "도서가 식별되지 않는 컷"으로 판정한 이미지.
                      // 이 구분이 없으면 작업자 얼굴만 찍힌 사진도 "정상(결함 0건)"으로 보인다.
                      const isInvalid = invalidImageIndexes.includes(idx);
                      return (
                        <button
                          key={idx}
                          onClick={() => setSelectedImgIdx(idx)}
                          className={`flex flex-col items-center p-1.5 rounded-xl border text-[11px] font-bold transition-all shrink-0 min-w-[95px] cursor-pointer ${
                            isSelected
                              ? 'bg-indigo-50 dark:bg-indigo-950/50 border-indigo-600 text-indigo-700 dark:text-indigo-300 shadow-xs ring-2 ring-indigo-500/20'
                              : isInvalid
                              ? 'bg-amber-50 dark:bg-amber-950/40 border-amber-300 dark:border-amber-800 text-amber-700 dark:text-amber-300'
                              : 'bg-gray-50 dark:bg-gray-800 border-gray-200 dark:border-gray-700 text-gray-600 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-700'
                          }`}
                        >
                          <img
                            src={imgUrl}
                            alt={`검수 이미지 ${idx}`}
                            className={`w-16 h-20 object-cover rounded-lg mb-1 border border-gray-200 dark:border-gray-700 bg-gray-200 ${
                              isInvalid ? 'opacity-60' : ''
                            }`}
                          />
                          <span className="truncate max-w-[90px]">
                            {/* "정상"은 도서 상태 보증처럼 읽혀 "결함 미검출"로 표기 */}
                            #{idx} {isInvalid ? '👤 도서 미식별' : defectCnt > 0 ? `결함 ${defectCnt}` : '결함 미검출'}
                          </span>
                        </button>
                      );
                    })}
                  </div>

                  {/* BBox Display */}
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-6 items-start pt-2">
                    <div className="md:col-span-2 relative bg-gray-900 rounded-xl overflow-hidden shadow-inner border border-gray-800 flex justify-center items-center p-2 min-h-[480px]">
                      <div className="relative inline-block max-w-full rounded-lg overflow-hidden border border-gray-800 shadow-2xl">
                        <img
                          src={images[selectedImgIdx] || images[0]}
                          alt={`검수 이미지 ${selectedImgIdx}`}
                          className="max-h-[520px] w-auto object-contain block"
                        />

                        {/* YOLO 사전탐지 후보 - 주황 점선 (Vision 확정보다 아래 레이어) */}
                        {showYoloBoxes &&
                          currentYoloBoxes.map((box, i) => {
                            const { left, top, width, height } = bboxToPercent(box);
                            // 라벨이 무조건 박스 바깥(-bottom-6/-top-6)에 그려져
                            // 이미지 가장자리 결함은 overflow-hidden 컨테이너에 잘려 안 보였다.
                            // 가장자리 근처(세로 8% 이내)면 박스 안쪽으로, 우측 절반이면 오른쪽
                            // 앵커로 뒤집어 라벨이 항상 이미지 프레임 안에 있게 한다.
                            const yoloLabelPos = top + height > 92 ? 'bottom-1' : '-bottom-6';
                            const yoloLabelAnchor = left > 50 ? 'right-0' : 'left-0';
                            return (
                              <div
                                key={`y-${i}`}
                                className="absolute border-2 border-dashed border-amber-400 bg-amber-400/10 rounded z-10 group"
                                style={{ left: `${left}%`, top: `${top}%`, width: `${width}%`, height: `${height}%` }}
                              >
                                <span className={`absolute ${yoloLabelPos} ${yoloLabelAnchor} bg-amber-500 text-white text-[10px] px-2 py-0.5 font-bold rounded whitespace-nowrap opacity-0 group-hover:opacity-100 transition-opacity z-30`}>
                                  YOLO 후보: {box.type}
                                  {box.confidence ? ` (${Math.round(box.confidence * 100)}%)` : ''}
                                </span>
                              </div>
                            );
                          })}

                        {/* 오탐 제외 - 회색 점선. AI 증거 대조 검증(또는 HITL 관리자)이
                            "감점 반영 안 함"으로 걷어낸 박스. 규정상 목록에서 지우지 않고
                            표식만 남기므로, 확정(빨강)과 반드시 구분해 그린다. */}
                        {showVisionBoxes &&
                          currentExcludedBBoxes.map((box, i) => {
                            const { left, top, width, height } = bboxToPercent(box);
                            const exLabelPos = top < 8 ? 'top-1' : '-top-6';
                            const exLabelAnchor = left > 50 ? 'right-0' : 'left-0';
                            return (
                              <div
                                key={`ex-${i}`}
                                className="absolute border-2 border-dashed border-gray-400 bg-gray-400/10 rounded z-10 group"
                                style={{ left: `${left}%`, top: `${top}%`, width: `${width}%`, height: `${height}%` }}
                              >
                                <span className={`absolute ${exLabelPos} ${exLabelAnchor} bg-gray-500 text-white text-[10px] px-2 py-0.5 font-bold rounded whitespace-nowrap opacity-0 group-hover:opacity-100 transition-opacity z-30`}>
                                  오탐 제외: {box.label} (감점 미반영)
                                </span>
                              </div>
                            );
                          })}

                        {/*
                          Vision 확정 결함 - 빨강 실선.
                          [수정 이력] 예전에는 좌표계를 값 크기로 추측(xmin>1이면 1000, ...)했고,
                          BBox 데이터가 없으면 하드코딩된 가짜 좌표를 그렸다. 이제 백엔드가
                          coord_space를 명시해 내려주며, 데이터가 없으면 아무것도 그리지 않는다.
                        */}
                        {showVisionBoxes &&
                          currentBBoxes.map((box, bIdx) => {
                            const { left, top, width, height } = bboxToPercent(box);
                            // 상단 8% 이내 박스는 라벨을 박스 안쪽(top-1)으로 내려 잘림 방지
                            const visionLabelPos = top < 8 ? 'top-1' : '-top-6';
                            const visionLabelAnchor = left > 50 ? 'right-0' : 'left-0';
                            return (
                              <div
                                key={bIdx}
                                className="absolute border-2 border-red-500 bg-red-500/25 rounded shadow-lg z-20"
                                style={{ left: `${left}%`, top: `${top}%`, width: `${width}%`, height: `${height}%` }}
                              >
                                <span className={`absolute ${visionLabelPos} ${visionLabelAnchor} bg-red-600 text-white text-[10px] px-2 py-0.5 font-extrabold rounded shadow-md whitespace-nowrap z-30`}>
                                  {box.label}
                                  {box.deduction ? ` -${box.deduction}점` : ''}
                                  {box.confidence ? ` (${Math.round(box.confidence * 100)}%)` : ''}
                                </span>
                              </div>
                            );
                          })}
                      </div>
                    </div>

                    {/* Defect Metadata Panel - 인덱스 하드코딩이 아니라 실제 결함 데이터 기반 */}
                    <div className="space-y-3 bg-gray-50 dark:bg-gray-800/60 p-4 rounded-xl border border-gray-200 dark:border-gray-700">
                      <h4 className="text-xs font-bold text-gray-700 dark:text-gray-300 uppercase tracking-wide flex items-center justify-between">
                        <span>선택한 이미지 결함 분석</span>
                        <span className="text-[10px] font-mono bg-gray-200 dark:bg-gray-700 px-1.5 py-0.5 rounded text-gray-700 dark:text-gray-300">
                          Image #{selectedImgIdx}
                        </span>
                      </h4>

                      {invalidImageIndexes.includes(selectedImgIdx) ? (
                        <div className="p-3 bg-amber-50 dark:bg-amber-950/40 text-amber-900 dark:text-amber-200 border border-amber-300 dark:border-amber-800 rounded-lg text-xs space-y-1">
                          <p className="font-bold">[INVALID] 도서가 식별되지 않는 촬영 컷</p>
                          <p className="text-[11px] leading-relaxed">
                            결함이 없어서가 아니라 이 사진에서 도서를 찾지 못했습니다. 재촬영이 필요할 수 있습니다.
                          </p>
                        </div>
                      ) : currentBBoxes.length === 0 ? (
                        currentExcludedBBoxes.length > 0 ? (
                          <div className="p-3 bg-gray-100 dark:bg-gray-800 text-gray-700 dark:text-gray-300 border border-gray-300 dark:border-gray-600 rounded-lg text-xs space-y-1">
                            <p className="font-bold">확정 결함 없음 — 오탐 제외 {currentExcludedBBoxes.length}건</p>
                            <p className="text-[11px] leading-relaxed">
                              AI가 1차 보고한 결함이 증거 대조 검증에서 오탐으로 지목되어 감점에 반영되지 않았습니다.
                            </p>
                          </div>
                        ) : (
                          <div className="p-3 bg-emerald-50 dark:bg-emerald-950/40 text-emerald-800 dark:text-emerald-300 border border-emerald-200 dark:border-emerald-900 rounded-lg text-xs font-bold">
                            [CLEAN] 이 이미지에서 검출된 결함 없음
                          </div>
                        )
                      ) : (
                        <div className="space-y-2 text-xs">
                          <div className="p-2.5 bg-red-50 dark:bg-red-950/40 text-red-900 dark:text-red-300 border border-red-200 dark:border-red-900 rounded-lg">
                            <p className="font-bold">[DEFECT_DETECTED] 결함 {currentBBoxes.length}건 검출</p>
                          </div>
                          {currentBBoxes.map((box, i) => (
                            <div key={i} className="p-2.5 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg space-y-1">
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

                      {showYoloBoxes && currentYoloBoxes.length > 0 && (
                        <div className="space-y-1.5 pt-1">
                          <p className="text-[11px] font-bold text-amber-700 dark:text-amber-400">
                            YOLO 후보 {currentYoloBoxes.length}건 (미채택 포함)
                          </p>
                          {currentYoloBoxes.map((box, i) => (
                            <div key={i} className="text-[11px] text-amber-900 dark:text-amber-200 bg-amber-50 dark:bg-amber-950/40 border border-amber-200 dark:border-amber-900 rounded px-2 py-1 font-mono">
                              {box.type}
                              {box.confidence ? ` · ${Math.round(box.confidence * 100)}%` : ''}
                            </div>
                          ))}
                        </div>
                      )}

                      {specialNotes && (
                        <div className="p-2.5 bg-amber-50 dark:bg-amber-950/40 border border-amber-200 dark:border-amber-900 rounded-lg text-[11px] text-amber-900 dark:text-amber-200">
                          <span className="font-bold">특이사항: </span>
                          {specialNotes}
                        </div>
                      )}
                    </div>
                  </div>
    </>
  );
}
