"use client";

import { useMutation, useQueryClient } from "@tanstack/react-query";
import {
  createBoardPost,
  deleteBoardPost,
  updateBoardPost,
} from "@/features/board/api/boardService";
import { boardKeys } from "@/features/board/constants/queryKeys";
import type { BoardPostCreateInput, BoardPostUpdateInput } from "@/features/board/types/board";

export function useCreateBoardPostMutation() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (payload: BoardPostCreateInput) => createBoardPost(payload),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: boardKeys.all });
    },
  });
}

export function useUpdateBoardPostMutation() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ postId, payload }: { postId: string; payload: BoardPostUpdateInput }) =>
      updateBoardPost(postId, payload),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: boardKeys.all });
    },
  });
}

export function useDeleteBoardPostMutation() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (postId: string) => deleteBoardPost(postId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: boardKeys.all });
    },
  });
}
