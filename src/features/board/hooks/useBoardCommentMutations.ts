"use client";

import { useMutation, useQueryClient } from "@tanstack/react-query";
import {
  createBoardComment,
  deleteBoardComment,
  updateBoardComment,
} from "@/features/board/api/boardService";
import { boardKeys } from "@/features/board/constants/queryKeys";
import type { BoardCommentCreateInput, BoardCommentUpdateInput } from "@/features/board/types/board";

export function useCreateBoardCommentMutation(postId: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (payload: BoardCommentCreateInput) => createBoardComment(postId, payload),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: boardKeys.detail(postId) });
      queryClient.invalidateQueries({ queryKey: boardKeys.all });
    },
  });
}

export function useUpdateBoardCommentMutation(postId: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({
      commentId,
      payload,
    }: {
      commentId: string;
      payload: BoardCommentUpdateInput;
    }) => updateBoardComment(commentId, payload),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: boardKeys.detail(postId) });
    },
  });
}

export function useDeleteBoardCommentMutation(postId: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (commentId: string) => deleteBoardComment(commentId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: boardKeys.detail(postId) });
      queryClient.invalidateQueries({ queryKey: boardKeys.all });
    },
  });
}
