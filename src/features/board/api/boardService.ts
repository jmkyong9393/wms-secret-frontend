import { apiClient } from "@/shared/api/api-client";
import {
  BOARD_POSTS_ENDPOINT,
  boardCommentDetailEndpoint,
  boardPostCommentsEndpoint,
  boardPostDetailEndpoint,
} from "@/features/board/constants/boardApi";
import type {
  BoardComment,
  BoardCommentCreateInput,
  BoardCommentUpdateInput,
  BoardPostCreateInput,
  BoardPostDetail,
  BoardPostListParams,
  BoardPostListResponse,
  BoardPostUpdateInput,
} from "@/features/board/types/board";

export async function listBoardPosts(
  params: BoardPostListParams
): Promise<BoardPostListResponse> {
  const res = await apiClient.get<BoardPostListResponse>(BOARD_POSTS_ENDPOINT, { params });
  return res.data;
}

export async function getBoardPost(postId: string): Promise<BoardPostDetail> {
  const res = await apiClient.get<BoardPostDetail>(boardPostDetailEndpoint(postId));
  return res.data;
}

export async function createBoardPost(
  payload: BoardPostCreateInput
): Promise<BoardPostDetail> {
  const res = await apiClient.post<BoardPostDetail>(BOARD_POSTS_ENDPOINT, payload);
  return res.data;
}

export async function updateBoardPost(
  postId: string,
  payload: BoardPostUpdateInput
): Promise<BoardPostDetail> {
  const res = await apiClient.patch<BoardPostDetail>(boardPostDetailEndpoint(postId), payload);
  return res.data;
}

export async function deleteBoardPost(postId: string): Promise<{ status: string; id: string }> {
  const res = await apiClient.delete<{ status: string; id: string }>(
    boardPostDetailEndpoint(postId)
  );
  return res.data;
}

export async function createBoardComment(
  postId: string,
  payload: BoardCommentCreateInput
): Promise<BoardComment> {
  const res = await apiClient.post<BoardComment>(boardPostCommentsEndpoint(postId), payload);
  return res.data;
}

export async function updateBoardComment(
  commentId: string,
  payload: BoardCommentUpdateInput
): Promise<BoardComment> {
  const res = await apiClient.patch<BoardComment>(boardCommentDetailEndpoint(commentId), payload);
  return res.data;
}

export async function deleteBoardComment(
  commentId: string
): Promise<{ status: string; id: string }> {
  const res = await apiClient.delete<{ status: string; id: string }>(
    boardCommentDetailEndpoint(commentId)
  );
  return res.data;
}
