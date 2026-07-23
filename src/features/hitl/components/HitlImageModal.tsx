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

  if (!task) return null;

  const images = task.image_urls && task.image_urls.length > 0 ? task.image_urls : [];
  const currentImageUrl = images[currentIdx] || "";
  const bboxes = task.agent_logs?.defect_coordinates || [];

  return (
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
            <div className="relative max-w-full max-h-[65vh] flex items-center justify-center">
              <img
                src={currentImageUrl}
                alt={`defect-${currentIdx}`}
                onError={() => setImgError(true)}
                className="max-w-full max-h-[65vh] object-contain rounded shadow-lg"
              />
              {showOverlay &&
                bboxes.map((box, idx) => (
                  <div
                    key={idx}
                    className="absolute border-2 border-red-500 bg-red-500/30 rounded shadow-sm animate-pulse"
                    style={{
                      left: `${box.x}%`,
                      top: `${box.y}%`,
                      width: `${box.width}%`,
                      height: `${box.height}%`,
                    }}
                  >
                    <span className="absolute -top-6 left-0 bg-red-600 text-white text-[10px] px-1.5 py-0.5 font-bold rounded shadow-sm">
                      결함 #{idx + 1}
                    </span>
                  </div>
                ))}
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
                AI 시뮬레이션 샘플 이미지 모드
              </p>

              {/* Virtual Defect Overlay on Fallback Canvas */}
              {showOverlay &&
                bboxes.map((box, idx) => (
                  <div
                    key={idx}
                    className="absolute border-2 border-red-500 bg-red-500/30 rounded animate-pulse"
                    style={{
                      left: `${box.x}%`,
                      top: `${box.y}%`,
                      width: `${box.width}%`,
                      height: `${box.height}%`,
                    }}
                  >
                    <span className="absolute -top-5 left-0 bg-red-600 text-white text-[10px] px-1.5 py-0.5 font-bold rounded shadow-sm">
                      결함 #{idx + 1}
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

        {/* Footer */}
        <div className="px-6 py-4 bg-gray-50 border-t border-gray-100 flex items-center justify-between">
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
            <div>
              이미지 <span className="font-bold text-gray-900">{images.length > 0 ? currentIdx + 1 : 0}</span> / {images.length}
            </div>
            {task.ubci_score !== undefined && (
              <div className="mt-0.5 text-blue-600 font-bold">
                UBCI 점수: <span className="text-sm">{task.ubci_score}</span>점
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
