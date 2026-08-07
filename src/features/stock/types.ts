/**
 * 재고/검수 통합 데이터 그리드 공용 타입.
 *
 * [수정 이력 2026-08-04] admin/inventory, worker/inventory, admin/inspections,
 * worker/inspections 4개 페이지가 각자 동일한 로컬 타입을 중복 선언하고 있었다
 * (약 3,100줄 중복). URL은 4개 그대로 유지하되 코드를 이 모듈 1벌로 통합한다 (B안).
 */

export type StockRole = 'ADMIN' | 'WORKER';

export interface StockBook {
  title: string;
  author: string;
  publisher: string;
  isbn: string;
  base_price: number;
  cover_image_url?: string;
}

export interface InventoryItem {
  id: string;
  lpn_barcode: string;
  book: StockBook;
  grade: string; // 'MINT' | 'GOOD' | 'NORMAL' | 'REJECT' | 'NEW_FASTTRACK' 등 백엔드 열린 문자열
  ubci_score: number | null;
  zone: string;
  quantity: number;
  worker_id: string;
  date: string;
}

export type InspectionStatus = 'AUTO_APPROVED' | 'HITL_PENDING' | 'REJECTED';

export interface InspectionDefect {
  reason_code: string;
  description: string;
  confidence: number;
}

export interface InspectionItem {
  id: string;
  lpn_barcode: string;
  book: StockBook;
  /**
   * [2026-08-07] 값이 없을 수 있다(null).
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
  inspected_at: string;
  /** 백엔드가 산출·저장하지 않는 지표다. 하드코딩 금지 — 없으면 표시하지 않는다. */
  ai_confidence?: number | null;
  defects_found: InspectionDefect[];
  image_urls?: string[];
}

export interface LpnPrintData {
  lpn_barcode: string;
  book: { title: string; author: string; isbn: string };
  worker_id: string;
}
