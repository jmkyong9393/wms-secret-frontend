export type BoardCategory = "NOTICE" | "MANUAL" | "GENERAL";

export interface BoardPostListItem {
  id: string;
  category: BoardCategory;
  title: string;
  author_id: string;
  author_employee_id: string;
  author_name: string;
  comment_count: number;
  created_at: string;
  updated_at: string;
}

export interface BoardPostListParams {
  category?: BoardCategory;
  keyword?: string;
  page?: number;
  size?: number;
}

export interface BoardPostListResponse {
  items: BoardPostListItem[];
  total: number;
  page: number;
  size: number;
}

export interface BoardComment {
  id: string;
  post_id: string;
  author_id: string;
  author_employee_id: string;
  author_name: string;
  content: string;
  created_at: string;
  updated_at: string;
}

export interface BoardPostDetail {
  id: string;
  category: BoardCategory;
  title: string;
  content: string;
  attachment_paths: string[];
  author_id: string;
  author_employee_id: string;
  author_name: string;
  created_at: string;
  updated_at: string;
  comments: BoardComment[];
}

export interface BoardPostCreateInput {
  category: BoardCategory;
  title: string;
  content: string;
  attachment_paths: string[];
}

export interface BoardPostUpdateInput {
  category?: BoardCategory;
  title?: string;
  content?: string;
  attachment_paths?: string[];
}

export interface BoardCommentCreateInput {
  content: string;
}

export interface BoardCommentUpdateInput {
  content: string;
}
