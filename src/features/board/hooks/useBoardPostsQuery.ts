"use client";

import { useQuery } from "@tanstack/react-query";
import { listBoardPosts } from "@/features/board/api/boardService";
import { boardKeys } from "@/features/board/constants/queryKeys";
import type { BoardPostListParams } from "@/features/board/types/board";

export function useBoardPostsQuery(params: BoardPostListParams) {
  return useQuery({
    queryKey: boardKeys.list(params),
    queryFn: () => listBoardPosts(params),
  });
}
