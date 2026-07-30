"use client";

import { useState } from "react";
import { X, ChevronLeft, ChevronRight, Eye, BookOpen, AlertCircle } from "lucide-react";
import { Button } from "@/components/ui/button";
import type { HitlTask } from "@/features/hitl/types/hitl";

interface HitlImageModalProps {
  task: HitlTask | null;
  onClose: () => void;
}

export function HitlImageModal({ task, onClose }: HitlImageModalProps) {
  const [currentIdx, setCurrentIdx] = useState(0);
  const [showOverlay, setShowOverlay] = useState(true);
  const [imgError, setImgError] = useState(false);
  const [isZoomed, setIsZoomed] = useState(false);

  if (!task) return null;

  const images = task.image_urls && task.image_urls.length > 0 ? task.image_urls : [];
  const currentImageUrl = images[currentIdx] || "";
  
  // 이미지 '마다' (Per-Image) 정밀 Multi-BBox 동적 파싱
  const rawList: any[] = task.agent_logs?.defect_coordinates || [];
  let currentBBoxes: any[] = [];

  rawList.forEach((item: any) => {
    // 1) 구조화된 Per-Image 포맷: { image_index: 0, bboxes: [...] }
    if (item.image_index !== undefined && Number(item.image_index) === currentIdx && Array.isArray(item.bboxes)) {
      currentBBoxes = [...currentBBoxes, ...item.bboxes];
    } else if (item.image_url !== undefined && item.image_url === currentImageUrl && Array.isArray(item.bboxes)) {
      currentBBoxes = [...currentBBoxes, ...item.bboxes];
    } 
    // 2) 평탄화(Flat) BBox 포맷: { image_idx: 0, xmin: ..., ymin: ... }
    else if (item.xmin !== undefined && item.ymin !== undefined) {
      if (item.image_idx !== undefined && Number(item.image_idx) === currentIdx) {
        currentBBoxes.push(item);
      } else if (item.image_index !== undefined && Number(item.image_index) === currentIdx) {
        currentBBoxes.push(item);
      } else if (item.image_idx === undefined && item.image_index === undefined) {
        currentBBoxes.push(item);
      }
    }
  });

  return (
    <>
      <div
        className="fixed inset-0 z-50 bg-gray-900/60 backdrop-blur-sm flex items-center justify-center p-4 transition-all"
        onClick={onClose}
      >
        <div
          className="bg-white rounded-2xl shadow-2xl border border-gray-200 w-full max-w-4xl max-h-[90vh] flex flex-col overflow-hidden text-gray-900"
          onClick={(e) => e.stopPropagation()}
        >
          {/* Header */}
          <div className="flex items-center justify-between px-6 py-4 border-b border-gray-100 bg-gray-50/50">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-blue-50 text-blue-600 rounded-lg border border-blue-100">
                <BookOpen className="w-5 h-5" />
              </div>
              <div>
                <h3 className="text-base font-bold text-gray-900 line-clamp-1">
                  결함 원본 이미지 검수 — {task.book_title || "도서"}
                </h3>
                <p className="text-xs text-gray-500 mt-0.5 font-mono">
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
              <button
                onClick={onClose}
                className="p-1.5 rounded-full hover:bg-gray-200 text-gray-400 hover:text-gray-700 transition-colors"
              >
                <X className="w-5 h-5" />
              </button>
            </div>
          </div>

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
                  alt={`defect-${currentIdx}`}
                  onError={() => setImgError(true)}
                  className="max-w-full max-h-[65vh] w-auto h-auto object-contain rounded shadow-lg group-hover:opacity-95 transition-opacity block"
                />
                <div className="absolute bottom-3 right-3 bg-black/70 backdrop-blur-md text-white text-xs px-3 py-1.5 rounded-lg opacity-0 group-hover:opacity-100 transition-opacity font-extrabold flex items-center gap-1.5 shadow-xl pointer-events-none">
                  <span>🔍 클릭하여 확대검수</span>
                </div>
                {showOverlay &&
                  currentBBoxes.map((box: any, idx: number) => {
                    // 100% 정밀 BBox 스케일링: 정규화(0~1) 또는 1000px 해상도 기준 퍼센트 변환
                    const scale = (box.xmin > 1 || box.ymin > 1) ? 1000 : (box.xmin > 0.01 ? 1 : 100);
                    const left = Math.max(0, Math.min(95, (box.xmin / scale) * 100));
                    const top = Math.max(0, Math.min(95, (box.ymin / scale) * 100));
                    const width = Math.max(4, Math.min(100 - left, ((box.xmax - box.xmin) / scale) * 100));
                    const height = Math.max(4, Math.min(100 - top, ((box.ymax - box.ymin) / scale) * 100));
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

            {/* Navigation Controls */}
            {images.length > 1 && (
              <>
                <button
                  onClick={() => {
                    setImgError(false);
                    setCurrentIdx((prev) => (prev > 0 ? prev - 1 : images.length - 1));
                  }}
                  className="absolute left-4 p-2.5 rounded-full bg-white/80 text-gray-800 hover:bg-white transition-all shadow-md"
                >
                  <ChevronLeft className="w-5 h-5" />
                </button>
                <button
                  onClick={() => {
                    setImgError(false);
                    setCurrentIdx((prev) => (prev < images.length - 1 ? prev + 1 : 0));
                  }}
                  className="absolute right-4 p-2.5 rounded-full bg-white/80 text-gray-800 hover:bg-white transition-all shadow-md"
                >
                  <ChevronRight className="w-5 h-5" />
                </button>
              </>
            )}
          </div>

          {/* Footer & Notes Section */}
          <div className="px-6 py-4 bg-gray-50 border-t border-gray-100 flex flex-col gap-3">
            {/* AI Special Notes Badge */}
            {task.special_notes && (
              <div className="flex items-center gap-2 px-3.5 py-2 bg-amber-50 border border-amber-200 rounded-lg text-xs text-amber-900">
                <span className="font-bold bg-amber-200/80 px-2 py-0.5 rounded text-[11px] text-amber-950">
                  AI 시각 특이사항 (special_notes)
                </span>
                <span className="line-clamp-1">{task.special_notes}</span>
              </div>
            )}

            <div className="flex items-center justify-between">
              <div className="flex gap-2 overflow-x-auto py-1">
                {images.map((url, idx) => (
                  <button
                    key={idx}
                    onClick={() => {
                      setImgError(false);
                      setCurrentIdx(idx);
                    }}
                    className={`w-12 h-16 rounded overflow-hidden border-2 transition-all bg-gray-200 ${
                      currentIdx === idx ? "border-blue-600 ring-2 ring-blue-100 scale-105" : "border-gray-200 opacity-60 hover:opacity-100"
                    }`}
                  >
                    <img
                      src={url}
                      alt={`thumb-${idx}`}
                      className="w-full h-full object-cover"
                      onError={(e) => {
                        (e.target as HTMLElement).style.display = "none";
                      }}
                    />
                  </button>
                ))}
              </div>

              <div className="text-right text-xs text-gray-500">
                <div className="flex items-center justify-end gap-2">
                  {task.inspection_type && (
                    <span className={`px-2 py-0.5 text-[11px] font-bold rounded ${
                      task.inspection_type === "BUYBACK" ? "bg-purple-100 text-purple-700 border border-purple-200" : "bg-blue-100 text-blue-700 border border-blue-200"
                    }`}>
                      {task.inspection_type === "BUYBACK" ? "중고 바이백 정산" : "고객 반품 환불"}
                    </span>
                  )}
                  <span>이미지 <strong className="text-gray-900">{images.length > 0 ? currentIdx + 1 : 0}</strong> / {images.length}</span>
                </div>
                {task.ubci_score !== undefined && (
                  <div className="mt-1 text-blue-600 font-bold">
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
                const scale = (box.xmin > 1 || box.ymin > 1) ? 1000 : (box.xmin > 0.01 ? 1 : 100);
                const left = Math.max(0, Math.min(95, (box.xmin / scale) * 100));
                const top = Math.max(0, Math.min(95, (box.ymin / scale) * 100));
                const width = Math.max(4, Math.min(100 - left, ((box.xmax - box.xmin) / scale) * 100));
                const height = Math.max(4, Math.min(100 - top, ((box.ymax - box.ymin) / scale) * 100));
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
