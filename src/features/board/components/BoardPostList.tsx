"use client";

import Link from "next/link";
import { MessageCircle } from "lucide-react";
import type { BoardPostListItem } from "@/features/board/types/board";
import { CATEGORY_BADGE_CLASS, CATEGORY_LABEL } from "@/features/board/components/categoryLabels";
import { maskName } from "@/lib/privacy-mask";

interface BoardPostListProps {
  items: BoardPostListItem[];
}

function formatDate(iso: string): string {
  return new Date(iso).toLocaleDateString("ko-KR", {
    year: "2-digit",
    month: "2-digit",
    day: "2-digit",
  });
}

/**
 * 게시글 목록 - 좁은 화면(WORKER 모바일 셸)에서는 카드, md 이상(MASTER/ADMIN 데스크톱)에서는
 * 표로 렌더링한다. src/features/stock/components/InspectionDataTable.tsx의
 * md:hidden 카드 / hidden md:block 표 듀얼 렌더링 패턴을 그대로 따른다.
 */
export function BoardPostList({ items }: BoardPostListProps) {
  if (items.length === 0) {
    return (
      <p className="py-10 text-center text-gray-400 dark:text-gray-500 text-sm font-medium">
        등록된 게시글이 없습니다.
      </p>
    );
  }

  return (
    <>
      {/* 모바일 카드 목록 */}
      <div className="md:hidden space-y-2.5">
        {items.map((post) => (
          <Link
            key={post.id}
            href={`/board/${post.id}`}
            className="block w-full text-left bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-800 rounded-2xl p-3.5 active:scale-[0.99] transition-transform shadow-2xs"
          >
            <div className="flex items-center gap-1.5 mb-1.5">
              <span
                className={`inline-flex items-center px-2 py-0.5 rounded-full text-[11px] font-bold border ${CATEGORY_BADGE_CLASS[post.category]}`}
              >
                {CATEGORY_LABEL[post.category]}
              </span>
              {post.comment_count > 0 && (
                <span className="inline-flex items-center gap-0.5 text-[11px] font-bold text-gray-400 dark:text-gray-500">
                  <MessageCircle className="w-3 h-3" /> {post.comment_count}
                </span>
              )}
            </div>
            <p className="font-bold text-sm text-gray-900 dark:text-white line-clamp-2 leading-snug">
              {post.title}
            </p>
            <p className="text-[11px] text-gray-500 dark:text-gray-400 font-semibold mt-1 truncate">
              {maskName(post.author_name)} · {formatDate(post.created_at)}
            </p>
          </Link>
        ))}
      </div>

      {/* 데스크톱 표 */}
      <div className="hidden md:block overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="text-left text-xs text-gray-400 dark:text-gray-500 border-b border-gray-200 dark:border-gray-800">
              <th className="py-2 pr-3 font-bold w-24">카테고리</th>
              <th className="py-2 pr-3 font-bold">제목</th>
              <th className="py-2 pr-3 font-bold w-28">작성자</th>
              <th className="py-2 pr-3 font-bold w-16 text-center">댓글</th>
              <th className="py-2 pr-3 font-bold w-24">작성일</th>
            </tr>
          </thead>
          <tbody>
            {items.map((post) => (
              <tr
                key={post.id}
                className="border-b border-gray-100 dark:border-gray-800/60 hover:bg-gray-50 dark:hover:bg-gray-800/40 transition-colors"
              >
                <td className="py-2.5 pr-3">
                  <span
                    className={`inline-flex items-center px-2 py-0.5 rounded-full text-[11px] font-bold border ${CATEGORY_BADGE_CLASS[post.category]}`}
                  >
                    {CATEGORY_LABEL[post.category]}
                  </span>
                </td>
                <td className="py-2.5 pr-3">
                  <Link
                    href={`/board/${post.id}`}
                    className="font-bold text-gray-900 dark:text-white hover:text-indigo-600 dark:hover:text-indigo-400"
                  >
                    {post.title}
                  </Link>
                </td>
                <td className="py-2.5 pr-3 text-gray-600 dark:text-gray-300">{maskName(post.author_name)}</td>
                <td className="py-2.5 pr-3 text-center text-gray-500 dark:text-gray-400">
                  {post.comment_count}
                </td>
                <td className="py-2.5 pr-3 text-gray-500 dark:text-gray-400 font-mono text-xs">
                  {formatDate(post.created_at)}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </>
  );
}
