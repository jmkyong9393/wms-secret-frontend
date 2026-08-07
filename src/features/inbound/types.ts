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
