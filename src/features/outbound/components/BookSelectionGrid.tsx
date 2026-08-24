'use client';

import type { OutboundBook } from '@/features/outbound/model/types';
import { Package, Search, Check } from 'lucide-react';
import BookCover from '@/entities/book/ui/BookCover';

/** 출고 대상 도서 검색·유형 필터·수량 스테퍼 선택 그리드. */
export function BookSelectionGrid({
  inventoryCount,
  filteredBooks,
  outboundBookTypeFilter,
  setOutboundBookTypeFilter,
  searchTerm,
  setSearchTerm,
  selectedBookIds,
  toggleBookSelection,
  handleSelectAllBooks,
  handleDeselectAllBooks,
  totalBooksCount,
  getBookQty,
  setBookQty,
}: {
  inventoryCount: number;
  filteredBooks: OutboundBook[];
  outboundBookTypeFilter: 'ALL' | 'NEW' | 'USED';
  setOutboundBookTypeFilter: (f: 'ALL' | 'NEW' | 'USED') => void;
  searchTerm: string;
  setSearchTerm: (s: string) => void;
  selectedBookIds: string[];
  toggleBookSelection: (id: string) => void;
  handleSelectAllBooks: () => void;
  handleDeselectAllBooks: () => void;
  totalBooksCount: number;
  getBookQty: (id: string) => number;
  setBookQty: (id: string, qty: number, maxStock?: number) => void;
}) {
  return (
          <div className="space-y-2.5">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
              <div className="flex items-center gap-2">
                <span className="font-extrabold text-sm text-gray-900 dark:text-white flex items-center gap-1.5">
                  <Package className="w-4 h-4 text-indigo-600 dark:text-indigo-400" />
                  출고 대상 도서 선택
                </span>
                <span className="text-xs text-gray-500 font-mono">({inventoryCount}개 항목)</span>
              </div>

              <div className="flex items-center gap-2">
                {/* Book Type Filter Tabs (ALL / NEW / USED) */}
                <div className="flex items-center gap-1 bg-gray-100 dark:bg-gray-800 p-0.5 rounded-lg border border-gray-200 dark:border-gray-700">
                  <button
                    onClick={() => setOutboundBookTypeFilter('ALL')}
                    className={`px-2 py-0.5 rounded font-black text-[10px] transition-all ${
                      outboundBookTypeFilter === 'ALL'
                        ? 'bg-white dark:bg-gray-900 text-gray-900 dark:text-white shadow-2xs'
                        : 'text-gray-500 hover:text-gray-900'
                    }`}
                  >
                    📚 전체
                  </button>
                  <button
                    onClick={() => setOutboundBookTypeFilter('NEW')}
                    className={`px-2 py-0.5 rounded font-black text-[10px] transition-all ${
                      outboundBookTypeFilter === 'NEW'
                        ? 'bg-blue-600 text-white shadow-2xs'
                        : 'text-blue-600 dark:text-blue-400 hover:bg-blue-50'
                    }`}
                  >
                    ✨ 신품만
                  </button>
                  <button
                    onClick={() => setOutboundBookTypeFilter('USED')}
                    className={`px-2 py-0.5 rounded font-black text-[10px] transition-all ${
                      outboundBookTypeFilter === 'USED'
                        ? 'bg-purple-600 text-white shadow-2xs'
                        : 'text-purple-600 dark:text-purple-400 hover:bg-purple-50'
                    }`}
                  >
                    📦 중고만
                  </button>
                </div>

                <button
                  onClick={handleSelectAllBooks}
                  className="px-2 py-0.5 bg-indigo-50 dark:bg-indigo-950 text-indigo-700 dark:text-indigo-300 border border-indigo-200 dark:border-indigo-800 rounded text-[10px] font-bold hover:bg-indigo-100 cursor-pointer"
                >
                  ✓ 전체 선택
                </button>
                <button
                  onClick={handleDeselectAllBooks}
                  className="px-2 py-0.5 bg-rose-50 dark:bg-rose-950 text-rose-700 dark:text-rose-300 border border-rose-200 dark:border-rose-800 rounded text-[10px] font-bold hover:bg-rose-100 cursor-pointer"
                >
                  ✕ 전체 해제
                </button>
                <span className="text-[10px] font-mono text-indigo-600 dark:text-indigo-400 font-extrabold bg-indigo-50 dark:bg-indigo-950 px-2 py-0.5 rounded border border-indigo-200 dark:border-indigo-800">
                  총 {totalBooksCount}권 선택됨
                </span>
              </div>
            </div>

            {/* Real-time Multi-Search Bar */}
            <div className="relative">
              <Search className="w-3.5 h-3.5 text-gray-400 absolute left-3 top-2.5" />
              <input
                type="text"
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                placeholder="도서 제목, ISBN 또는 LPN 바코드 검색..."
                className="w-full pl-8 pr-3 py-1.5 bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-700 rounded-lg text-xs font-sans outline-none focus:border-indigo-500 shadow-2xs font-mono"
              />
            </div>

            {/* 3-Column Responsive Grid Container with Quantity Steppers */}
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2.5 pt-1 max-h-[310px] overflow-y-auto pr-1">
              {filteredBooks
                .filter(b => {
                  const isUsed = !b.isNew && !!b.lpn && !b.lpn.includes('미발급');
                  if (outboundBookTypeFilter === 'NEW') return !isUsed;
                  if (outboundBookTypeFilter === 'USED') return isUsed;
                  return true;
                })
                .map((b) => {
                  const isChecked = selectedBookIds.includes(b.id);
                  const isUsed = !b.isNew && !!b.lpn && !b.lpn.includes('미발급');
                  const lpnShort = b.lpn ? b.lpn.replace('LPN-', '') : null;
                  const width = Math.round(b.width_mm || b.width || 185);
                  const depth = Math.round(b.depth_mm || b.depth || 257);
                  const thick = Math.round(b.thickness_mm || 20);
                  const currentQty = getBookQty(b.id);

                  return (
                    <div
                      key={b.id}
                      // 카드 전체가 선택 토글 영역 — 제목 행만 클릭되고 금액·배지 행은 반응하지
                      // 않던 불일치 해소 (우측 박스 선택 카드와 동일한 상호작용). 수량 스테퍼 등
                      // 자체 동작이 있는 버튼은 가드로 제외.
                      onClick={(e) => {
                        if ((e.target as HTMLElement).closest('button')) return;
                        toggleBookSelection(b.id);
                      }}
                      className={`p-2.5 rounded-xl border text-left transition-all space-y-1.5 min-w-0 cursor-pointer ${
                        isChecked
                          ? 'bg-indigo-50/90 dark:bg-indigo-950/80 border-indigo-500 ring-2 ring-indigo-500/20 shadow-xs'
                          : 'bg-white dark:bg-gray-800 border-gray-200 dark:border-gray-700 hover:border-indigo-300'
                      }`}
                    >
                      {/* Row 1: BookCover + Title & Checkbox */}
                      <div className="flex items-start justify-between gap-2">
                        <div className="flex items-center gap-2 min-w-0 flex-1">
                          <input
                            type="checkbox"
                            checked={isChecked}
                            readOnly
                            className="w-3.5 h-3.5 mt-0.5 accent-indigo-600 rounded cursor-pointer shrink-0"
                          />
                          <BookCover
                            src={b.cover_image_url}
                            title={b.title}
                            author={b.author}
                            isbn={b.isbn}
                            className="w-9 h-12 shadow-2xs shrink-0"
                          />
                          <div className="min-w-0 flex-1">
                            <span className="font-extrabold text-xs text-gray-900 dark:text-white line-clamp-1 leading-snug">
                              {b.title}
                            </span>
                            <span className="text-[10px] text-gray-400 font-mono block truncate">
                              {b.author || '저자미상'} · {b.publisher || '출판사미상'}
                            </span>
                          </div>
                        </div>
                        {isChecked && <Check className="w-4 h-4 text-indigo-600 shrink-0 mt-0.5" />}
                      </div>

                      {/* Row 2: Badge & Full Price */}
                      <div className="flex items-center justify-between gap-1 pt-1">
                        {isUsed ? (
                          <span className="px-2 py-0.5 bg-purple-100 dark:bg-purple-950 text-purple-700 dark:text-purple-300 font-mono font-black text-[10px] rounded-md border border-purple-200 dark:border-purple-800 shrink-0">
                            📦 중고 {lpnShort ? `[${lpnShort}]` : ''}
                          </span>
                        ) : (
                          <span className="px-2 py-0.5 bg-blue-100 dark:bg-blue-950 text-blue-700 dark:text-blue-300 font-mono font-black text-[10px] rounded-md border border-blue-200 dark:border-blue-800 shrink-0">
                            ✨ 신품
                          </span>
                        )}

                        <span className="font-mono font-extrabold text-xs text-gray-900 dark:text-gray-100 shrink-0">
                          {(b.listPrice || 0).toLocaleString()}원
                        </span>
                      </div>

                      {/* Row 3: Specs & Quantity Stepper */}
                      <div className="flex items-center justify-between text-[10px] text-gray-500 dark:text-gray-400 font-mono pt-1 border-t border-gray-100 dark:border-gray-700/60">
                        <span>{width}×{depth}×{thick}mm</span>

                        {/* Quantity Stepper (Enabled for NEW books, Locked 1-qty for USED LPN books) */}
                        {isUsed ? (
                          <span className="font-mono font-black text-purple-600 dark:text-purple-400 text-[10px] bg-purple-50 dark:bg-purple-950 px-2 py-0.5 rounded border border-purple-200 dark:border-purple-800">
                            1권 고정 (LPN 1:1)
                          </span>
                        ) : (
                          <div className="flex items-center gap-1 bg-gray-100 dark:bg-gray-900 p-0.5 rounded-lg border border-gray-200 dark:border-gray-700">
                            <button
                              type="button"
                              onClick={(e) => {
                                e.stopPropagation();
                                if (!isChecked) toggleBookSelection(b.id);
                                setBookQty(b.id, currentQty - 1, b.stock_qty);
                              }}
                              className="w-4 h-4 rounded bg-white dark:bg-gray-800 text-gray-700 dark:text-gray-200 font-black text-[10px] flex items-center justify-center hover:bg-gray-200 dark:hover:bg-gray-700 active:scale-90"
                            >
                              -
                            </button>
                            <span className="font-mono font-black text-blue-600 dark:text-blue-400 text-xs px-1">
                              {currentQty}권
                            </span>
                            <button
                              type="button"
                              disabled={currentQty >= (b.stock_qty || 1)}
                              onClick={(e) => {
                                e.stopPropagation();
                                if (!isChecked) toggleBookSelection(b.id);
                                setBookQty(b.id, currentQty + 1, b.stock_qty);
                              }}
                              className="w-4 h-4 rounded bg-white dark:bg-gray-800 text-gray-700 dark:text-gray-200 font-black text-[10px] flex items-center justify-center hover:bg-gray-200 dark:hover:bg-gray-700 active:scale-90 disabled:opacity-30 disabled:cursor-not-allowed cursor-pointer"
                              title={`DB 실시간 가용 재고: ${b.stock_qty || 0}권`}
                            >
                              +
                            </button>
                            <span className="text-[9px] font-mono text-gray-500 font-bold pl-0.5">
                              (DB재고:{b.stock_qty || 0}권)
                            </span>
                          </div>
                        )}
                      </div>
                    </div>
                  );
                })}
            </div>
          </div>
  );
}
