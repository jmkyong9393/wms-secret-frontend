"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { ArrowLeft, FileText } from "lucide-react";
import { Button } from "@/shared/ui/button";
import { useHydratedUser } from "@/entities/user/model/useHydratedUser";
import { useBoardPostQuery } from "@/features/board/hooks/useBoardPostQuery";
import { useDeleteBoardPostMutation } from "@/features/board/hooks/useBoardPostMutations";
import { canDeletePost, canEditPost } from "@/features/board/utils/permissions";
import { CATEGORY_BADGE_CLASS, CATEGORY_LABEL } from "@/features/board/components/categoryLabels";
import { boardAttachmentDisplayName, useBoardAttachmentUrls } from "@/features/board/utils/attachmentUrl";
import { isImageAttachment } from "@/features/board/utils/attachmentValidation";
import { BoardCommentList } from "@/features/board/components/BoardCommentList";
import { BoardCommentForm } from "@/features/board/components/BoardCommentForm";
import { ConfirmDialog } from "@/features/board/components/ConfirmDialog";
import { canWriteComment } from "@/features/board/utils/permissions";
import { maskName } from "@/shared/lib/privacy-mask";

interface BoardDetailViewProps {
  postId: string;
}

function formatDateTime(iso: string): string {
  return new Date(iso).toLocaleString("ko-KR", {
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
  });
}

export function BoardDetailView({ postId }: BoardDetailViewProps) {
  const router = useRouter();
  const { user } = useHydratedUser();
  const { data: post, isLoading, isError } = useBoardPostQuery(postId);
  const deleteMutation = useDeleteBoardPostMutation();
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  // 첨부 열람 URL은 만료가 있어 매번 서버에서 발급받는다. 훅이므로 아래 조기 반환보다 앞에 둔다.
  const attachmentUrl = useBoardAttachmentUrls(post?.attachment_paths ?? []);

  if (isLoading) {
    return <p className="max-w-3xl mx-auto text-sm text-gray-400 p-4">불러오는 중...</p>;
  }

  if (isError || !post) {
    return (
      <div className="max-w-3xl mx-auto p-4 space-y-3">
        <p className="text-sm text-rose-600">게시글을 불러오지 못했습니다.</p>
        <Button type="button" variant="outline" size="sm" onClick={() => router.push("/board")}>
          목록으로
        </Button>
      </div>
    );
  }

  const handleDelete = () => {
    deleteMutation.mutate(post.id, {
      onSuccess: () => router.push("/board"),
      onError: () => {
        alert("게시글 삭제에 실패했습니다.");
        setShowDeleteConfirm(false);
      },
    });
  };

  return (
    <div className="max-w-3xl mx-auto p-4 sm:p-6 space-y-4">
      <button
        type="button"
        onClick={() => router.push("/board")}
        className="flex items-center text-xs font-bold text-gray-600 dark:text-gray-300 hover:text-gray-900 dark:hover:text-white bg-white dark:bg-gray-900 px-3.5 py-2 rounded-xl border border-gray-200 dark:border-gray-700 shadow-2xs transition-colors cursor-pointer"
      >
        <ArrowLeft className="w-4 h-4 mr-1.5" />
        게시판 목록으로
      </button>

      <div className="bg-white dark:bg-gray-900 rounded-2xl border border-gray-200 dark:border-gray-800 shadow-2xs p-5 md:p-6 space-y-4">
        <div className="space-y-2 border-b border-gray-100 dark:border-gray-800 pb-4">
          <div className="flex items-center justify-between gap-2 flex-wrap">
            <span
              className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-bold border ${CATEGORY_BADGE_CLASS[post.category]}`}
            >
              {CATEGORY_LABEL[post.category]}
            </span>
            {(canEditPost(user, post) || canDeletePost(user, post)) && (
              <div className="flex items-center gap-2">
                {canEditPost(user, post) && (
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={() => router.push(`/board/${post.id}/edit`)}
                  >
                    수정
                  </Button>
                )}
                {canDeletePost(user, post) && (
                  <Button
                    type="button"
                    variant="destructive"
                    size="sm"
                    onClick={() => setShowDeleteConfirm(true)}
                  >
                    삭제
                  </Button>
                )}
              </div>
            )}
          </div>
          <h1 className="text-xl md:text-2xl font-black text-gray-900 dark:text-white break-words">
            {post.title}
          </h1>
          <p className="text-xs text-gray-500 dark:text-gray-400 font-medium">
            {maskName(post.author_name)} · {formatDateTime(post.created_at)}
          </p>
        </div>

        <p className="text-sm text-gray-800 dark:text-gray-100 whitespace-pre-wrap break-words leading-relaxed">
          {post.content}
        </p>

        {post.attachment_paths.length > 0 && (
          <div className="flex flex-wrap gap-2 pt-2">
            {post.attachment_paths.map((path, idx) =>
              isImageAttachment(path) ? (
                <a key={path} href={attachmentUrl(path)} target="_blank" rel="noopener noreferrer">
                  <img
                    src={attachmentUrl(path)}
                    alt={`첨부 ${idx + 1}`}
                    className="w-24 h-24 object-cover rounded-lg border border-gray-200 dark:border-gray-700"
                  />
                </a>
              ) : (
                <a
                  key={path}
                  href={attachmentUrl(path)}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex items-center gap-2 px-3 py-2 rounded-lg border border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-800/60 hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors max-w-[220px]"
                >
                  <FileText className="w-4 h-4 text-gray-400 shrink-0" />
                  <span className="text-xs text-gray-700 dark:text-gray-300 truncate">
                    {boardAttachmentDisplayName(path)}
                  </span>
                </a>
              )
            )}
          </div>
        )}
      </div>

      {post.category !== "NOTICE" && (
        <div className="bg-white dark:bg-gray-900 rounded-2xl border border-gray-200 dark:border-gray-800 shadow-2xs p-5 md:p-6 space-y-4">
          <h2 className="text-sm font-bold text-gray-700 dark:text-gray-300">
            댓글 {post.comments.length}개
            {post.category === "MANUAL" && (
              <span className="ml-2 text-xs font-normal text-gray-400 dark:text-gray-500">
                (관리자만 답변할 수 있습니다)
              </span>
            )}
          </h2>
          <BoardCommentList postId={post.id} comments={post.comments} currentUser={user} />
          {canWriteComment(user, post.category) && <BoardCommentForm postId={post.id} />}
        </div>
      )}

      <ConfirmDialog
        open={showDeleteConfirm}
        title="게시글을 삭제할까요?"
        description="삭제한 게시글과 댓글은 복구할 수 없습니다."
        confirmLabel="삭제"
        isLoading={deleteMutation.isPending}
        onConfirm={handleDelete}
        onCancel={() => setShowDeleteConfirm(false)}
      />
    </div>
  );
}
