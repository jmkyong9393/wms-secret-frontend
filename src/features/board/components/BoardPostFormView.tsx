"use client";

import { useRouter } from "next/navigation";
import { useHydratedUser } from "@/entities/user/model/useHydratedUser";
import { useBoardPostQuery } from "@/features/board/hooks/useBoardPostQuery";
import {
  useCreateBoardPostMutation,
  useUpdateBoardPostMutation,
} from "@/features/board/hooks/useBoardPostMutations";
import { canCreateAnyPost, canEditPost } from "@/features/board/utils/permissions";
import { BoardPostForm, type BoardPostFormValues } from "@/features/board/components/BoardPostForm";

interface BoardPostFormViewProps {
  postId?: string;
}

export function BoardPostFormView({ postId }: BoardPostFormViewProps) {
  const router = useRouter();
  const { user, hydrated } = useHydratedUser();
  const isEditMode = !!postId;

  const { data: existingPost, isLoading } = useBoardPostQuery(postId);
  const createMutation = useCreateBoardPostMutation();
  const updateMutation = useUpdateBoardPostMutation();

  if (!hydrated || (isEditMode && isLoading)) {
    return <p className="max-w-2xl mx-auto text-sm text-gray-400 p-4">불러오는 중...</p>;
  }

  if (!isEditMode && !canCreateAnyPost(user)) {
    return (
      <p className="max-w-2xl mx-auto text-sm text-rose-600 p-4">게시글 작성 권한이 없습니다.</p>
    );
  }

  if (isEditMode) {
    if (!existingPost) {
      return <p className="max-w-2xl mx-auto text-sm text-rose-600 p-4">게시글을 찾을 수 없습니다.</p>;
    }
    if (!canEditPost(user, existingPost)) {
      return (
        <p className="max-w-2xl mx-auto text-sm text-rose-600 p-4">이 게시글을 수정할 권한이 없습니다.</p>
      );
    }
  }

  const handleSubmit = (values: BoardPostFormValues) => {
    if (isEditMode && existingPost) {
      updateMutation.mutate(
        {
          postId: existingPost.id,
          payload: {
            category: values.category,
            title: values.title,
            content: values.content,
            attachment_paths: values.attachmentPaths,
          },
        },
        {
          onSuccess: () => router.push(`/board/${existingPost.id}`),
          onError: () => alert("게시글 수정에 실패했습니다."),
        }
      );
    } else {
      createMutation.mutate(
        {
          category: values.category,
          title: values.title,
          content: values.content,
          attachment_paths: values.attachmentPaths,
        },
        {
          onSuccess: (created) => router.push(`/board/${created.id}`),
          onError: () => alert("게시글 등록에 실패했습니다."),
        }
      );
    }
  };

  return (
    <div className="max-w-2xl mx-auto p-4 sm:p-6 space-y-4">
      <h2 className="text-xl md:text-2xl font-bold text-gray-800 dark:text-white">
        {isEditMode ? "게시글 수정" : "새 글 작성"}
      </h2>
      <div className="bg-white dark:bg-gray-900 rounded-2xl border border-gray-200 dark:border-gray-800 shadow-2xs p-5 md:p-6">
        <BoardPostForm
          currentUser={user}
          initialValues={
            isEditMode && existingPost
              ? {
                  category: existingPost.category,
                  title: existingPost.title,
                  content: existingPost.content,
                  attachmentPaths: existingPost.attachment_paths,
                }
              : undefined
          }
          isSubmitting={createMutation.isPending || updateMutation.isPending}
          submitLabel={isEditMode ? "수정 완료" : "등록"}
          onSubmit={handleSubmit}
          onCancel={() => router.back()}
        />
      </div>
    </div>
  );
}
