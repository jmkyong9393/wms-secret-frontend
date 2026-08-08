import type { BoardCategory } from "@/features/board/types/board";

export const CATEGORY_LABEL: Record<BoardCategory, string> = {
  NOTICE: "공지사항",
  MANUAL: "요청사항",
  GENERAL: "자유게시판",
};

export const CATEGORY_BADGE_CLASS: Record<BoardCategory, string> = {
  NOTICE:
    "bg-rose-100 dark:bg-rose-950 text-rose-700 dark:text-rose-300 border-rose-200 dark:border-rose-800",
  MANUAL:
    "bg-sky-100 dark:bg-sky-950 text-sky-700 dark:text-sky-300 border-sky-200 dark:border-sky-800",
  GENERAL:
    "bg-gray-100 dark:bg-gray-800 text-gray-700 dark:text-gray-300 border-gray-200 dark:border-gray-700",
};
