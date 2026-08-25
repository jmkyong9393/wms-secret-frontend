'use client';

import { RefreshCcw } from 'lucide-react';

/** 판정 완료 후 다음 스캔 진입 패널. */
export function ResultPanel({ onNextScan }: { onNextScan: () => void }) {
  return (
          <div className="pt-4 animate-in fade-in">
            <button 
              onClick={onNextScan}
              className="w-full bg-gray-800 hover:bg-gray-900 dark:bg-gray-700 dark:hover:bg-gray-600 text-white py-4 rounded-xl font-bold flex items-center justify-center transition-all shadow-lg shadow-gray-300 dark:shadow-none"
            >
              <RefreshCcw className="w-5 h-5 mr-2" />
              다음 도서 스캔하기
            </button>
          </div>
  );
}
