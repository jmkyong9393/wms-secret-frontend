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
  ubci_score: number;
  grade: string;
  status: InspectionStatus;
  worker_id: string;
  inspected_at: string;
  ai_confidence: number;
  defects_found: InspectionDefect[];
  image_urls?: string[];
}

export interface LpnPrintData {
  lpn_barcode: string;
  book: { title: string; author: string; isbn: string };
  worker_id: string;
}
