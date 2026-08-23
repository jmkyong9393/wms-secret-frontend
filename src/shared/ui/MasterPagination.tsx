'use client';

import React, { useState } from 'react';

interface MasterPaginationProps {
  currentPage: number;
  totalPages: number;
  totalEntries: number;
  currentCount: number;
  onPageChange: (page: number) => void;
  /** 페이지당 표시 건수. onPageSizeChange와 함께 넘길 때만 선택 UI가 나타난다. */
  pageSize?: number;
  onPageSizeChange?: (size: number) => void;
  pageSizeOptions?: number[];
}

const DEFAULT_PAGE_SIZE_OPTIONS = [5, 10, 15, 20, 50];

export default function MasterPagination({
  currentPage,
  totalPages,
  totalEntries,
  currentCount,
  onPageChange,
  pageSize,
  onPageSizeChange,
  pageSizeOptions = DEFAULT_PAGE_SIZE_OPTIONS,
}: MasterPaginationProps) {
  const [jumpPageInput, setJumpPageInput] = useState('');

  const safeCurrentPage = Math.max(1, Math.min(currentPage, totalPages || 1));
  const safeTotalPages = totalPages || 1;

  const pageNumbers = [];
  const maxPagesToShow = 5;
  let startPage = Math.max(1, safeCurrentPage - 2);
  let endPage = Math.min(safeTotalPages, startPage + maxPagesToShow - 1);

  if (endPage - startPage + 1 < maxPagesToShow) {
    startPage = Math.max(1, endPage - maxPagesToShow + 1);
  }

  for (let i = startPage; i <= endPage; i++) {
    pageNumbers.push(i);
  }

  const handleJump = () => {
    const target = parseInt(jumpPageInput, 10);
    if (!isNaN(target)) {
      const safeTarget = Math.max(1, Math.min(safeTotalPages, target));
      onPageChange(safeTarget);
      setJumpPageInput('');
    }
  };

  return (
    <div className="flex flex-col sm:flex-row items-center justify-between gap-4 pt-4 border-t border-gray-100 dark:border-gray-800 text-xs">
      {/* Left Entries Counter + 페이지당 건수 */}
      <div className="flex items-center gap-3 flex-wrap">
        <p className="text-gray-500 dark:text-gray-400 font-mono">
          Showing <strong className="text-gray-900 dark:text-white font-bold">{currentCount}</strong> of{' '}
          <strong className="text-gray-900 dark:text-white font-bold">{totalEntries}</strong> entries
        </p>
        {pageSize !== undefined && onPageSizeChange && (
          <label className="flex items-center gap-1.5 text-gray-500 dark:text-gray-400 font-bold">
            <span className="whitespace-nowrap">페이지당</span>
            <select
              value={pageSize}
              onChange={(e) => {
                onPageSizeChange(Number(e.target.value));
                // 건수를 바꾸면 총 페이지 수가 달라지므로 첫 장으로 되돌린다.
                onPageChange(1);
              }}
              className="px-2 py-1 bg-white dark:bg-gray-800 border border-gray-300 dark:border-gray-700 rounded-lg text-xs font-black text-indigo-900 dark:text-indigo-200 outline-none focus:border-indigo-600 cursor-pointer"
            >
              {pageSizeOptions.map((n) => (
                <option key={n} value={n}>{n}건</option>
              ))}
            </select>
          </label>
        )}
      </div>

      {/* Right Controls Container */}
      <div className="flex items-center gap-1.5 flex-wrap justify-center font-mono">
        {/* << First Page */}
        <button
          onClick={() => onPageChange(1)}
          disabled={safeCurrentPage === 1}
          className="px-2.5 py-1.5 rounded-lg border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 text-gray-700 dark:text-gray-300 hover:bg-indigo-50 dark:hover:bg-indigo-950 disabled:opacity-30 font-black text-xs transition-colors cursor-pointer disabled:cursor-not-allowed"
          title="맨 처음 페이지로 이동"
        >
          &lt;&lt;
        </button>

        {/* < Prev Page */}
        <button
          onClick={() => onPageChange(Math.max(safeCurrentPage - 1, 1))}
          disabled={safeCurrentPage === 1}
          className="px-2.5 py-1.5 rounded-lg border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 text-gray-700 dark:text-gray-300 hover:bg-indigo-50 dark:hover:bg-indigo-950 disabled:opacity-30 font-black text-xs transition-colors cursor-pointer disabled:cursor-not-allowed"
          title="이전 페이지"
        >
          &lt;
        </button>

        {/* Numbered Page Buttons */}
        {pageNumbers.map((p) => (
          <button
            key={p}
            onClick={() => onPageChange(p)}
            className={`w-8 h-8 rounded-lg text-xs font-black transition-all border cursor-pointer ${
              safeCurrentPage === p
                ? 'bg-indigo-600 text-white border-indigo-600 shadow-xs ring-2 ring-indigo-500/30'
                : 'bg-white dark:bg-gray-800 text-gray-700 dark:text-gray-300 border-gray-200 dark:border-gray-700 hover:bg-indigo-50 dark:hover:bg-indigo-950'
            }`}
          >
            {p}
          </button>
        ))}

        {/* > Next Page */}
        <button
          onClick={() => onPageChange(Math.min(safeCurrentPage + 1, safeTotalPages))}
          disabled={safeCurrentPage === safeTotalPages}
          className="px-2.5 py-1.5 rounded-lg border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 text-gray-700 dark:text-gray-300 hover:bg-indigo-50 dark:hover:bg-indigo-950 disabled:opacity-30 font-black text-xs transition-colors cursor-pointer disabled:cursor-not-allowed"
          title="다음 페이지"
        >
          &gt;
        </button>

        {/* >> Last Page */}
        <button
          onClick={() => onPageChange(safeTotalPages)}
          disabled={safeCurrentPage === safeTotalPages}
          className="px-2.5 py-1.5 rounded-lg border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 text-gray-700 dark:text-gray-300 hover:bg-indigo-50 dark:hover:bg-indigo-950 disabled:opacity-30 font-black text-xs transition-colors cursor-pointer disabled:cursor-not-allowed"
          title={`맨 끝 페이지로 이동 (${safeTotalPages}페이지)`}
        >
          &gt;&gt;
        </button>

        {/* Direct Page Jump Input Field */}
        <div className="flex items-center gap-1.5 ml-2 border-l border-gray-200 dark:border-gray-700 pl-3">
          <span className="text-xs text-gray-500 dark:text-gray-400 font-bold whitespace-nowrap">페이지 바로가기:</span>
          <input
            type="number"
            min={1}
            max={safeTotalPages}
            value={jumpPageInput}
            onChange={(e) => setJumpPageInput(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter') handleJump();
            }}
            placeholder={`${safeCurrentPage}`}
            className="w-14 px-2 py-1 bg-white dark:bg-gray-800 border border-gray-300 dark:border-gray-700 rounded-lg text-xs font-black text-center text-indigo-900 dark:text-indigo-200 outline-none focus:border-indigo-600 dark:focus:border-indigo-400 shadow-2xs"
          />
          <span className="text-xs font-bold text-gray-400 font-mono">/ {safeTotalPages}</span>
          <button
            type="button"
            onClick={handleJump}
            className="px-2.5 py-1 bg-indigo-600 hover:bg-indigo-700 active:scale-95 text-white font-black text-xs rounded-lg transition-all shadow-2xs shrink-0 cursor-pointer"
          >
            이동
          </button>
        </div>
      </div>
    </div>
  );
}
