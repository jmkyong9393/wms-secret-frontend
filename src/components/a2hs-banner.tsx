'use client';

import { useState, useEffect } from 'react';
import { useA2HS } from '@/hooks/use-a2hs';
import { Button } from '@/components/ui/button';
import { Download, X } from 'lucide-react';

export function A2HSBanner() {
  const { isInstallable, promptToInstall } = useA2HS();
  const [isVisible, setIsVisible] = useState(false);

  useEffect(() => {
    if (isInstallable) {
      setIsVisible(true);
    }
  }, [isInstallable]);

  if (!isVisible || !isInstallable) {
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
          onClick={() => setIsVisible(false)}
          className="rounded-md p-1.5 text-blue-400 hover:bg-blue-100 hover:text-blue-600 focus:outline-none"
          aria-label="닫기"
        >
          <X className="h-4 w-4" />
        </button>
      </div>
    </div>
  );
}
