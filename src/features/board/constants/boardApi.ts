export const BOARD_POSTS_ENDPOINT = "/api/v1/board/posts";

export const boardPostDetailEndpoint = (postId: string) => `/api/v1/board/posts/${postId}`;

export const boardPostCommentsEndpoint = (postId: string) =>
  `/api/v1/board/posts/${postId}/comments`;

export const boardCommentDetailEndpoint = (commentId: string) =>
  `/api/v1/board/comments/${commentId}`;
