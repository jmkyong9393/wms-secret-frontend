"use client";

import type { BoardCategory } from "@/features/board/types/board";
import { CATEGORY_LABEL } from "@/features/board/components/categoryLabels";
import { CATEGORY_FILTER_ALL } from "@/features/board/components/BoardCategoryFilter";

const TABS: Array<BoardCategory | typeof CATEGORY_FILTER_ALL> = [
  "NOTICE",
  "MANUAL",
  "GENERAL",
  CATEGORY_FILTER_ALL,
];

const TAB_LABEL: Record<BoardCategory | typeof CATEGORY_FILTER_ALL, string> = {
  NOTICE: CATEGORY_LABEL.NOTICE,
  MANUAL: CATEGORY_LABEL.MANUAL,
  GENERAL: CATEGORY_LABEL.GENERAL,
  ALL: "전체",
};

interface BoardCategoryTabsProps {
  value: BoardCategory | typeof CATEGORY_FILTER_ALL;
  onChange: (value: BoardCategory | typeof CATEGORY_FILTER_ALL) => void;
}

/**
 * 공지사항/요청사항/자유게시판을 탭으로 분리해 보여준다. 공지가 첫 탭(기본 노출)이고,
 * 전체 통합 보기는 맨 뒤 탭으로 한 번 더 클릭해야 닿는다 - 세 게시판이 하나로
 * 뭉쳐 보이지 않게 하면서도 통합 검색은 남겨 둔다 (조장 확인 완료).
 */
export function BoardCategoryTabs({ value, onChange }: BoardCategoryTabsProps) {
  return (
    <div
      role="tablist"
      aria-label="게시판 카테고리"
      className="flex items-center gap-1 border-b border-gray-200 dark:border-gray-800 overflow-x-auto"
    >
      {TABS.map((tab) => {
        const active = value === tab;
        return (
          <button
            key={tab}
            type="button"
            role="tab"
            aria-selected={active}
            onClick={() => onChange(tab)}
            className={`shrink-0 px-3.5 py-2 text-sm font-bold border-b-2 -mb-px transition-colors cursor-pointer ${
              active
                ? "border-indigo-600 text-indigo-600 dark:text-indigo-400"
                : "border-transparent text-gray-500 dark:text-gray-400 hover:text-gray-800 dark:hover:text-gray-200"
            }`}
          >
            {TAB_LABEL[tab]}
          </button>
        );
      })}
    </div>
  );
}
