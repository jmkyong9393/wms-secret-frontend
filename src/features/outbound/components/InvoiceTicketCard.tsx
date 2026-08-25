'use client';

import { QrCode } from 'lucide-react';
import type { BoxOption } from '../constants/boxOptions';

/** 패킹 확정 시 발급되는 B2B 출고 운송장 티켓. */
export function InvoiceTicketCard({ activeBox, issuedWaybillNo, totalBooksCount, newQtyTotal, usedQtyTotal, displayTotalPrice, customerName, issuedAt }: {
  activeBox: BoxOption;
  issuedWaybillNo: string | null;
  totalBooksCount: number;
  newQtyTotal: number;
  usedQtyTotal: number;
  displayTotalPrice: number;
  customerName?: string;
  issuedAt: string;
}) {
  return (
            <div className="bg-amber-50/90 dark:bg-amber-950/50 p-5 rounded-2xl border-2 border-amber-400 dark:border-amber-700 shadow-lg space-y-3 animate-in slide-in-from-top-4 duration-300">
              <div className="flex items-center justify-between border-b border-amber-200 dark:border-amber-800 pb-2.5">
                <div className="flex items-center gap-2">
                  <QrCode className="w-5 h-5 text-amber-700 dark:text-amber-300" />
                  <span className="font-black text-sm text-amber-950 dark:text-amber-100 tracking-tight">
                    📦 B2B 자동 발급 출고 운송장 (Shipping Invoice Ticket)
                  </span>
                </div>
                <span className="px-2.5 py-0.5 bg-amber-600 text-white font-mono font-black text-[10px] rounded-full">
                  발급완료 (VERIFIED)
                </span>
              </div>

              <div className="bg-white dark:bg-gray-900 p-4 rounded-xl border border-amber-200 dark:border-amber-800/80 space-y-2 font-mono text-xs shadow-inner">
                <div className="flex justify-between items-center text-gray-700 dark:text-gray-300">
                  <span className="font-extrabold text-amber-700 dark:text-amber-400">운송장 번호 (Invoice No.)</span>
                  <span className="font-black text-sm text-indigo-900 dark:text-indigo-200">
                    {issuedWaybillNo || 'NEXUS-20260731-88491'}
                  </span>
                </div>

                <div className="flex justify-between items-center text-gray-600 dark:text-gray-400 pt-1 border-t dark:border-gray-800">
                  <span>지정 택배사 / 포장 박스</span>
                  <span className="font-bold text-gray-900 dark:text-white">
                    CJ대한통운 | {activeBox.name} ({activeBox.specs})
                  </span>
                </div>

                <div className="flex justify-between items-center text-gray-600 dark:text-gray-400">
                  <span>출고 적재 내역</span>
                  <span className="font-bold text-emerald-600 dark:text-emerald-400">
                    총 {totalBooksCount}권 (신품 {newQtyTotal}권 + 중고 {usedQtyTotal}권)
                  </span>
                </div>

                {/* Total Settlement Amount - 백엔드 Two-Track 확정가 */}
                <div className="flex justify-between items-center text-indigo-950 dark:text-indigo-200 font-bold bg-amber-100/60 dark:bg-amber-950/80 p-2 rounded-lg border border-amber-300 dark:border-amber-800">
                  <span>총 결제 금액 (Total Order Price)</span>
                  <span className="font-black text-sm text-indigo-700 dark:text-indigo-300">
                    {displayTotalPrice > 0 ? displayTotalPrice.toLocaleString() : '-'} 원
                  </span>
                </div>

                <div className="flex justify-between items-center text-gray-600 dark:text-gray-400">
                  <span>수령 거래처 / 도착지</span>
                  <span className="font-bold text-gray-900 dark:text-white">
                    {customerName || '교보문고 B2B 물류센터 (인천)'}
                  </span>
                </div>

                {/* Barcode Scanner Image / Visual Bar */}
                <div className="pt-2 flex flex-col items-center justify-center space-y-1">
                  <div className="tracking-widest text-lg font-mono font-black text-gray-800 dark:text-gray-200 select-none">
                    ||||| |||||| | |||||||| ||||| |||||
                  </div>
                  <span className="text-[9px] text-gray-400 font-mono">{issuedWaybillNo || 'NEXUS-20260731-88491'}</span>
                </div>
              </div>

              <div className="flex items-center justify-between text-[11px] text-amber-800 dark:text-amber-300 font-bold px-1">
                <span>발급 일시: {issuedAt || '—'}</span>
                <span className="text-indigo-600 dark:text-indigo-400 underline cursor-pointer">
                  🖨️ 송장 출력 (Print Label)
                </span>
              </div>
            </div>
  );
}
