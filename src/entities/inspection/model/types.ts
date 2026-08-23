import type { StockBook } from '@/entities/book/model/types';

export type InspectionStatus = 'AUTO_APPROVED' | 'HITL_PENDING' | 'REJECTED';

export interface InspectionDefect {
  reason_code: string;
  description: string;
  confidence: number;
  /** 관리자가 HITL에서 오탐으로 제외한 결함 - 감사 기록으로 남기되 감점엔 미반영. */
  excluded?: boolean;
}

export interface InspectionItem {
  id: string;
  lpn_barcode: string;
  book: StockBook;
  /**
   * 값이 없을 수 있다(null).
   *
   * 종전에는 `ubci_score or 85`, `condition_grade or 'GOOD'` 식으로 **없는 값을 지어내
   * 채웠고**, 그 결과 검수를 거치지 않은 재고까지 "AI 검수 완료"로 보였다.
   * 판독 전이거나 판독에 실패한 건은 점수·등급이 존재하지 않는 것이 사실이므로
   * null을 그대로 받고 화면에서 "미산출"로 표기한다.
   */
  ubci_score: number | null;
  grade: string | null;
  /** HITL 결재로 확정된 등급 (AI 산출 등급과 다를 수 있다) */
  confirmed_grade?: string | null;
  status: InspectionStatus;
  worker_id: string;
  /** 라벨 인쇄용 - AI/HITL 판정 주체(worker_id)가 아니라 실제 입고 처리한 사람. */
  worker_label: string;
  inspected_at: string;
  /** 백엔드가 산출·저장하지 않는 지표다. 하드코딩 금지 — 없으면 표시하지 않는다. */
  ai_confidence?: number | null;
  defects_found: InspectionDefect[];
  image_urls?: string[];
}
