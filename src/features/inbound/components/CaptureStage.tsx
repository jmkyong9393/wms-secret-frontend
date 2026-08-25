'use client';

import type { RefObject } from 'react';
import { Camera, RefreshCcw } from 'lucide-react';
import { shotLabel } from '../captureSequence';

/** 촬영 단계 무대 - ROI 가이드박스·화면 셔터·썸네일 갤러리 (비디오는 페이지가 렌더). */
export function CaptureStage({ guideBoxRef, currentShot, isAnalyzing, capturedImages, onTakePhoto }: {
  guideBoxRef: RefObject<HTMLDivElement | null>;
  currentShot: { guideClass: string; tip: string };
  isAnalyzing: boolean;
  capturedImages: { url: string; blob: Blob }[];
  onTakePhoto: () => void;
}) {
  return (
          <div className="absolute inset-0 w-full h-full z-10">
            {/* 오버레이 및 뷰파인더 가이드 */}
            <div className="absolute inset-0 z-10 flex flex-col items-center justify-center pointer-events-none pb-2 pt-12">
              {/* 바깥 영역을 어둡게 처리하기 위한 그림자 꼼수 */}
              {/* 가이드박스 크기는 촬영 단계마다 다르다. processImage()가 이 박스 영역만
                  도려내므로, 책등처럼 좁고 긴 피사체를 표지용 박스로 찍으면 배경이 대부분을
                  차지해 결함이 상대적으로 작아진다. */}
              <div
                ref={guideBoxRef}
                className={`relative ${currentShot.guideClass} max-h-[90%] border-4 border-dashed border-white/60 rounded-3xl flex items-center justify-center shadow-[0_0_0_9999px_rgba(0,0,0,0.5)]`}
              >
                
                {/* 십자선 */}
                <div className="absolute w-8 h-1 bg-white/40 rounded-full"></div>
                <div className="absolute w-1 h-8 bg-white/40 rounded-full"></div>

                {/* 툴팁 버블 */}
                <div className="absolute -top-12 bg-gray-800/80 backdrop-blur-sm text-white text-sm font-bold px-5 py-2 rounded-full shadow-lg text-center whitespace-nowrap">
                  {currentShot.tip}
                </div>

                {isAnalyzing && (
                  <div className="absolute inset-0 flex flex-col items-center justify-center bg-black/60 backdrop-blur-sm rounded-2xl z-20">
                    <RefreshCcw className="w-12 h-12 text-emerald-400 animate-spin mb-4" />
                    <span className="text-emerald-400 font-bold animate-pulse text-xl drop-shadow-lg shadow-black">AI 렌즈 판독 중...</span>
                  </div>
                )}
              </div>
            </div>

            {/* 화면 안 셔터.
                카드 하단의 촬영 버튼은 한 손으로 폰을 들고 책을 잡은 자세에서 엄지가
                닿지 않는다. 프리뷰 위에 큰 원형 셔터를 겹쳐 두어 손을 옮기지 않고 찍는다.
                (썸네일 갤러리보다 위에 배치해 서로 가리지 않게 한다.) */}
            <button
              type="button"
              onClick={onTakePhoto}
              disabled={isAnalyzing}
              aria-label="사진 촬영"
              className="absolute bottom-28 left-1/2 -translate-x-1/2 z-30 w-20 h-20 rounded-full bg-white/95 disabled:bg-white/40 shadow-2xl ring-4 ring-white/40 active:scale-90 transition-transform flex flex-col items-center justify-center cursor-pointer"
            >
              <Camera className="w-7 h-7 text-slate-900" />
              <span className="text-[10px] font-black text-slate-900 mt-0.5">{capturedImages.length}장</span>
            </button>

            {/* 썸네일 갤러리 */}
            <div className="absolute bottom-4 left-4 right-4 z-20 flex space-x-2 overflow-x-auto pb-2">
              {capturedImages.map((img, idx) => (
                <div key={idx} className="w-14 h-20 bg-slate-800 rounded-lg border-2 border-emerald-500 flex-shrink-0 flex items-center justify-center relative overflow-hidden">
                  <span className="absolute top-1 text-[10px] font-bold text-white z-10 drop-shadow-md bg-black/40 px-1 rounded">{shotLabel(idx)}</span>
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img src={img.url} alt="capture" className="w-full h-full object-cover" />
                  <div className="absolute inset-0 bg-white/10 pointer-events-none"></div>
                </div>
              ))}
            </div>
          </div>
  );
}
