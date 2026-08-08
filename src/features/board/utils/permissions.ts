import type { CurrentUser } from "@/features/auth/types/authTypes";
import type { BoardCategory } from "@/features/board/types/board";

/**
 * 게시판 권한 확인
 *
 * NOTICE(공지)는 MASTER/ADMIN만 작성 가능, MANUAL/GENERAL은 GUEST를 제외한 전 직원 작성 가능.
 * 수정/삭제는 작성자 본인 또는 MASTER/ADMIN. 백엔드 assert_can_write_category /
 * assert_can_modify_post와 동일한 규칙 - 여기서는 UI 게이팅(이중 방어)용이다.
 */

export function canWriteCategory(
  user: CurrentUser | null,
  category: BoardCategory
): boolean {
  if (!user) return false;
  if (category === "NOTICE") return user.role === "MASTER" || user.role === "ADMIN";
  return user.role !== "GUEST";
}

export function canCreateAnyPost(user: CurrentUser | null): boolean {
  return !!user && user.role !== "GUEST";
}

/**
 * 댓글 작성 권한은 게시글 카테고리에 따라 다르다 (조장 확인 완료, 백엔드
 * assert_can_write_comment와 동일 규칙):
 * - NOTICE(공지사항): 댓글창 자체를 막는다.
 * - MANUAL(요청사항): 전 직원이 글은 올리지만, 응답(댓글)은 관리자만 가능.
 * - GENERAL(자유게시판): GUEST만 제외하고 자유롭게 댓글 가능.
 */
export function canWriteComment(
  user: CurrentUser | null,
  category: BoardCategory
): boolean {
  if (!user) return false;
  if (category === "NOTICE") return false;
  if (category === "MANUAL") return user.role === "MASTER" || user.role === "ADMIN";
  return user.role !== "GUEST";
}

export function canEditPost(
  user: CurrentUser | null,
  post: { author_employee_id: string }
): boolean {
  if (!user) return false;
  return (
    user.role === "MASTER" ||
    user.role === "ADMIN" ||
    user.employeeId === post.author_employee_id
  );
}

export const canDeletePost = canEditPost;

export function canEditComment(
  user: CurrentUser | null,
  comment: { author_employee_id: string }
): boolean {
  if (!user) return false;
  return (
    user.role === "MASTER" ||
    user.role === "ADMIN" ||
    user.employeeId === comment.author_employee_id
  );
}

export const canDeleteComment = canEditComment;
