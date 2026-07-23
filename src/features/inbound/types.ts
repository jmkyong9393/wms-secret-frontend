export interface VisionEvaluationRequest {
  imageFile: File;
  isbn?: string; // 바코드 스캔으로 얻은 ISBN
}

export interface VisionEvaluationResponse {
  lpn: string; // 새로 발급된 LPN
  grade: 'S' | 'A' | 'B' | 'C' | 'D';
  gradeName: string; // e.g., 'S등급 (최상)'
  confidence: number; // AI 확신도 (0~100)
  analysisDetails: string; // 상세 분석 내용
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
