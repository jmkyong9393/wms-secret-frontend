import type { BoardPostListParams } from "@/features/board/types/board";

// 게시판 Query key factory
export const boardKeys = {
  all: ["board"] as const,
  list: (params: BoardPostListParams) => [...boardKeys.all, "list", params] as const,
  detail: (postId: string) => [...boardKeys.all, "detail", postId] as const,
};
