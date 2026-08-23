"use client";

import { useState } from "react";
import { Textarea } from "@/shared/ui/textarea";
import { Button } from "@/shared/ui/button";
import type { CurrentUser } from "@/features/auth/types/authTypes";
import type { BoardComment } from "@/features/board/types/board";
import { canDeleteComment, canEditComment } from "@/features/board/utils/permissions";
import {
  useDeleteBoardCommentMutation,
  useUpdateBoardCommentMutation,
} from "@/features/board/hooks/useBoardCommentMutations";
import { ConfirmDialog } from "@/features/board/components/ConfirmDialog";
import { maskName } from "@/shared/lib/privacy-mask";

interface BoardCommentListProps {
  postId: string;
  comments: BoardComment[];
  currentUser: CurrentUser | null;
}

function formatDateTime(iso: string): string {
  return new Date(iso).toLocaleString("ko-KR", {
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
  });
}

export function BoardCommentList({ postId, comments, currentUser }: BoardCommentListProps) {
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editContent, setEditContent] = useState("");
  const [deleteTargetId, setDeleteTargetId] = useState<string | null>(null);

  const updateMutation = useUpdateBoardCommentMutation(postId);
  const deleteMutation = useDeleteBoardCommentMutation(postId);

  if (comments.length === 0) {
    return (
      <p className="py-6 text-center text-sm text-gray-400 dark:text-gray-500">
        아직 댓글이 없습니다.
      </p>
    );
  }

  const startEdit = (comment: BoardComment) => {
    setEditingId(comment.id);
    setEditContent(comment.content);
  };

  const saveEdit = (commentId: string) => {
    if (!editContent.trim()) return;
    updateMutation.mutate(
      { commentId, payload: { content: editContent.trim() } },
      { onSuccess: () => setEditingId(null), onError: () => alert("댓글 수정에 실패했습니다.") }
    );
  };

  const confirmDelete = () => {
    if (!deleteTargetId) return;
    deleteMutation.mutate(deleteTargetId, {
      onSuccess: () => setDeleteTargetId(null),
      onError: () => {
        alert("댓글 삭제에 실패했습니다.");
        setDeleteTargetId(null);
      },
    });
  };

  return (
    <div className="space-y-3">
      {comments.map((comment) => {
        const isEditing = editingId === comment.id;
        const showEdit = canEditComment(currentUser, comment);
        const showDelete = canDeleteComment(currentUser, comment);

        return (
          <div
            key={comment.id}
            className="bg-gray-50 dark:bg-gray-800/60 border border-gray-200 dark:border-gray-700 rounded-xl p-3"
          >
            <div className="flex items-center justify-between mb-1">
              <span className="text-xs font-bold text-gray-700 dark:text-gray-300">
                {maskName(comment.author_name)}
              </span>
              <span className="text-[11px] text-gray-400 dark:text-gray-500 font-mono">
                {formatDateTime(comment.created_at)}
              </span>
            </div>

            {isEditing ? (
              <div className="space-y-2">
                <Textarea
                  value={editContent}
                  onChange={(e) => setEditContent(e.target.value)}
                  className="min-h-20"
                  disabled={updateMutation.isPending}
                />
                <div className="flex justify-end gap-2">
                  <Button
                    variant="outline"
                    size="xs"
                    onClick={() => setEditingId(null)}
                    disabled={updateMutation.isPending}
                  >
                    취소
                  </Button>
                  <Button
                    size="xs"
                    onClick={() => saveEdit(comment.id)}
                    disabled={updateMutation.isPending || !editContent.trim()}
                  >
                    저장
                  </Button>
                </div>
              </div>
            ) : (
              <>
                <p className="text-sm text-gray-800 dark:text-gray-100 whitespace-pre-wrap break-words">
                  {comment.content}
                </p>
                {(showEdit || showDelete) && (
                  <div className="flex justify-end gap-3 mt-1.5">
                    {showEdit && (
                      <button
                        type="button"
                        onClick={() => startEdit(comment)}
                        className="text-[11px] font-bold text-gray-400 hover:text-indigo-600 dark:hover:text-indigo-400 min-h-11 min-w-11 flex items-center justify-center -m-2"
                      >
                        수정
                      </button>
                    )}
                    {showDelete && (
                      <button
                        type="button"
                        onClick={() => setDeleteTargetId(comment.id)}
                        className="text-[11px] font-bold text-gray-400 hover:text-rose-600 dark:hover:text-rose-400 min-h-11 min-w-11 flex items-center justify-center -m-2"
                      >
                        삭제
                      </button>
                    )}
                  </div>
                )}
              </>
            )}
          </div>
        );
      })}

      <ConfirmDialog
        open={!!deleteTargetId}
        title="댓글을 삭제할까요?"
        description="삭제한 댓글은 복구할 수 없습니다."
        confirmLabel="삭제"
        isLoading={deleteMutation.isPending}
        onConfirm={confirmDelete}
        onCancel={() => setDeleteTargetId(null)}
      />
    </div>
  );
}
