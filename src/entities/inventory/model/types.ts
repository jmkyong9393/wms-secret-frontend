import type { StockBook } from '@/entities/book/model/types';

export interface InventoryItem {
  id: string;
  lpn_barcode: string;
  book: StockBook;
  grade: string; // 'MINT' | 'GOOD' | 'NORMAL' | 'REJECT' | 'NEW_FASTTRACK' 등 백엔드 열린 문자열
  ubci_score: number | null;
  zone: string;
  quantity: number;
  /** 등급 확정 주체 서술 (구 표기, 상세 화면 호환용) */
  worker_id: string;
  /** 실제 검수를 수행한 작업자. `WM2608002(신동준)` 형식 */
  worker_label: string;
  /** 등급 확정 경로: 신품 / AI / HITL / HITL 대기 / 수기 */
  track: string;
  date: string;
}
