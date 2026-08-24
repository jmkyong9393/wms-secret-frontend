'use client';
import type { PickingInstruction, DemoOrder, OutboundBook, PricingResult } from '@/features/outbound/model/types';

/** 동적 가격 산정 결과 요약 (Two-Track 확정가·수량 합산·라벨). */
export function PricingSummaryPanel({
  activeInstruction,
  mockOrder,
  selectedBooks,
  selectedBook,
  pricingResult,
  newQtyTotal,
  usedQtyTotal,
  totalBooksCount,
  perUnitAvgPrice,
  displayTotalPrice,
}: {
  activeInstruction: PickingInstruction | null;
  mockOrder: DemoOrder | null;
  selectedBooks: OutboundBook[];
  selectedBook: OutboundBook | null;
  pricingResult: PricingResult | null;
  newQtyTotal: number;
  usedQtyTotal: number;
  totalBooksCount: number;
  perUnitAvgPrice: number;
  displayTotalPrice: number;
}) {
  return (
          <div className="bg-gray-50 dark:bg-gray-800/60 rounded-xl p-4 border border-gray-200 dark:border-gray-700 space-y-2 text-xs">
            <div className="flex justify-between items-center">
              <span className="text-gray-500 dark:text-gray-400">
                {activeInstruction ? '피킹 지시서 / B2B 거래처' : '주문 ID / B2B 거래처'}
              </span>
              <span className="font-mono font-bold text-gray-900 dark:text-white">
                {activeInstruction
                  ? `${activeInstruction.instruction_no} [${activeInstruction.customer_name || 'B2B 거래처'}]`
                  : `${selectedBooks.length > 0 ? (mockOrder?.order_id || 'ORD-20260727-B2B') : 'ORD-20260727-B2B'} [${selectedBooks.length > 0 ? (mockOrder?.customer_name || '교보문고 B2B 지점') : '교보문고 B2B 지점'}]`}
              </span>
            </div>
            <div className="flex justify-between items-center">
              <span className="text-gray-500 dark:text-gray-400">도서명 / ISBN</span>
              <span className={`font-extrabold ${selectedBooks.length === 0 ? 'text-indigo-600 dark:text-indigo-400 italic' : 'text-gray-900 dark:text-white'}`}>
                {selectedBooks.length === 0 ? '출고할 도서를 위 체크박스에서 선택하세요.' : (mockOrder?.title || selectedBook?.title)}
                {selectedBooks.length > 0 && <span className="font-mono text-gray-400 font-normal"> ({mockOrder?.isbn || selectedBook?.isbn})</span>}
              </span>
            </div>
            <div className="flex justify-between items-center">
              <span className="text-gray-500 dark:text-gray-400">도서 DB 정가 (List Price)</span>
              <span className="font-mono font-bold text-gray-800 dark:text-gray-200">
                {selectedBooks.length === 0 ? '- 원' : `${mockOrder?.list_price?.toLocaleString() || selectedBook?.listPrice?.toLocaleString()} 원`}
              </span>
            </div>
            <div className="flex justify-between items-center">
              <span className="text-gray-500 dark:text-gray-400">AI UBCI 점수 / 보관일수</span>
              <span className="font-mono font-bold text-gray-800 dark:text-gray-200">
                {selectedBooks.length === 0 ? '-' : (!selectedBook?.isNew ? `${selectedBook?.ubciScore || 85}점 | ${selectedBook?.daysInInventory || 1}일 체류` : '미표기 (신품 Fast-Track 바이패스)')}
              </span>
            </div>
            <div className="flex justify-between items-center">
              <span className="text-gray-500 dark:text-gray-400">최적 동적 할인율 (δ*)</span>
              <span className="font-mono font-extrabold text-blue-600 dark:text-blue-400">
                {(() => {
                  if (selectedBooks.length === 0) return '-';
                  // 백엔드 Two-Track 계산 결과 라벨 우선 표시
                  if (pricingResult?.pricing_label) return pricingResult.pricing_label;
                  if (newQtyTotal > 0 && usedQtyTotal === 0) {
                    return '신품 도서정가제 준수 (10% 정율 할인 / 90% 법정가)';
                  } else if (newQtyTotal === 0 && usedQtyTotal > 0) {
                    return 'UBCI 정량 등급 기반 중고 동적 할인';
                  } else {
                    return `신품 10% + 중고 동적 복합 믹스 할인 (신품 ${newQtyTotal}권 + 중고 ${usedQtyTotal}권)`;
                  }
                })()}
              </span>
            </div>
            <div className="flex justify-between items-center">
              <span className="text-gray-500 dark:text-gray-400">총 발주 수량 (Total Books)</span>
              <span className="font-mono font-black text-indigo-600 dark:text-indigo-400">
                총 {totalBooksCount}권 (신품 {newQtyTotal}권 + 중고 {usedQtyTotal}권)
              </span>
            </div>
            <div className="flex justify-between items-center pt-2 border-t dark:border-gray-700 font-bold">
              <span className="text-blue-700 dark:text-blue-400">권당 기준 도매가 (P_final)</span>
              <span className="text-base font-mono text-blue-700 dark:text-blue-400">
                {selectedBooks.length > 0 ? perUnitAvgPrice.toLocaleString() : '-'} 원
              </span>
            </div>
            
            {/* Total Order Settlement Price - 백엔드 Two-Track 확정가 (신품 정율 / 중고 탄력성 모델 x 수량) */}
            <div className="flex justify-between items-center pt-2 border-t-2 border-indigo-500/50 text-indigo-950 dark:text-indigo-200">
              <span className="font-black text-sm">💰 총 출고 결제 금액 (Total Order Price)</span>
              <span className="text-xl font-mono font-black text-indigo-600 dark:text-indigo-400">
                {selectedBooks.length > 0 ? displayTotalPrice.toLocaleString() : '-'} 원
              </span>
            </div>

            <p className="text-[10px] text-slate-400 font-mono pt-1 text-right">
              {mockOrder?.optimization_model || 'XGBoost 2-Step Price Elasticity Revenue Optimization (도서정가제 준수)'}
            </p>
          </div>
  );
}
