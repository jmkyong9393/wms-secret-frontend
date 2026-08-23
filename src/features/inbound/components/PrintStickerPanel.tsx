'use client';

import { Camera, Printer, RefreshCcw, Zap } from 'lucide-react';
import BookCover from '@/entities/book/ui/BookCover';

/** 도서 정보 확인 + 라벨 출력/Fast-track 입고 패널. */
export function PrintStickerPanel({
  isbn,
  bookInfo,
  isLoadingBook,
  inboundType,
  fasttrackQty,
  setFasttrackQty,
  currentLpn,
  isPrinting,
  onFasttrack,
  onPrintAndCapture,
  onSkipPrintCapture,
  onConfirmPrintAndCapture,
}: {
  isbn: string;
  bookInfo: any;
  isLoadingBook: boolean;
  inboundType: 'NEW_FASTTRACK' | 'USED_RETURN_INSPECTION';
  fasttrackQty: number;
  setFasttrackQty: React.Dispatch<React.SetStateAction<number>>;
  currentLpn: string;
  isPrinting: boolean;
  onFasttrack: () => void;
  onPrintAndCapture: () => void;
  onSkipPrintCapture: () => void;
  onConfirmPrintAndCapture: () => void;
}) {
  return (
          <div className="space-y-4 pt-4 animate-in slide-in-from-right-4">
            <div className="bg-slate-50 dark:bg-slate-800/90 p-4 rounded-2xl border border-slate-200 dark:border-slate-700/80 mb-2 shadow-inner transition-colors">
              <p className="text-[11px] font-bold text-slate-500 dark:text-slate-400 mb-2.5 uppercase tracking-wider">인식된 도서 정보 (ISBN: {isbn})</p>
              
              {isLoadingBook ? (
                <div className="flex items-center space-x-2 py-2">
                  <div className="w-4 h-4 border-2 border-emerald-500 border-t-transparent rounded-full animate-spin"></div>
                  <span className="text-sm text-gray-600 dark:text-gray-300 font-medium">알라딘 API 정보 불러오는 중...</span>
                </div>
              ) : bookInfo?.title ? (
                <div className="flex gap-3 items-start">
                  <BookCover
                    src={bookInfo?.imageUrl}
                    title={bookInfo?.title || '입고 도서'}
                    author={bookInfo?.author || ''}
                    isbn={isbn}
                    className="w-16 h-24"
                  />
                  <div className="flex-1 min-w-0">
                    <p className="text-[10px] text-emerald-600 dark:text-emerald-400 font-bold mb-0.5 truncate">{bookInfo.categoryName?.split('>').pop()}</p>
                    <p className="font-bold text-slate-900 dark:text-white text-sm leading-tight mb-1 line-clamp-2">{bookInfo.title}</p>
                    <p className="text-[11px] text-slate-500 dark:text-slate-400 mb-1">{bookInfo.author} | {bookInfo.publisher}</p>
                    {bookInfo.price && <p className="text-[11px] font-bold text-indigo-600 dark:text-indigo-400 mb-1">{bookInfo.price.toLocaleString()}원</p>}
                    {bookInfo.description && (
                      <p className="text-[10px] text-gray-400 line-clamp-2 leading-tight">
                        {bookInfo.description}
                      </p>
                    )}
                  </div>
                </div>
              ) : (
                <p className="font-bold text-gray-800 dark:text-gray-100">{bookInfo?.title || '미등록 도서'}</p>
              )}

              {inboundType === 'NEW_FASTTRACK' ? (
                <div className="mt-3 flex items-center justify-between border-t border-gray-200 dark:border-slate-700 pt-3">
                  <span className="text-xs font-bold text-slate-700 dark:text-slate-300">⚡ 입고 수량 (수량 기입 가능)</span>
                  <div className="flex items-center gap-2">
                    <button
                      type="button"
                      onClick={() => setFasttrackQty(prev => Math.max(1, prev - 1))}
                      className="w-8 h-8 rounded-lg bg-slate-200 hover:bg-slate-300 dark:bg-slate-700 dark:hover:bg-slate-600 font-bold text-slate-800 dark:text-slate-100 text-base flex items-center justify-center transition-colors"
                    >
                      -
                    </button>
                    <input
                      type="number"
                      min={1}
                      value={fasttrackQty}
                      onChange={(e) => setFasttrackQty(Math.max(1, parseInt(e.target.value) || 1))}
                      className="w-16 h-8 border border-slate-300 dark:border-slate-600 dark:bg-slate-800 dark:text-white rounded-lg text-center font-bold text-sm outline-none focus:ring-2 focus:ring-indigo-500"
                    />
                    <button
                      type="button"
                      onClick={() => setFasttrackQty(prev => prev + 1)}
                      className="w-8 h-8 rounded-lg bg-indigo-100 hover:bg-indigo-200 dark:bg-indigo-950 dark:hover:bg-indigo-900 font-bold text-indigo-700 dark:text-indigo-300 text-base flex items-center justify-center transition-colors"
                    >
                      +
                    </button>
                  </div>
                </div>
              ) : (
                <div className="mt-3 flex items-center justify-between border-t border-gray-200 dark:border-slate-700 pt-2">
                  <span className="text-xs text-blue-600 dark:text-blue-400 font-bold">발급 예정 LPN</span>
                  <span className="text-xs font-mono font-bold bg-blue-100 dark:bg-blue-950 text-blue-800 dark:text-blue-300 px-2 py-0.5 rounded">{currentLpn}</span>
                </div>
              )}
            </div>

            {inboundType === 'NEW_FASTTRACK' ? (
              <button 
                onClick={onFasttrack}
                className="w-full bg-gradient-to-r from-indigo-600 to-indigo-700 hover:from-indigo-700 hover:to-indigo-800 text-white font-black py-4 px-6 rounded-2xl shadow-xl shadow-indigo-200 dark:shadow-none flex items-center justify-center gap-2 cursor-pointer transition-all text-base"
              >
                <Zap className="w-5 h-5 text-yellow-300 fill-yellow-300 animate-pulse" />
                <span>⚡ 신품 도서 Fast-track 입고 완료 ({fasttrackQty}권)</span>
              </button>
            ) : bookInfo?.isRescan ? (
              <div className="flex gap-2 mt-2">
                <button
                  onClick={onPrintAndCapture}
                  disabled={isPrinting}
                  className="flex-1 bg-amber-600 hover:bg-amber-700 text-white font-bold py-3.5 px-4 rounded-xl shadow-lg flex items-center justify-center gap-2 cursor-pointer transition-colors"
                >
                  <Printer className="w-5 h-5" />
                  <span>스티커 재출력 & 촬영</span>
                </button>
                <button 
                  onClick={onSkipPrintCapture}
                  className="flex-[2] bg-purple-600 hover:bg-purple-700 text-white py-4 rounded-xl font-bold flex items-center justify-center transition-all shadow-lg shadow-purple-200 dark:shadow-none"
                >
                  <Camera className="w-5 h-5 mr-2" />
                  기존 라벨지 유지 및 재촬영 진행
                </button>
              </div>
            ) : (
              <button
                onClick={onConfirmPrintAndCapture}
                disabled={isPrinting}
                className="w-full bg-blue-600 hover:bg-blue-700 disabled:bg-blue-400 text-white py-4 rounded-xl font-bold flex items-center justify-center transition-all shadow-lg shadow-blue-200 dark:shadow-none"
              >
                {isPrinting ? <RefreshCcw className="w-5 h-5 animate-spin mr-2" /> : <Printer className="w-5 h-5 mr-2" />}
                {isPrinting ? '라벨 출력 중...' : '검열지 프린트 및 부착 완료'}
              </button>
            )}
          </div>
  );
}
