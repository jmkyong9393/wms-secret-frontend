"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Plus } from "lucide-react";
import { Input } from "@/shared/ui/input";
import { Button } from "@/shared/ui/button";
import { useHydratedUser } from "@/entities/user/model/useHydratedUser";
import { useBoardPostsQuery } from "@/features/board/hooks/useBoardPostsQuery";
import { BoardPostList } from "@/features/board/components/BoardPostList";
import { CATEGORY_FILTER_ALL } from "@/features/board/components/BoardCategoryFilter";
import { BoardCategoryTabs } from "@/features/board/components/BoardCategoryTabs";
import { canCreateAnyPost } from "@/features/board/utils/permissions";
import type { BoardCategory, BoardPostListParams } from "@/features/board/types/board";

const PAGE_SIZE = 20;

export function BoardListView() {
  const router = useRouter();
  const { user } = useHydratedUser();
  const [keyword, setKeyword] = useState("");
  // 공지사항을 기본 탭으로 먼저 보여준다 (조장 확인 완료) - 전체 통합 보기는
  // 탭을 한 번 더 눌러야 닿는 위치에 둔다.
  const [category, setCategory] = useState<BoardCategory | typeof CATEGORY_FILTER_ALL>(
    "NOTICE"
  );
  const [page, setPage] = useState(1);

  const params: BoardPostListParams = {
    keyword: keyword.trim() || undefined,
    category: category === CATEGORY_FILTER_ALL ? undefined : category,
    page,
    size: PAGE_SIZE,
  };

  const { data, isLoading, isError } = useBoardPostsQuery(params);
  const totalPages = data ? Math.max(1, Math.ceil(data.total / PAGE_SIZE)) : 1;

  return (
    <div className="max-w-4xl mx-auto p-4 sm:p-6 space-y-4">
      <div className="flex items-center justify-between gap-2 flex-wrap">
        <div>
          <h2 className="text-xl md:text-2xl font-bold text-gray-800 dark:text-white">게시판</h2>
          <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">
            공지사항, 요청사항, 자유게시판을 확인하고 작성합니다.
          </p>
        </div>
        {canCreateAnyPost(user) && (
          <Button type="button" onClick={() => router.push("/board/new")}>
            <Plus className="w-4 h-4" />
            새 글 작성
          </Button>
        )}
      </div>

      <BoardCategoryTabs
        value={category}
        onChange={(v) => {
          setPage(1);
          setCategory(v);
        }}
      />

      <Input
        value={keyword}
        onChange={(e) => {
          setPage(1);
          setKeyword(e.target.value);
        }}
        placeholder="제목 또는 내용 검색"
        className="max-w-xs"
      />

      {isLoading && <p className="text-sm text-gray-400">불러오는 중...</p>}
      {isError && <p className="text-sm text-red-600">게시글 목록을 불러오지 못했습니다.</p>}

      {data && (
        <>
          <BoardPostList items={data.items} />
          <div className="flex items-center justify-between text-sm text-gray-500 dark:text-gray-400">
            <span>총 {data.total}건</span>
            <div className="flex items-center gap-2">
              <Button
                type="button"
                variant="outline"
                size="sm"
                disabled={page <= 1}
                onClick={() => setPage((p) => Math.max(1, p - 1))}
              >
                이전
              </Button>
              <span>
                {page} / {totalPages}
              </span>
              <Button
                type="button"
                variant="outline"
                size="sm"
                disabled={page >= totalPages}
                onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
              >
                다음
              </Button>
            </div>
          </div>
        </>
      )}
    </div>
  );
}
