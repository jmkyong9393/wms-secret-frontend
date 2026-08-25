'use client';

import { Camera, CheckCircle2 } from 'lucide-react';
import { TRACK1_IMAGE_COUNT, TRACK1_SHOTS } from '../captureSequence';

/** 촬영 진행 컨트롤 - 필수 컷 안내와 촬영/전송 버튼. */
export function CaptureControlsPanel({ capturedCount, isAnalyzing, isSubmitting, onTakePhoto, onSubmit }: {
  capturedCount: number;
  isAnalyzing: boolean;
  isSubmitting: boolean;
  onTakePhoto: () => void;
  onSubmit: () => void;
}) {
  return (
          <div className="space-y-4 pt-2 animate-in slide-in-from-right-4">
            <p className="text-center text-xs font-bold text-gray-600 dark:text-gray-300 mb-2">
              {TRACK1_SHOTS.map((s) => s.short).join(' · ')} 필수 {TRACK1_IMAGE_COUNT}장 + 훼손 부위 N장
            </p>
            {/* 남은 필수 컷을 명시한다. 버튼만 비활성화해 두면 왜 못 넘어가는지 알 수 없다. */}
            {capturedCount < TRACK1_IMAGE_COUNT && (
              <p className="text-center text-[11px] font-semibold text-amber-600 dark:text-amber-400 -mt-1 mb-1">
                남은 필수 촬영: {TRACK1_SHOTS.slice(capturedCount).map((s) => s.short).join(', ')}
              </p>
            )}
            
            <div className="flex gap-2">
              <button 
                onClick={onTakePhoto}
                disabled={isAnalyzing}
                className="flex-1 bg-slate-800 hover:bg-slate-900 disabled:bg-slate-400 text-white py-4 rounded-xl font-bold flex flex-col items-center justify-center transition-all shadow-lg"
              >
                <Camera className="w-6 h-6 mb-1" />
                <span>사진 촬영 ({capturedCount}장)</span>
                <span className="text-[10px] font-medium opacity-70 mt-0.5">화면 셔터 · Space/Enter</span>
              </button>

              <button 
                onClick={onSubmit}
                disabled={isSubmitting || capturedCount < TRACK1_IMAGE_COUNT}
                className="flex-1 bg-purple-600 hover:bg-purple-700 disabled:bg-purple-300 text-white py-4 rounded-xl font-bold flex flex-col items-center justify-center transition-all shadow-lg shadow-purple-200"
              >
                <CheckCircle2 className="w-6 h-6 mb-1" />
                <span>촬영 완료 (AI 전송)</span>
              </button>
            </div>
          </div>
  );
}
