/** LPN 라벨 인쇄에 필요한 최소 데이터 (호출측 도메인 타입에서 사영해 전달). */
export interface LpnPrintData {
  lpn_barcode: string;
  book: { title: string; author: string; isbn: string };
  worker_id: string;
}
