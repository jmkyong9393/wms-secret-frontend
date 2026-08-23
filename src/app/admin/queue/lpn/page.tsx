'use client';
import { API_BASE_URL } from '@/shared/api/api-client';

import { useState, useEffect } from 'react';
import { Printer, RefreshCcw, Search, Barcode, CheckCircle } from 'lucide-react';
import { labelsAPI } from '@/shared/api/api';

type LpnRecord = {
  lpn_barcode: string;
  book_id: string;
  status: string;
};

export default function LpnDashboardPage() {
  const [lpns, setLpns] = useState<LpnRecord[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [isPrinting, setIsPrinting] = useState<string | null>(null);

  useEffect(() => {
    fetchLpns();
  }, []);

  const fetchLpns = async () => {
    setIsLoading(true);
    try {
      // API call to the backend router we created
      const res = await fetch(`${API_BASE_URL}/api/v1/inventory/lpn`);
      if (res.ok) {
        const data = await res.json();
        setLpns(data);
      }
    } catch (error) {
      console.error("LPN 목록을 가져오는데 실패했습니다.", error);
      // Fallback Mock Data for UI demonstration
      setLpns([
        { lpn_barcode: 'LPN-20260721-ABCD1234', book_id: 'uuid-book-1', status: 'PENDING_INSPECTION' },
        { lpn_barcode: 'LPN-20260721-EFGH5678', book_id: 'uuid-book-2', status: 'IN_STOCK' }
      ]);
    } finally {
      setIsLoading(false);
    }
  };

  const handlePrint = async (lpn: string) => {
    setIsPrinting(lpn);
    try {
      const result = await labelsAPI.printLpn(lpn);
      if (result.skipped) {
        alert("라벨 프린터가 비활성화되어 있습니다 (LABEL_PRINTER_ENABLED).");
      } else if (!result.sent && !result.queued) {
        alert("라벨 전송에 실패했습니다.");
      }
    } catch (e) {
      console.error(e);
      alert("라벨 프린터 통신 중 오류가 발생했습니다. 프린터 전원/LAN 연결을 확인해주세요.");
    } finally {
      setIsPrinting(null);
    }
  };

  return (
    <div className="p-8 max-w-6xl mx-auto space-y-6">
      <div className="flex justify-between items-center bg-white dark:bg-gray-900 p-6 rounded-2xl shadow-sm border border-slate-200 dark:border-gray-800">
        <div>
          <h1 className="text-2xl font-extrabold text-slate-800 dark:text-gray-100 flex items-center">
            <Barcode className="w-8 h-8 mr-3 text-blue-600" />
            LPN 바코드 관리 (Dashboard)
          </h1>
          <p className="text-slate-500 dark:text-gray-400 mt-1">발급된 전체 LPN 이력을 조회하고 누락된 라벨을 재출력할 수 있습니다.</p>
        </div>
        <button
          onClick={fetchLpns}
          disabled={isLoading}
          className="bg-slate-100 dark:bg-gray-800 hover:bg-slate-200 dark:hover:bg-gray-700 text-slate-700 dark:text-gray-200 px-4 py-2 rounded-xl flex items-center font-bold transition-colors"
        >
          <RefreshCcw className={`w-4 h-4 mr-2 ${isLoading ? 'animate-spin' : ''}`} />
          새로고침
        </button>
      </div>

      <div className="bg-white dark:bg-gray-900 rounded-2xl shadow-sm border border-slate-200 dark:border-gray-800 overflow-hidden">
        <table className="w-full text-left border-collapse">
          <thead>
            <tr className="bg-slate-50 dark:bg-gray-800/60 border-b border-slate-200 dark:border-gray-800 text-slate-600 dark:text-gray-300 font-bold text-sm">
              <th className="p-4">LPN 바코드</th>
              <th className="p-4">도서 ID (Book UUID)</th>
              <th className="p-4">상태</th>
              <th className="p-4 text-right">액션 (재출력)</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {lpns.map((lpn, idx) => (
              <tr key={idx} className="hover:bg-blue-50/50 transition-colors">
                <td className="p-4 font-mono font-bold text-slate-800">
                  {lpn.lpn_barcode}
                </td>
                <td className="p-4 text-slate-500 text-sm">
                  {lpn.book_id}
                </td>
                <td className="p-4">
                  {lpn.status === 'PENDING_INSPECTION' || lpn.status === 'ALLOCATED' ? (
                    <span className="bg-amber-100 text-amber-700 px-2 py-1 rounded text-xs font-bold">검수 대기</span>
                  ) : (
                    <span className="bg-emerald-100 text-emerald-700 px-2 py-1 rounded text-xs font-bold flex items-center w-fit">
                      <CheckCircle className="w-3 h-3 mr-1" />
                      적재 완료
                    </span>
                  )}
                </td>
                <td className="p-4 text-right">
                  <button 
                    onClick={() => handlePrint(lpn.lpn_barcode)}
                    disabled={isPrinting === lpn.lpn_barcode}
                    className="bg-blue-600 hover:bg-blue-700 disabled:bg-blue-400 text-white px-4 py-2 rounded-lg font-bold flex items-center justify-end ml-auto transition-colors shadow-sm"
                  >
                    {isPrinting === lpn.lpn_barcode ? (
                      <RefreshCcw className="w-4 h-4 mr-2 animate-spin" />
                    ) : (
                      <Printer className="w-4 h-4 mr-2" />
                    )}
                    {isPrinting === lpn.lpn_barcode ? '출력 중...' : '프린트'}
                  </button>
                </td>
              </tr>
            ))}
            
            {lpns.length === 0 && !isLoading && (
              <tr>
                <td colSpan={4} className="p-8 text-center text-slate-400">발급된 LPN 내역이 없습니다.</td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
