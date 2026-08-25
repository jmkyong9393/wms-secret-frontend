"use client";

import { useState } from "react";
import { Textarea } from "@/shared/ui/textarea";
import { Button } from "@/shared/ui/button";
import { useCreateBoardCommentMutation } from "@/features/board/hooks/useBoardCommentMutations";

interface BoardCommentFormProps {
  postId: string;
}

export function BoardCommentForm({ postId }: BoardCommentFormProps) {
  const [content, setContent] = useState("");
  const { mutate, isPending } = useCreateBoardCommentMutation(postId);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!content.trim()) return;
    mutate(
      { content: content.trim() },
      {
        onSuccess: () => setContent(""),
        onError: () => alert("댓글 등록에 실패했습니다."),
      }
    );
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-2">
      <Textarea
        value={content}
        onChange={(e) => setContent(e.target.value)}
        placeholder="댓글을 입력하세요"
        className="min-h-24"
        disabled={isPending}
      />
      <div className="flex justify-end">
        <Button type="submit" size="sm" disabled={isPending || !content.trim()}>
          {isPending ? "등록 중..." : "댓글 등록"}
        </Button>
      </div>
    </form>
  );
}
