'use client';

import { ScanLine } from 'lucide-react';

/** 바코드 수동 입력 패널 (스캔 실패·리더기 부재 시 폴백 경로). */
export function ScanBarcodePanel({ isbn, setIsbn, onLookup }: {
  isbn: string;
  setIsbn: (v: string) => void;
  onLookup: () => void;
}) {
  return (
          <div className="space-y-4 pt-4">
            <h3 className="font-bold text-gray-800 dark:text-gray-100 mb-2 text-center">도서 식별</h3>
            <div className="flex gap-2">
              <input
                type="text"
                placeholder="ISBN 또는 LPN (재촬영) 수동 입력"
                value={isbn}
                onChange={(e) => setIsbn(e.target.value)}
                /* min-w-0: flex 자식의 기본 min-width는 auto라 내용 폭 아래로 줄지 않는다.
                   이게 없으면 좁은 화면에서 입력창이 버튼을 밀어 버튼 글자가 세로로 접힌다. */
                className="flex-1 min-w-0 border border-gray-300 dark:border-slate-700 dark:bg-slate-800 dark:text-white rounded-xl px-4 py-3 focus:ring-2 focus:ring-emerald-500 outline-none font-mono"
              />
              <button 
                onClick={onLookup}
                /* shrink-0 + whitespace-nowrap: 버튼이 글자 폭 아래로 눌리면 '조 회'로 접힌다 */
                className="shrink-0 whitespace-nowrap bg-emerald-600 hover:bg-emerald-700 active:scale-95 text-white px-5 py-3 rounded-xl font-bold transition-all shadow-lg shadow-emerald-200 dark:shadow-none flex items-center gap-1.5"
              >
                <ScanLine className="w-4 h-4" />
                조회
              </button>
            </div>
          </div>
  );
}
