'use client';

/** 바코드 스캔 뷰파인더 - 코너 프레임·레이저 애니메이션·오독 경고. */
export function ScanViewfinder({ scanWarning }: { scanWarning: string | null }) {
  return (
          <div className="relative w-64 h-64 sm:w-72 sm:h-72 z-10">
            <div className="absolute top-0 left-0 w-12 h-12 border-t-4 border-l-4 border-emerald-500 rounded-tl-xl"></div>
            <div className="absolute top-0 right-0 w-12 h-12 border-t-4 border-r-4 border-emerald-500 rounded-tr-xl"></div>
            <div className="absolute bottom-0 left-0 w-12 h-12 border-b-4 border-l-4 border-emerald-500 rounded-bl-xl"></div>
            <div className="absolute bottom-0 right-0 w-12 h-12 border-b-4 border-r-4 border-emerald-500 rounded-br-xl"></div>
            <div className="absolute left-0 right-0 h-0.5 bg-emerald-500 shadow-[0_0_15px_3px_rgba(16,185,129,0.7)] animate-scan-laser z-10 w-full"></div>
            <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
              <span className="text-gray-400 dark:text-white/40 text-sm font-semibold tracking-wider text-center">도서 뒷면의 ISBN<br/>또는 재촬영 LPN QR 스캔</span>
            </div>
            {/* 오독 거절 안내. 아무 반응이 없으면 작업자는 원인을 모른 채 스캔만 반복한다. */}
            {scanWarning && (
              <div className="absolute -bottom-24 left-1/2 -translate-x-1/2 w-[19rem] max-w-[88vw] px-4 py-3 rounded-xl bg-amber-500/95 text-white text-xs font-bold text-center leading-relaxed shadow-lg z-20">
                {scanWarning}
              </div>
            )}
          </div>
  );
}
