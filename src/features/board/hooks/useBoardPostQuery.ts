"use client";

import { useQuery } from "@tanstack/react-query";
import { getBoardPost } from "@/features/board/api/boardService";
import { boardKeys } from "@/features/board/constants/queryKeys";

export function useBoardPostQuery(postId: string | undefined) {
  return useQuery({
    queryKey: boardKeys.detail(postId ?? ""),
    queryFn: () => getBoardPost(postId as string),
    enabled: !!postId,
  });
}
