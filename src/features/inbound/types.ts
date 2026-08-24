/** 도서 조회(book-lookup)·채번 응답에 실리는 도서 메타 — 화면 사용 필드만 */
export interface BookMeta {
  isbn?: string;
  title?: string;
  author?: string;
  publisher?: string;
  price?: number | string;
  imageUrl?: string;
  categoryName?: string;
  category?: string;
  description?: string;
  isRescan?: boolean;
  lookupFailed?: boolean;
}

export interface PrintStickerRequest {
  lpn: string;
  grade: string;
  isbn?: string;
}

export interface HistoryLog {
  id: string;
  job_id?: string;
  lpn: string;
  isbn: string;
  title: string;
  author?: string;
  category?: string;
  publisher?: string;
  status: string;
  date: string;
  aiConfidence: string;
  reviewer: string;
  ubciScore?: number;
  reasonCode?: string;
}
