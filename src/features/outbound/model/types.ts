// 출고 도메인 읽기 모델 — 백엔드 picking_instructions/피킹 스캔 응답과
// 재고 조회(도서 부피 스펙 포함) 응답의 프론트 사용 필드만 선언한다.

/** 피킹 지시 안의 개별 품목 */
export interface PickingItem {
  id?: string | number;
  book_id?: string;
  isbn?: string;
  title?: string;
  lpn_barcode?: string;
  location_label?: string;
  pick_seq?: number;
  quantity: number;
  picked_quantity?: number;
  status?: string;
  stock_type?: string;
  is_new?: boolean;
  used_item_id?: string | null;
}

export interface PickingInstruction {
  id: string;
  instruction_no?: string;
  status: string;
  customer_name?: string;
  items: PickingItem[];
  total_items: number;
  picked_items: number;
  route_summary?: string;
  ai_source?: string;
  box_id?: string | null;
  cushion_name?: string | null;
  cj_waybill_no?: string | null;
  accepted_at?: string | null;
  accepted_by?: string | null;
  worker_note?: string | null;
}

/** 출고 후보 도서 — 재고 행 + 포장 계산용 부피 스펙 */
export interface OutboundBook {
  id: string;
  customer?: string;
  isbn?: string;
  title: string;
  author?: string;
  publisher?: string;
  category?: string;
  cover_image_url?: string;
  lpn?: string;
  isNew?: boolean;
  stock_qty?: number;
  listPrice?: number;
  ubciScore?: number;
  daysInInventory?: number;
  width?: number;
  height?: number;
  depth?: number;
  width_mm?: number;
  depth_mm?: number;
  thickness_mm?: number;
  weight_g?: number;
  specs?: { width_mm?: number; depth_mm?: number; thickness_mm?: number; weight_g?: number };
}

export interface CushionOption {
  thick_mm: number;
  mode: string;
}

export interface PricingResult {
  final_price?: number;
  pricing_label?: string;
}

/** 데모 주문 컨텍스트 (Two-Track 도매가 산정 데모용) */
export interface DemoOrder {
  order_id?: string;
  customer_name?: string;
  isbn?: string;
  title?: string;
  list_price?: number;
  discount_rate?: number;
  optimization_model?: string;
  trend_badge_text?: string;
  ubci_score?: number | null;
  days_in_inventory?: number;
  category?: string;
  final_price?: number;
  pricing_label?: string;
}

/** 피킹 바코드 스캔 판정 결과 */
export interface PickScanResult {
  matched_item: PickingItem;
  progress?: number | string;
  timestamp?: number | string;
}
