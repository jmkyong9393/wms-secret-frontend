'use client';

import type { OutboundBook, CushionOption, PickingInstruction } from '@/features/outbound/model/types';
import { Box, CheckCircle2 } from 'lucide-react';
import BinPacking3DViewer from './BinPacking3DViewer';
import { BOOK_SLIM_BOX_OPTIONS, STANDARD_COURIER_BOX_OPTIONS, type BoxOption } from '../constants/boxOptions';

/** 16종 박스 적합성 그리드 + 3D 패킹 시뮬레이터 + 패킹 확정 버튼. */
export function BoxSelectionPanel({
  boxCategoryTab,
  setBoxCategoryTab,
  selectedBooks,
  getBookQty,
  selectedCushion,
  bestRecommendedBox,
  selectedBoxId,
  handleSelectBox,
  activeBox,
  selectedBook,
  aiReasoningLog,
  confirmed,
  activeInstruction,
  totalBooksCount,
  handleConfirmPacking,
}: {
  boxCategoryTab: 'slim' | 'standard';
  setBoxCategoryTab: (t: 'slim' | 'standard') => void;
  selectedBooks: OutboundBook[];
  getBookQty: (id: string) => number;
  selectedCushion: CushionOption | null;
  bestRecommendedBox: BoxOption;
  selectedBoxId: string;
  handleSelectBox: (box: BoxOption) => void;
  activeBox: BoxOption;
  selectedBook: OutboundBook | null;
  aiReasoningLog: string;
  confirmed: boolean;
  activeInstruction: PickingInstruction | null;
  totalBooksCount: number;
  handleConfirmPacking: () => void;
}) {
  return (
        <div className="bg-white dark:bg-gray-900 rounded-2xl border border-gray-200 dark:border-gray-800 shadow-xs p-6 space-y-4">
          <h3 className="text-base font-bold text-gray-900 dark:text-white flex items-center gap-2">
            <Box className="w-5 h-5 text-indigo-600 dark:text-indigo-400" /> 3D Bin Packing 규격 박스 추천
          </h3>
          <p className="text-xs text-gray-500 dark:text-gray-400">작업자가 16종 규격 박스(도서슬림 8종 + 일반택배 8종) 및 8종 산업용 완충재를 시뮬레이터에서 직접 선택하여 3D 유격 및 파손 방지 등급을 사전 검수 후 출고 패킹을 확정합니다.</p>

          {/* Category Tab Switcher: Book Slim vs Standard Courier */}
          <div className="flex items-center justify-between gap-2 bg-gray-100 dark:bg-gray-800/80 p-1.5 rounded-xl border border-gray-200 dark:border-gray-700 text-xs">
            <button
              onClick={() => setBoxCategoryTab('slim')}
              className={`flex-1 py-1.5 font-bold rounded-lg transition-all cursor-pointer ${
                boxCategoryTab === 'slim'
                  ? 'bg-indigo-600 text-white shadow-xs'
                  : 'text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-white'
              }`}
            >
              📖 도서 전용 슬림 박스 (8종)
            </button>
            <button
              onClick={() => setBoxCategoryTab('standard')}
              className={`flex-1 py-1.5 font-bold rounded-lg transition-all cursor-pointer ${
                boxCategoryTab === 'standard'
                  ? 'bg-indigo-600 text-white shadow-xs'
                  : 'text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-white'
              }`}
            >
              📦 일반 택배 표준 박스 (8종)
            </button>
          </div>

          {/* 8-Box Tabbed Grid with Dynamic AI Physical Bounding Box Containment Algorithm */}
          <div className="grid grid-cols-2 2xl:grid-cols-4 gap-3">
            {(boxCategoryTab === 'slim' ? BOOK_SLIM_BOX_OPTIONS : STANDARD_COURIER_BOX_OPTIONS).map((box) => {
              // 3D Bounding Box Containment Test (W, D, H Containment Test)
              const dim = box.specs.match(/(\d+)x(\d+)x(\d+)/);
              const bW = dim ? parseInt(dim[1]) : 250;
              const bD = dim ? parseInt(dim[2]) : 150;
              const bH = dim ? parseInt(dim[3]) : 60;
              const bMax = Math.max(bW, bD);
              const bMin = Math.min(bW, bD);

              let maxW = 0, maxD = 0, rawBooksTotalH = 0, totalQty = 0, booksTotalWeight_g = 0;
              selectedBooks.forEach(b => {
                const qty = getBookQty(b.id);
                const rawW = b.width_mm || b.width || 185;
                const rawD = b.depth_mm || b.depth || 257;
                maxW = Math.max(maxW, Math.max(rawW, rawD));
                maxD = Math.max(maxD, Math.min(rawW, rawD));
                rawBooksTotalH += (b.thickness_mm || b.height || 20) * qty;
                booksTotalWeight_g += (b.weight_g || 650) * qty;
                totalQty += qty;
              });

              // Dynamic Cushion Thickness & Mode Real-time Integration
              const activeCushThick = (selectedCushion?.thick_mm !== undefined) ? selectedCushion.thick_mm : 9.0;
              const activeCushMode = selectedCushion?.mode || 'top';

              const zCushThick = (activeCushMode === 'top' || activeCushMode === 'both') ? activeCushThick : 0.0;
              const sideCushThick = (activeCushMode === 'side' || activeCushMode === 'both') ? activeCushThick : 0.0;

              const reqMaxW = maxW + (2 * sideCushThick);
              const reqMaxD = maxD + (2 * sideCushThick);

              // Flexible 90° Orientation Footprint Fit Test (Case A: 0° placement vs Case B: 90° rotated placement)
              const isFitNormal = (bW >= reqMaxW && bD >= reqMaxD) || (bW >= reqMaxD && bD >= reqMaxW);
              const isFitRotated = (bMax >= reqMaxW && bMin >= reqMaxD);
              const isDimensionValid = selectedBooks.length === 0 || isFitNormal || isFitRotated;

              // Grid Stacking Height Calculation based on Optimal Orientation Layer Capacity
              const colsNormal = Math.max(1, Math.floor((bW - 2 * sideCushThick) / Math.max(1, Math.min(maxW, maxD))));
              const rowsNormal = Math.max(1, Math.floor((bD - 2 * sideCushThick) / Math.max(1, Math.max(maxW, maxD))));
              const colsRotated = Math.max(1, Math.floor((bW - 2 * sideCushThick) / Math.max(1, Math.max(maxW, maxD))));
              const rowsRotated = Math.max(1, Math.floor((bD - 2 * sideCushThick) / Math.max(1, Math.min(maxW, maxD))));
              const maxPerLayer = Math.max(1, Math.max(colsNormal * rowsNormal, colsRotated * rowsRotated));
              const layers = Math.ceil(totalQty / maxPerLayer);
              const avgThick = totalQty > 0 ? rawBooksTotalH / totalQty : 20;
              const gridStackH = layers * avgThick;

              const minRequiredH = selectedBooks.length > 0 ? gridStackH + zCushThick : 0;

              // Physical Size & Height & Weight Containment Test
              const isHeightExceeded = selectedBooks.length > 0 && (bH < minRequiredH);
              const isWeightExceeded = selectedBooks.length > 0 && (booksTotalWeight_g > box.maxWeight_kg * 1000);
              const isPhysicallyValid = selectedBooks.length === 0 || (isDimensionValid && !isHeightExceeded && !isWeightExceeded);
              const isRecommendedBox = box.id === bestRecommendedBox.id;

              return (
                <div 
                  key={box.id}
                  onClick={() => handleSelectBox(box)}
                  className={`p-3 rounded-xl border transition-all cursor-pointer space-y-1 relative ${
                    selectedBoxId === box.id 
                      ? 'bg-indigo-50/70 dark:bg-indigo-950/70 border-indigo-500 ring-2 ring-indigo-500/30' 
                      : isPhysicallyValid
                      ? 'bg-gray-50 dark:bg-gray-800/40 border-gray-200 dark:border-gray-700 hover:border-indigo-300'
                      : 'bg-red-50/40 dark:bg-red-950/20 border-red-200 dark:border-red-900/50 opacity-70'
                  }`}
                >
                  <div className="flex items-center justify-between gap-1 flex-wrap">
                    <span className="font-bold text-[11px] text-gray-900 dark:text-white truncate">{box.name}</span>
                    <div className="flex items-center gap-1 flex-wrap">
                      {isRecommendedBox && (
                        <span className="text-[9px] font-extrabold bg-emerald-500 text-white px-1.5 py-0.5 rounded shrink-0 whitespace-nowrap shadow-xs animate-pulse">추천</span>
                      )}
                      {isWeightExceeded && (
                        <span className="text-[9px] font-bold bg-amber-600 text-white px-1 py-0.5 rounded shrink-0 whitespace-nowrap">무게초과</span>
                      )}
                      {isHeightExceeded && (
                        <span className="text-[9px] font-bold bg-red-600 text-white px-1 py-0.5 rounded shrink-0 whitespace-nowrap">높이초과</span>
                      )}
                      {!isDimensionValid && (
                        <span className="text-[9px] font-bold bg-rose-500 text-white px-1 py-0.5 rounded shrink-0 whitespace-nowrap">크기초과</span>
                      )}
                    </div>
                  </div>
                  <p className="text-[10px] font-mono text-gray-500 dark:text-gray-400 flex items-center justify-between gap-1">
                    <span className="truncate">{box.specs}</span>
                    <span className="font-bold text-gray-600 dark:text-gray-300 whitespace-nowrap shrink-0">최대 {box.maxWeight_kg}kg</span>
                  </p>
                  <p className={`text-[11px] font-extrabold ${isPhysicallyValid ? 'text-indigo-600 dark:text-indigo-400' : 'text-red-500'}`}>
                    {isWeightExceeded 
                      ? `수용불가 (${(booksTotalWeight_g / 1000).toFixed(1)}kg 과적)` 
                      : isHeightExceeded
                      ? `수용불가 (높이 ${Math.round(minRequiredH)}mm 대형필요)`
                      : !isDimensionValid 
                      ? '수용불가 (크기초과)'
                      : `적재율 ${box.eff}%`}
                  </p>
                </div>
              );
            })}
          </div>

          {/* Interactive WebGL/CSS 3D Bin Packing Simulator */}
          <BinPacking3DViewer 
            selectedBox={activeBox} 
            selectedBook={selectedBook ? { ...selectedBook, quantity: getBookQty(selectedBook.id) } : null}
            selectedBooks={selectedBooks.map(b => ({ ...b, quantity: getBookQty(b.id) }))} 
            aiRecommendationLog={aiReasoningLog} 
          />

          <div className="pt-2 flex justify-end">
            <button
              onClick={handleConfirmPacking}
              disabled={!activeInstruction && totalBooksCount === 0}
              title={!activeInstruction && totalBooksCount === 0 ? '출고할 도서를 먼저 선택하세요' : undefined}
              className={`px-5 py-2.5 rounded-xl font-bold text-xs transition-all shadow-xs flex items-center gap-1.5 ${
                !activeInstruction && totalBooksCount === 0
                  ? 'bg-gray-200 dark:bg-gray-800 text-gray-400 dark:text-gray-600 cursor-not-allowed'
                  : confirmed
                    ? 'bg-emerald-600 text-white cursor-pointer'
                    : 'bg-gray-900 hover:bg-gray-800 dark:bg-gray-800 dark:hover:bg-gray-700 text-white cursor-pointer'
              }`}
            >
              <CheckCircle2 className="w-4 h-4" />
              <span>
                {!activeInstruction && totalBooksCount === 0
                  ? '도서 선택 필요'
                  : confirmed ? '3D Bin Packing 확정 완료' : '패킹 박스 확정'}
              </span>
            </button>
          </div>
        </div>
  );
}
