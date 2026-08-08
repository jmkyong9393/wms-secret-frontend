'use client';

import { useState } from 'react';
import { Printer, X } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { LpnPrintLabel } from '@/features/inbound/components/LpnPrintLabel';
import { labelsAPI } from '@/lib/api';
import type { LpnPrintData } from '../types';

/**
 * LPN 50x31mm 열전사 라벨 인쇄 모달 (공용).
 * 기존에는 admin/inventory, worker/inventory, worker/inspections 3곳이
 * 서로 다른 스킨으로 같은 모달을 중복 구현하고 있었다.
 *
 * 실제 인쇄는 브라우저 window.print()가 아니라 백엔드 /labels/print를 거쳐
 * LAN 라벨 프린터(Xprinter XP-423B, Raw TCP)로 직접 전송된다. 아래 미리보기는
 * 실물 배치 확인용이며 인쇄 결과와는 별개다.
 */
export function LpnPrintModal({
  data,
  onClose,
}: {
  data: LpnPrintData | null;
  onClose: () => void;
}) {
  const [isPrinting, setIsPrinting] = useState(false);

  if (!data) return null;

  const handlePrint = async () => {
    setIsPrinting(true);
    try {
      const result = await labelsAPI.printLpn(data.lpn_barcode);
      if (result.skipped) {
        alert('라벨 프린터가 비활성화되어 있습니다 (LABEL_PRINTER_ENABLED).');
      } else if (!result.sent && !result.queued) {
        alert('라벨 전송에 실패했습니다.');
      }
    } catch (e) {
      console.error(e);
      alert('라벨 프린터 통신 중 오류가 발생했습니다. 프린터 전원/LAN 연결을 확인해주세요.');
    } finally {
      setIsPrinting(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-black/60 z-50 flex items-center justify-center p-4" onClick={onClose}>
      <div
        className="bg-white dark:bg-gray-900 p-7 rounded-2xl shadow-2xl space-y-5 max-w-md w-full border border-gray-200 dark:border-gray-800 animate-in zoom-in-95 duration-150 text-gray-900 dark:text-white"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between border-b dark:border-gray-800 pb-3">
          <h3 className="text-base font-black text-gray-900 dark:text-white flex items-center gap-2">
            <Printer className="w-5 h-5 text-indigo-600 dark:text-indigo-400" /> 50x31mm 열전사 라벨 프린터 출력
          </h3>
          <button onClick={onClose} className="p-1.5 text-gray-400 hover:text-gray-700 dark:hover:text-gray-200 rounded-lg">
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="bg-gray-100 dark:bg-gray-800 p-4 rounded-xl border border-gray-200 dark:border-gray-700 flex flex-col items-center justify-center">
          <p className="text-xs font-bold text-gray-500 dark:text-gray-400 mb-2 font-mono">실물 라벨 규격 (가로 50mm × 세로 31mm)</p>
          <div className="bg-white text-gray-900 border-2 border-dashed border-gray-400 p-2 shadow-sm rounded">
            <LpnPrintLabel data={data} />
          </div>
        </div>

        <div className="flex items-center gap-2 pt-2">
          <Button
            onClick={handlePrint}
            disabled={isPrinting}
            className="flex-1 bg-indigo-600 hover:bg-indigo-700 disabled:bg-indigo-400 text-white font-black text-sm py-3 rounded-xl shadow-xs"
          >
            <Printer className="w-4 h-4 mr-2" /> {isPrinting ? '전송 중...' : '🖨️ 라벨 프린터로 인쇄'}
          </Button>
          <Button
            onClick={onClose}
            variant="outline"
            className="py-3 px-5 border-gray-300 dark:border-gray-700 text-gray-700 dark:text-gray-300 font-extrabold text-sm rounded-xl"
          >
            닫기
          </Button>
        </div>
      </div>
    </div>
  );
}
