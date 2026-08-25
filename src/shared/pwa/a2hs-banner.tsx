'use client';

import { useState } from 'react';
import { useA2HS } from '@/shared/pwa/use-a2hs';
import { Button } from '@/shared/ui/button';
import { Download, X } from 'lucide-react';

export function A2HSBanner() {
  const { isInstallable, promptToInstall } = useA2HS();
  // 표시 여부는 "설치 가능 && 사용자가 닫지 않음"의 파생값 - 이펙트로 복사할 상태가 아니다.
  const [dismissed, setDismissed] = useState(false);

  if (!isInstallable || dismissed) {
    return null;
  }

  return (
    <div className="fixed bottom-4 left-4 right-4 z-50 flex items-center justify-between gap-4 rounded-lg bg-blue-50 p-4 shadow-lg ring-1 ring-blue-900/10 md:bottom-8 md:left-auto md:right-8 md:w-[400px]">
      <div className="flex flex-1 flex-col gap-1">
        <p className="text-sm font-semibold text-blue-900">앱으로 더욱 편리하게!</p>
        <p className="text-xs text-blue-700">WMS를 홈 화면에 추가하고 전체 화면으로 사용해보세요.</p>
      </div>
      
      <div className="flex items-center gap-2">
        <Button 
          size="sm" 
          onClick={promptToInstall}
          className="bg-blue-600 text-white hover:bg-blue-700"
        >
          <Download className="mr-1.5 h-4 w-4" />
          설치하기
        </Button>
        <button 
          onClick={() => setDismissed(true)}
          className="rounded-md p-1.5 text-blue-400 hover:bg-blue-100 hover:text-blue-600 focus:outline-none"
          aria-label="닫기"
        >
          <X className="h-4 w-4" />
        </button>
      </div>
    </div>
  );
}
